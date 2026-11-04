"""
CampVion Authentication & Session Management API Routes
Implements account registration, login with brute-force lockout protection,
server-managed HttpOnly sessions, logout/revocation, and secure password recovery.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    auth_rate_limiter,
    clear_auth_cookies,
    ensure_utc,
    generate_secure_token,
    hash_password,
    hash_token,
    require_authenticated_user,
    resolve_session_and_user,
    set_auth_cookies,
    validate_password_strength,
    verify_password_constant_time,
)
from app.db import models
from app.db.database import get_db
from app.schemas.auth import (
    AuthSessionResponse,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    UserProfileResponse,
)
from app.services.email_service import EmailDeliveryService

router = APIRouter()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _serialize_user(user: models.UserAccount) -> UserProfileResponse:
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        student_id=user.student_id,
        is_active=bool(user.is_active),
        created_at=ensure_utc(user.created_at) or datetime.now(timezone.utc),
        last_login_at=ensure_utc(user.last_login_at),
    )


def _create_session_for_user(
    db: Session,
    user: models.UserAccount,
    request: Request,
    response: Response,
    remember_me: bool = False,
) -> AuthSessionResponse:
    now = datetime.now(timezone.utc)
    if remember_me:
        duration = timedelta(days=settings.SESSION_REMEMBER_DAYS)
    else:
        duration = timedelta(hours=settings.SESSION_DURATION_HOURS)

    expires_at = now + duration
    max_age_seconds = int(duration.total_seconds())

    raw_session_token = generate_secure_token(32)
    csrf_token = generate_secure_token(24)

    session_record = models.AuthSession(
        user_id=user.id,
        token_hash=hash_token(raw_session_token),
        csrf_token=csrf_token,
        remember_me=1 if remember_me else 0,
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("User-Agent") or "")[:255],
        expires_at=expires_at,
        revoked=0,
        created_at=now,
        last_active_at=now,
    )
    user.last_login_at = now
    user.failed_login_attempts = 0
    user.locked_until = None

    db.add(session_record)
    db.commit()
    db.refresh(user)

    set_auth_cookies(
        response=response,
        raw_session_token=raw_session_token,
        csrf_token=csrf_token,
        max_age_seconds=max_age_seconds,
    )

    return AuthSessionResponse(
        authenticated=True,
        user=_serialize_user(user),
        csrf_token=csrf_token,
        expires_at=expires_at,
        session_token=raw_session_token,
    )


@router.post("/signup", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Create a new CampVion user account with the safest default role ('student').
    Never trusts client-supplied roles or privileges.
    """
    ip = _client_ip(request)
    auth_rate_limiter.check(f"signup:{ip}", max_requests=10, window_seconds=60)

    if not payload.accept_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms of Service and Privacy Policy to create an account.",
        )

    full_name = payload.full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your full name (at least 2 characters).",
        )

    email = payload.email.strip().lower()

    # Optional configurable institutional domain restriction
    if settings.ALLOWED_EMAIL_DOMAINS and settings.ALLOWED_EMAIL_DOMAINS.strip():
        allowed_domains = {
            d.strip().lower().lstrip("@")
            for d in settings.ALLOWED_EMAIL_DOMAINS.split(",")
            if d.strip()
        }
        email_domain = email.split("@")[-1]
        if allowed_domains and email_domain not in allowed_domains:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration is restricted to institutional email domains: {', '.join(sorted(allowed_domains))}.",
            )

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    is_strong, strength_err = validate_password_strength(payload.password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=strength_err,
        )

    existing = db.query(models.UserAccount).filter(models.UserAccount.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # Link to existing Student record if email matches, otherwise default to S001 for workspace operations
    matched_student = db.query(models.Student).filter(models.Student.email == email).first()
    linked_student_id = matched_student.student_id if matched_student else "S001"

    new_user = models.UserAccount(
        email=email,
        full_name=full_name,
        password_hash=hash_password(payload.password),
        role="student",  # Strictly enforced default role
        student_id=linked_student_id,
        is_active=1,
        failed_login_attempts=0,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return _create_session_for_user(
        db=db,
        user=new_user,
        request=request,
        response=response,
        remember_me=False,
    )


@router.post("/login", response_model=AuthSessionResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Authenticate an existing account using constant-time scrypt verification and lockout protection.
    """
    ip = _client_ip(request)
    auth_rate_limiter.check(f"login:{ip}", max_requests=15, window_seconds=60)

    email = payload.email.strip().lower()
    user = db.query(models.UserAccount).filter(models.UserAccount.email == email).first()

    now = datetime.now(timezone.utc)
    if user and user.locked_until:
        locked_until = ensure_utc(user.locked_until)
        if locked_until and locked_until > now:
            remaining_min = max(1, int((locked_until - now).total_seconds() // 60) + 1)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked due to multiple failed sign-in attempts. Please try again in {remaining_min} minute(s) or reset your password.",
            )

    password_ok = verify_password_constant_time(
        payload.password,
        user.password_hash if user else None,
    )

    if not user or not password_ok:
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.AUTH_MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=settings.AUTH_LOCKOUT_MINUTES)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact campus administration.",
        )

    return _create_session_for_user(
        db=db,
        user=user,
        request=request,
        response=response,
        remember_me=payload.remember_me,
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Revoke the active server-side session and clear authentication cookies.
    """
    session_record, _ = resolve_session_and_user(request, db)
    if session_record:
        session_record.revoked = 1
        db.commit()

    clear_auth_cookies(response)
    return {"status": "logged_out", "message": "Session terminated and revoked."}


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    user: models.UserAccount = Depends(require_authenticated_user),
):
    """
    Return the currently authenticated user's profile and role.
    """
    return _serialize_user(user)


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initiate password recovery without exposing whether the submitted email belongs to an account.
    """
    ip = _client_ip(request)
    auth_rate_limiter.check(f"forgot:{ip}", max_requests=8, window_seconds=60)

    email = payload.email.strip().lower()
    user = db.query(models.UserAccount).filter(models.UserAccount.email == email).first()

    # Always generate token and compute hash to maintain uniform execution path
    raw_reset_token = generate_secure_token(32)
    token_digest = hash_token(raw_reset_token)
    expires_minutes = settings.PASSWORD_RESET_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)

    if user and user.is_active:
        # Invalidate any prior unused reset tokens for this user
        (
            db.query(models.PasswordResetToken)
            .filter(
                models.PasswordResetToken.user_id == user.id,
                models.PasswordResetToken.used == 0,
            )
            .update({"used": 1, "used_at": now})
        )

        reset_record = models.PasswordResetToken(
            user_id=user.id,
            token_hash=token_digest,
            expires_at=now + timedelta(minutes=expires_minutes),
            used=0,
            created_at=now,
        )
        db.add(reset_record)
        db.commit()

        EmailDeliveryService.send_password_reset_email(
            recipient_email=user.email,
            recipient_name=user.full_name,
            raw_reset_token=raw_reset_token,
            expires_minutes=expires_minutes,
        )

    smtp_configured = EmailDeliveryService.is_configured()
    return {
        "status": "accepted",
        "message": (
            "If an account is registered with that email address, password recovery "
            "instructions have been generated."
        ),
        "email_service_configured": smtp_configured,
        "delivery_mode": "smtp" if smtp_configured else "development_outbox",
        "configuration_notice": (
            None
            if smtp_configured
            else "No external SMTP service is configured in backend/.env (SMTP_HOST is unset). "
            "Configure SMTP credentials for live email delivery, or provide a valid reset token on /reset-password."
        ),
    }


@router.get("/verify-reset-token")
def verify_reset_token(
    token: str = Query(..., min_length=16, max_length=256),
    db: Session = Depends(get_db),
):
    """
    Validate whether a password reset token is active, already used, or expired.
    """
    token_digest = hash_token(token.strip())
    record = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == token_digest)
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token.",
        )
    if record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has already been used.",
        )
    now = datetime.now(timezone.utc)
    expires_at = ensure_utc(record.expires_at)
    if not expires_at or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has expired. Please request a new one.",
        )

    return {"valid": True, "expires_at": expires_at}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Complete password replacement using a valid one-time reset token.
    Marks the token used and revokes all prior sessions for the user.
    """
    ip = _client_ip(request)
    auth_rate_limiter.check(f"reset:{ip}", max_requests=10, window_seconds=60)

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    is_strong, strength_err = validate_password_strength(payload.new_password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=strength_err,
        )

    token_digest = hash_token(payload.token.strip())
    record = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == token_digest)
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token.",
        )
    if record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has already been used.",
        )

    now = datetime.now(timezone.utc)
    expires_at = ensure_utc(record.expires_at)
    if not expires_at or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has expired. Please request a new password reset.",
        )

    user = db.query(models.UserAccount).filter(models.UserAccount.id == record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated user account is unavailable.",
        )

    # Update password and clear any account lockouts
    user.password_hash = hash_password(payload.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_at = now

    # Mark token used
    record.used = 1
    record.used_at = now

    # Revoke all active sessions for this user upon password change
    (
        db.query(models.AuthSession)
        .filter(
            models.AuthSession.user_id == user.id,
            models.AuthSession.revoked == 0,
        )
        .update({"revoked": 1})
    )

    db.commit()
    return {
        "status": "password_reset_complete",
        "message": "Your password has been updated. You may now sign in with your new password.",
    }

