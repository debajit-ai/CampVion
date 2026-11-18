"""
Public Rate-Limited Gate Pass / Slip Verification Endpoint.
Used by security staff and QR code scans to validate slip authenticity without exposing
sensitive personal phone numbers, email addresses, or private leave reasons.
"""

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core import timezone_utils
from app.core.config import settings
from app.core.security import auth_rate_limiter
from app.db import models
from app.db.database import get_db
from app.services import leave_service, student_service

router = APIRouter()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/{verify_code}")
def verify_leave_slip(
    verify_code: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    auth_rate_limiter.check(f"verify:{_client_ip(request)}", max_requests=60, window_seconds=60)
    clean_code = (verify_code or "").strip()
    if not clean_code or len(clean_code) > 128:
        return {
            "status": "NOT_FOUND",
            "verification_status": "NOT_FOUND",
            "valid": False,
            "message": "Invalid verification code format.",
        }

    leave = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.verify_code == clean_code)
        .first()
    )
    if not leave:
        return {
            "status": "NOT_FOUND",
            "verification_status": "NOT_FOUND",
            "valid": False,
            "message": "No active or historical campus pass matches this verification code.",
        }

    status_norm = leave_service.normalize_leave_status(leave.status)
    now_utc = datetime.now(timezone.utc)
    to_at = timezone_utils.ensure_utc(getattr(leave, "to_at", None))
    from_at = timezone_utils.ensure_utc(getattr(leave, "from_at", None))

    if status_norm == leave_service.STATUS_CANCELLED:
        ver_status = "REVOKED"
        is_valid = False
        message = "This leave slip was cancelled and is no longer valid."
    elif status_norm == leave_service.STATUS_APPROVED:
        if to_at is not None and now_utc > to_at:
            ver_status = "EXPIRED"
            is_valid = False
            message = "This leave window has ended and the gate pass has expired."
        else:
            ver_status = "VALID"
            is_valid = True
            message = "Valid, active institutional leave pass."
    else:
        ver_status = "REVOKED"
        is_valid = False
        message = f"This pass is not currently approved ({status_norm})."

    student = leave.student or student_service.get_student_by_id(db, leave.student_id)
    student_name = leave_service._format_display_name(student.name if student else None, fallback=leave.student_id or "Student")
    college = (
        getattr(leave, "college_snapshot", None)
        or (getattr(student, "college", None) if student else None)
        or "Lovely Professional University"
    )
    approved_at_raw = getattr(leave, "approved_at", None) or leave.decided_at
    authority = leave_service.get_authority_contact(
        db,
        assigned_approver_user_id=leave.assigned_approver_user_id,
        approver_name=leave.decided_by_name or leave.assigned_approver,
        routed_to_role=leave.routed_to_role,
    )

    return {
        "status": ver_status,
        "verification_status": ver_status,
        "valid": is_valid,
        "message": message,
        "slip_no": getattr(leave, "slip_no", None),
        "request_code": leave.leave_code,
        "request_type": (getattr(leave, "request_type", None) or "leave").lower(),
        "student_name": student_name,
        "student_id": leave.student_id,
        "college": college,
        "from_at": timezone_utils.utc_iso(from_at),
        "to_at": timezone_utils.utc_iso(to_at),
        "from_display": timezone_utils.format_campus_dt(from_at) if from_at else leave.start_date,
        "to_display": timezone_utils.format_campus_dt(to_at) if to_at else leave.end_date,
        "exit_gate": getattr(leave, "exit_gate", None),
        "entry_gate": getattr(leave, "entry_gate", None),
        "approved_by": leave.decided_by_name or authority.get("name"),
        "approver_role": authority.get("title") or "Warden",
        "approved_at_display": timezone_utils.format_campus_dt(approved_at_raw) if approved_at_raw else None,
        "campus_tz": settings.CAMPUS_TZ,
    }
