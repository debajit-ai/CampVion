"""
CampVion Authentication & Session Management API Routes
Implements account registration, login with brute-force lockout protection,
server-managed HttpOnly sessions, logout/revocation, and secure password recovery.
"""

from datetime import datetime, timedelta, timezone
import hmac
import re
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
    require_admin,
    require_authenticated_user,
    require_student,
    resolve_session_and_user,
    set_auth_cookies,
    validate_password_strength,
    verify_password_constant_time,
)
from app.db import models
from app.db.database import get_db
from app.schemas.auth import (
    AdminProfileUpdateRequest,
    AuthSessionResponse,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    UserProfileResponse,
)
from app.services.email_service import EmailDeliveryService
from app.services import audit_service, student_service

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
        authority_title=getattr(user, "authority_title", None),
        phone=getattr(user, "phone", None),
        office=getattr(user, "office", None),
        office_hours=getattr(user, "office_hours", None),
        contact_email=getattr(user, "contact_email", None),
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
    if full_name.isupper() and len(full_name) > 2:
        full_name = full_name.title()

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

    raw_role = (payload.role or "student").strip().lower()
    # Explicit administrator onboarding requires a verified secret invite code;
    # arbitrary escalation attempts like 'system_administrator' without invite flow remain safely scoped to 'student'.
    is_admin_onboarding = raw_role in {"administrator", "admin"}

    if is_admin_onboarding:
        auth_rate_limiter.check(f"admin_signup:{ip}", max_requests=5, window_seconds=300)
        expected_code = (settings.ADMIN_INVITE_CODE or "").strip()
        supplied_code = (payload.invite_code or "").strip()
        if not expected_code or not hmac.compare_digest(
            supplied_code.encode("utf-8"), expected_code.encode("utf-8")
        ):
            audit_service.record_audit_event(
                db,
                actor_role="anonymous",
                action="signup_admin_denied",
                target_type="user_account",
                target_id=email,
                details={"reason": "invalid_invite_code"},
                ip_address=ip,
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator registration could not be verified with the provided invite code.",
            )

        allowed_titles = {"Warden", "Dean", "Registrar"}
        chosen_title = (payload.authority_title or "Warden").strip()
        if chosen_title not in allowed_titles:
            chosen_title = "Warden"

        new_user = models.UserAccount(
            email=email,
            full_name=full_name,
            password_hash=hash_password(payload.password),
            role="administrator",
            student_id=None,
            authority_title=chosen_title,
            phone=(payload.phone or "").strip() or None,
            office="Administrative Office",
            office_hours="Mon-Fri 10:00-16:00",
            contact_email=email,
            is_active=1,
            failed_login_attempts=0,
        )
        db.add(new_user)
        db.flush()
        audit_service.record_audit_event(
            db,
            actor_user=new_user,
            action="signup_admin",
            target_type="user_account",
            target_id=new_user.id,
            details={"authority_title": chosen_title},
            ip_address=ip,
        )
        db.commit()
        db.refresh(new_user)
    else:
        custom_student_id: Optional[str] = None
        if payload.student_id and payload.student_id.strip():
            custom_student_id = payload.student_id.strip().upper()
            if not re.match(r"^[A-Z0-9_-]{3,20}$", custom_student_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Student ID must be 3-20 alphanumeric characters.",
                )
            dup_user = (
                db.query(models.UserAccount)
                .filter(models.UserAccount.student_id == custom_student_id)
                .first()
            )
            dup_stud = (
                db.query(models.Student)
                .filter(models.Student.student_id == custom_student_id)
                .first()
            )
            if dup_user or dup_stud:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Student ID '{custom_student_id}' is already registered.",
                )

        new_user = models.UserAccount(
            email=email,
            full_name=full_name,
            password_hash=hash_password(payload.password),
            role="student",  # Strictly enforced default role
            student_id=custom_student_id,
            is_active=1,
            failed_login_attempts=0,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        student_service.ensure_student_for_user(db, new_user, preferred_student_id=custom_student_id)
        audit_service.record_audit_event(
            db,
            actor_user=new_user,
            action="signup_student",
            target_type="user_account",
            target_id=new_user.id,
            details={"student_id": new_user.student_id},
            ip_address=ip,
        )
        db.commit()

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
    Always returns a generic failure message to prevent user enumeration.
    """
    ip = _client_ip(request)
    email = payload.email.strip().lower()

    auth_rate_limiter.check(f"login:{ip}:{email}", max_requests=5, window_seconds=60)
    auth_rate_limiter.check(f"login_ip:{ip}", max_requests=30, window_seconds=60)

    user = db.query(models.UserAccount).filter(models.UserAccount.email == email).first()

    now = datetime.now(timezone.utc)
    is_locked = False
    if user and user.locked_until:
        locked_until = ensure_utc(user.locked_until)
        if locked_until and locked_until > now:
            is_locked = True

    password_ok = verify_password_constant_time(
        payload.password,
        user.password_hash if user else None,
    )

    if not user or not password_ok or is_locked or not user.is_active:
        if user and not is_locked:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.AUTH_MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=settings.AUTH_LOCKOUT_MINUTES)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.role == "student":
        student_service.ensure_student_for_user(db, user)

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
    db: Session = Depends(get_db),
):
    """
    Return the currently authenticated user's profile and role.
    """
    if user.role == "student":
        student_service.ensure_student_for_user(db, user)
    return _serialize_user(user)


@router.get("/admin/verify", response_model=UserProfileResponse)
def verify_admin_role(
    user: models.UserAccount = Depends(require_admin),
):
    """Server-side RBAC check restricted exclusively to administrators."""
    return _serialize_user(user)


@router.get("/student/verify", response_model=UserProfileResponse)
def verify_student_role(
    user: models.UserAccount = Depends(require_student),
):
    """Server-side RBAC check restricted to student accounts."""
    return _serialize_user(user)


@router.patch("/profile", response_model=UserProfileResponse)
def update_user_profile(
    payload: AdminProfileUpdateRequest,
    request: Request,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Allow authenticated users (primarily administrators) to update contact metadata."""
    is_admin = (user.role or "").lower() in {"admin", "administrator", "system_administrator"}
    if payload.full_name and payload.full_name.strip():
        cleaned = payload.full_name.strip()
        if cleaned.isupper() and len(cleaned) > 2:
            cleaned = cleaned.title()
        user.full_name = cleaned

    if is_admin:
        if payload.authority_title is not None:
            user.authority_title = payload.authority_title.strip() or "Warden"
        if payload.phone is not None:
            user.phone = payload.phone.strip() or None
        if payload.office is not None:
            user.office = payload.office.strip() or None
        if payload.office_hours is not None:
            user.office_hours = payload.office_hours.strip() or None
        if payload.contact_email is not None:
            user.contact_email = str(payload.contact_email).strip().lower()

    audit_service.record_audit_event(
        db,
        actor_user=user,
        action="profile_update",
        target_type="user_account",
        target_id=user.id,
        ip_address=_client_ip(request),
    )
    db.commit()
    db.refresh(user)
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

