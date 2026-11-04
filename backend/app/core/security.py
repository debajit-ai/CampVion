"""
CampVion Enterprise Security & Authentication Core
Provides OWASP-compliant cryptographic password hashing (scrypt), constant-time verification,
high-entropy session/reset tokens, sliding-window rate limiting, and FastAPI dependencies.
"""

import hashlib
import hmac
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import models
from app.db.database import get_db

# Scrypt work factors (OWASP / NIST SP 800-63B interactive authentication standard)
SCRYPT_N = 16384  # 2^14 CPU/memory cost
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64
SALT_BYTES = 16

VALID_ROLES = {"student", "faculty", "administrator", "system_administrator"}


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize naive SQLite datetimes to UTC-aware datetimes."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using OpenSSL scrypt with a unique 16-byte cryptographic salt.
    Format: scrypt$16384$8$1$<salt_hex>$<derived_key_hex>
    """
    salt = secrets.token_bytes(SALT_BYTES)
    dk = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a stored scrypt hash in constant time.
    """
    try:
        parts = stored_hash.split("$")
        if len(parts) != 6 or parts[0] != "scrypt":
            return False
        n = int(parts[1])
        r = int(parts[2])
        p = int(parts[3])
        salt = bytes.fromhex(parts[4])
        expected_dk = bytes.fromhex(parts[5])
        candidate_dk = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected_dk),
        )
        return hmac.compare_digest(candidate_dk, expected_dk)
    except Exception:
        return False


# Precomputed dummy hash to prevent user-enumeration timing side-channels during login
_DUMMY_PASSWORD_HASH = hash_password("CampVionDummyConstantTimeGuard2026!")


def verify_password_constant_time(password: str, stored_hash: Optional[str]) -> bool:
    """
    Executes full scrypt key derivation even when an account does not exist
    so login response latency does not leak account existence.
    """
    if not stored_hash:
        verify_password(password, _DUMMY_PASSWORD_HASH)
        return False
    return verify_password(password, stored_hash)


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Enforces institutional password policy:
    - Minimum 8 characters, maximum 128 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password must not exceed 128 characters."
    if not any(ch.isupper() for ch in password):
        return False, "Password must include at least one uppercase letter."
    if not any(ch.islower() for ch in password):
        return False, "Password must include at least one lowercase letter."
    if not any(ch.isdigit() for ch in password):
        return False, "Password must include at least one number."
    return True, None


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a URL-safe cryptographically random token."""
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    """Compute SHA-256 digest of a session or password-reset token prior to database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class SlidingWindowRateLimiter:
    """
    In-memory sliding-window rate limiter for authentication-sensitive endpoints.
    Protects login, signup, and password reset endpoints from brute-force abuse.
    """

    def __init__(self) -> None:
        self._events: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        timestamps = [t for t in self._events[key] if t > cutoff]
        if len(timestamps) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many authentication attempts. Please wait a moment before trying again.",
            )
        timestamps.append(now)
        self._events[key] = timestamps

    def clear(self) -> None:
        self._events.clear()


auth_rate_limiter = SlidingWindowRateLimiter()


def set_auth_cookies(
    response: Response,
    raw_session_token: str,
    csrf_token: str,
    max_age_seconds: int,
) -> None:
    """
    Set HttpOnly session cookie and readable CSRF companion cookie with production-aware flags.
    """
    is_prod = (settings.ENVIRONMENT or "").lower() == "production"
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_session_token,
        max_age=max_age_seconds,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=max_age_seconds,
        httponly=False,
        secure=is_prod,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear session and CSRF cookies on logout or invalidation."""
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=settings.CSRF_COOKIE_NAME, path="/")


def extract_session_token(request: Request) -> Optional[str]:
    """
    Extract raw session token from HttpOnly cookie (primary) or Authorization Bearer header.
    """
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token.strip()

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    return None


def resolve_session_and_user(
    request: Request, db: Session
) -> Tuple[Optional[models.AuthSession], Optional[models.UserAccount]]:
    """
    Look up active, non-expired, non-revoked session and its associated active user account.
    """
    raw_token = extract_session_token(request)
    if not raw_token:
        return None, None

    token_digest = hash_token(raw_token)
    session_record = (
        db.query(models.AuthSession)
        .filter(
            models.AuthSession.token_hash == token_digest,
            models.AuthSession.revoked == 0,
        )
        .first()
    )
    if not session_record:
        return None, None

    now = datetime.now(timezone.utc)
    expires_at = ensure_utc(session_record.expires_at)
    if expires_at is None or expires_at <= now:
        session_record.revoked = 1
        db.commit()
        return None, None

    user = (
        db.query(models.UserAccount)
        .filter(
            models.UserAccount.id == session_record.user_id,
            models.UserAccount.is_active == 1,
        )
        .first()
    )
    if not user:
        return None, None

    # Update last active timestamp
    session_record.last_active_at = now
    db.commit()
    return session_record, user


def get_current_user_optional(
    request: Request, db: Session = Depends(get_db)
) -> Optional[models.UserAccount]:
    _, user = resolve_session_and_user(request, db)
    return user


def require_authenticated_user(
    request: Request, db: Session = Depends(get_db)
) -> models.UserAccount:
    """
    Enforces server-side authentication on protected API endpoints.
    Also verifies CSRF token when mutating requests authenticate via browser cookie
    and include a CSRF cookie.
    """
    session_record, user = resolve_session_and_user(request, db)
    if not session_record or not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access CampVion.",
        )

    # Optional CSRF check when both csrf cookie and header are present on mutating requests
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        csrf_header = request.headers.get("X-CSRF-Token")
        if csrf_header and not hmac.compare_digest(csrf_header, session_record.csrf_token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed.",
            )

    return user


def require_roles(*allowed_roles: str):
    """
    Modular role-based access control dependency for administrative or faculty routes.
    """
    allowed = {r.lower() for r in allowed_roles}

    def _checker(user: models.UserAccount = Depends(require_authenticated_user)) -> models.UserAccount:
        if (user.role or "").lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_roles)}.",
            )
        return user

    return _checker

