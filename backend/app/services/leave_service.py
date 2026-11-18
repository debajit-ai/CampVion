"""
Centralized Leave Request State Machine, Concurrency Control, Notifications & Audit Coordinator.
Single source of truth for DRAFT -> PENDING_APPROVAL -> APPROVED | REJECTED | CANCELLED.
"""

import json
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.core import timezone_utils
from app.core.config import settings
from app.core.security import is_admin_role
from app.db import models
from app.services import audit_service, events_service, student_service
from app.tools.campus_tools import CheckLeaveEligibilityTool

logger = logging.getLogger("campvion.leave_service")

ADMIN_ROLES = {"admin", "administrator", "system_administrator"}

REQUEST_TYPE_LABELS: Dict[str, str] = {
    "leave": "Leave",
    "library_room": "Library room booking",
    "hostel_allocation": "Hostel allocation",
    "certificate": "Certificate",
}

REQUEST_CODE_PREFIXES: Dict[str, str] = {
    "leave": "LV",
    "library_room": "LIB",
    "hostel_allocation": "HST",
    "certificate": "CRT",
}


def get_request_type_label(request_type: Optional[str]) -> str:
    key = (request_type or "leave").strip().lower()
    return REQUEST_TYPE_LABELS.get(key, key.replace("_", " ").title())

# Canonical Leave Statuses
STATUS_DRAFT = "DRAFT"
STATUS_PENDING_APPROVAL = "PENDING_APPROVAL"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_CANCELLED = "CANCELLED"

ALLOWED_TRANSITIONS: Dict[str, set[str]] = {
    STATUS_DRAFT: {STATUS_PENDING_APPROVAL, STATUS_CANCELLED},
    STATUS_PENDING_APPROVAL: {STATUS_APPROVED, STATUS_REJECTED, STATUS_CANCELLED},
    STATUS_APPROVED: {STATUS_CANCELLED},  # Guarded by before-from_at check in cancel_leave_request
    STATUS_REJECTED: set(),
    STATUS_CANCELLED: set(),
}


def normalize_leave_status(raw_status: Optional[str]) -> str:
    val = (raw_status or "").strip().upper()
    if val in {"PENDING", "PENDING_APPROVAL", "WAITING_FOR_HUMAN"}:
        return STATUS_PENDING_APPROVAL
    if val in {"APPROVED", "COMPLETED"}:
        return STATUS_APPROVED
    if val in {"REJECTED", "ENDED_REJECTED"}:
        return STATUS_REJECTED
    if val in {"CANCELLED", "CANCELED"}:
        return STATUS_CANCELLED
    if val == "DRAFT":
        return STATUS_DRAFT
    return val or STATUS_PENDING_APPROVAL


def ensure_valid_transition(current_status: str, target_status: str) -> None:
    cur = normalize_leave_status(current_status)
    nxt = normalize_leave_status(target_status)
    if nxt not in ALLOWED_TRANSITIONS.get(cur, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition leave request from {cur} to {nxt}. This request may already be decided.",
        )


def compute_date_range(start_date_hint: Optional[str], days_count: int) -> Tuple[str, str]:
    effective_days = max(1, int(days_count or 1))
    now_utc = datetime.now(timezone.utc)
    start_dt = now_utc + timedelta(days=1)

    if start_date_hint:
        hint = str(start_date_hint).strip()
        iso_match = re.search(r"(\d{4}-\d{2}-\d{2})", hint)
        if iso_match:
            try:
                start_dt = datetime.strptime(iso_match.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        elif "today" in hint.lower():
            start_dt = now_utc
        elif "tomorrow" in hint.lower():
            start_dt = now_utc + timedelta(days=1)
        else:
            # Try DD Month YYYY format produced by resolve_human_date (e.g., "19 November 2026")
            clean_hint = re.sub(r"\s*\([^)]*\)", "", hint).strip()
            for fmt in ("%d %B %Y", "%d %b %Y", "%B %d %Y"):
                try:
                    start_dt = datetime.strptime(clean_hint, fmt).replace(tzinfo=timezone.utc)
                    break
                except ValueError:
                    continue
            else:
                # Handle dates like "6 November" where the year was omitted
                hint_no_ord = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", clean_hint, flags=re.IGNORECASE)
                for fmt in ("%d %B %Y", "%d %b %Y", "%B %d %Y"):
                    try:
                        start_dt = datetime.strptime(f"{hint_no_ord} {now_utc.year}", fmt).replace(tzinfo=timezone.utc)
                        break
                    except ValueError:
                        continue

    end_dt = start_dt + timedelta(days=effective_days - 1)
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def find_overlapping_pending_leave(
    db: Session,
    student_id: str,
    start_date: str,
    end_date: str,
    exclude_workflow_run_id: Optional[int] = None,
) -> Optional[models.LeaveRequest]:
    pending_rows = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.student_id == student_id)
        .all()
    )
    for row in pending_rows:
        if (getattr(row, "request_type", None) or "leave").lower() != "leave":
            continue
        if normalize_leave_status(row.status) != STATUS_PENDING_APPROVAL:
            continue
        if exclude_workflow_run_id is not None and row.workflow_run_id == exclude_workflow_run_id:
            continue
        if row.start_date <= end_date and row.end_date >= start_date:
            return row
    return None


def generate_unique_leave_code(db: Session, request_type: str = "leave") -> str:
    year = datetime.now(timezone.utc).year
    prefix = REQUEST_CODE_PREFIXES.get((request_type or "leave").strip().lower(), "RQ")
    rows = db.query(models.LeaveRequest.leave_code).all()
    max_seq = 0
    for (code,) in rows:
        if code and "-" in code:
            tail = code.rsplit("-", 1)[-1]
            if tail.isdigit():
                max_seq = max(max_seq, int(tail))
    return f"{prefix}-{year}-{(max_seq + 1):04d}"


def generate_unique_slip_no(db: Session) -> str:
    year = timezone_utils.campus_now().year
    rows = db.query(models.LeaveRequest.slip_no).all()
    max_seq = 0
    for (sno,) in rows:
        if sno and "-" in sno:
            tail = sno.rsplit("-", 1)[-1]
            if tail.isdigit():
                max_seq = max(max_seq, int(tail))
    return f"LS-{year}-{(max_seq + 1):06d}"


def generate_unique_verify_code(db: Session) -> str:
    for _ in range(12):
        cand = secrets.token_urlsafe(12)
        exists = db.query(models.LeaveRequest.id).filter(models.LeaveRequest.verify_code == cand).first()
        if not exists:
            return cand
    return secrets.token_urlsafe(16)


def validate_leave_window_v2(
    db: Session,
    *,
    student_id: str,
    from_at: datetime,
    to_at: datetime,
    category: str,
    reason: str,
    college: Optional[str] = None,
    exclude_workflow_run_id: Optional[int] = None,
) -> None:
    from_utc = timezone_utils.ensure_utc(from_at)
    to_utc = timezone_utils.ensure_utc(to_at)
    now_utc = datetime.now(timezone.utc)

    if from_utc is None or to_utc is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both departure (from) and return (to) date and time are required.",
        )
    if from_utc < now_utc - timedelta(minutes=2):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Leave start date and time cannot be in the past.",
        )
    if to_utc <= from_utc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Leave return date and time must be strictly after departure time.",
        )
    max_days = max(1, int(settings.LEAVE_MAX_DAYS or 30))
    if (to_utc - from_utc) > timedelta(days=max_days):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Leave duration cannot exceed {max_days} days.",
        )
    if not (category or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please choose a leave type.",
        )
    if len((reason or "").strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a short reason for your leave (at least 3 characters).",
        )
    if college is not None and len(college.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please select or enter a valid college / institution.",
        )

    from_campus = timezone_utils.to_campus(from_utc)
    to_campus = timezone_utils.to_campus(to_utc)
    start_iso = from_campus.date().isoformat()
    end_iso = to_campus.date().isoformat()

    existing_rows = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.student_id == student_id)
        .all()
    )
    for row in existing_rows:
        if (getattr(row, "request_type", None) or "leave").lower() != "leave":
            continue
        st = normalize_leave_status(row.status)
        if st not in {STATUS_PENDING_APPROVAL, STATUS_APPROVED}:
            continue
        if exclude_workflow_run_id is not None and row.workflow_run_id == exclude_workflow_run_id:
            continue
        if row.from_at and row.to_at:
            r_from = timezone_utils.ensure_utc(row.from_at)
            r_to = timezone_utils.ensure_utc(row.to_at)
            if r_from < to_utc and r_to > from_utc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"You already have a {st.replace('_', ' ').lower()} leave ({row.leave_code}) "
                        f"covering {timezone_utils.format_campus_dt(r_from)} to {timezone_utils.format_campus_dt(r_to)}."
                    ),
                )
        elif row.start_date and row.end_date:
            if row.start_date <= end_iso and row.end_date >= start_iso:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"You already have a {st.replace('_', ' ').lower()} leave ({row.leave_code}) "
                        f"covering {row.start_date} to {row.end_date}."
                    ),
                )


def validate_library_time_window(from_utc: datetime, to_utc: datetime) -> None:
    now_utc = datetime.now(timezone.utc)
    f_utc = timezone_utils.ensure_utc(from_utc)
    t_utc = timezone_utils.ensure_utc(to_utc)
    if f_utc is None or t_utc is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide booking date, start time, and end time.",
        )
    if f_utc < now_utc - timedelta(minutes=2):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Room booking start time cannot be in the past.",
        )
    if t_utc <= f_utc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Booking end time must be after start time.",
        )
    if (t_utc - f_utc) > timedelta(hours=2):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Discussion rooms can be reserved for at most 2 hours per session.",
        )
    f_c = timezone_utils.to_campus(f_utc)
    t_c = timezone_utils.to_campus(t_utc)
    if f_c.date() != t_c.date():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Discussion room booking must start and end on the same calendar day.",
        )
    open_hr = int(settings.LIBRARY_OPEN_HOUR or 8)
    close_hr = int(settings.LIBRARY_CLOSE_HOUR or 20)
    if f_c.hour < open_hr or t_c.hour > close_hr or (t_c.hour == close_hr and t_c.minute > 0):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Library discussion rooms are open from {open_hr:02d}:00 to {close_hr:02d}:00 IST.",
        )


def find_occupied_library_rooms(
    db: Session,
    *,
    from_utc: datetime,
    to_utc: datetime,
    exclude_leave_id: Optional[int] = None,
) -> Dict[str, str]:
    f_utc = timezone_utils.ensure_utc(from_utc)
    t_utc = timezone_utils.ensure_utc(to_utc)
    occupied: Dict[str, str] = {}
    rows = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.request_type == "library_room")
        .all()
    )
    for r in rows:
        if exclude_leave_id is not None and r.id == exclude_leave_id:
            continue
        if normalize_leave_status(r.status) not in {STATUS_PENDING_APPROVAL, STATUS_APPROVED}:
            continue
        if not r.from_at or not r.to_at:
            continue
        r_from = timezone_utils.ensure_utc(r.from_at)
        r_to = timezone_utils.ensure_utc(r.to_at)
        if r_from < t_utc and r_to > f_utc:
            try:
                det = json.loads(r.details_json) if r.details_json else {}
            except Exception:
                det = {}
            msg = (
                f"Booked ({r.leave_code}: {timezone_utils.format_campus_time_12h(r_from)} - "
                f"{timezone_utils.format_campus_time_12h(r_to)})"
            )
            if det.get("room_id") is not None:
                occupied[f"id:{det['room_id']}"] = msg
            if det.get("room_code"):
                occupied[f"code:{str(det['room_code']).lower()}"] = msg
            if det.get("room_name") or det.get("room"):
                occupied[f"name:{str(det.get('room_name') or det.get('room')).lower()}"] = msg
    return occupied


def validate_library_booking_v2(
    db: Session,
    *,
    student_id: str,
    from_utc: datetime,
    to_utc: datetime,
    room_id: Optional[int] = None,
    room_name: Optional[str] = None,
    room_code: Optional[str] = None,
    people: int = 2,
    exclude_leave_id: Optional[int] = None,
) -> models.DiscussionRoom:
    validate_library_time_window(from_utc, to_utc)

    from app.db.seed_v2 import seed_discussion_rooms
    if db.query(models.DiscussionRoom).count() == 0:
        seed_discussion_rooms(db)

    room: Optional[models.DiscussionRoom] = None
    if room_id is not None:
        room = db.query(models.DiscussionRoom).filter(models.DiscussionRoom.id == int(room_id)).first()
    if not room and room_code:
        room = (
            db.query(models.DiscussionRoom)
            .filter(func.lower(models.DiscussionRoom.room_code) == room_code.strip().lower())
            .first()
        )
    if not room and room_name:
        room = (
            db.query(models.DiscussionRoom)
            .filter(func.lower(models.DiscussionRoom.name) == room_name.strip().lower())
            .first()
        )
    if not room or not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected discussion room was not found or is inactive.",
        )

    if int(people or 1) > room.capacity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{room.name} seats up to {room.capacity} people, which is smaller than your group of {people}.",
        )

    target_day = timezone_utils.to_campus(from_utc).date().isoformat()
    student_bookings = (
        db.query(models.LeaveRequest)
        .filter(
            models.LeaveRequest.student_id == student_id,
            models.LeaveRequest.request_type == "library_room",
        )
        .all()
    )
    for b in student_bookings:
        if exclude_leave_id is not None and b.id == exclude_leave_id:
            continue
        if normalize_leave_status(b.status) not in {STATUS_PENDING_APPROVAL, STATUS_APPROVED}:
            continue
        b_day = (
            timezone_utils.to_campus(b.from_at).date().isoformat()
            if b.from_at
            else (b.start_date or "")
        )
        if b_day == target_day:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"You already have an active library room booking ({b.leave_code}) on {target_day}. "
                    "Only 1 active discussion room booking per day is allowed."
                ),
            )

    occupied = find_occupied_library_rooms(
        db,
        from_utc=from_utc,
        to_utc=to_utc,
        exclude_leave_id=exclude_leave_id,
    )
    conflict = (
        occupied.get(f"id:{room.id}")
        or occupied.get(f"code:{room.room_code.lower()}")
        or occupied.get(f"name:{room.name.lower()}")
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{room.name} is already reserved during that time ({conflict}). Please choose another room or time slot.",
        )

    return room


def get_authority_contact(
    db: Session,
    assigned_approver_user_id: Optional[int] = None,
    approver_name: Optional[str] = None,
    routed_to_role: Optional[str] = None,
) -> Dict[str, Any]:
    admin_user: Optional[models.UserAccount] = None
    if assigned_approver_user_id:
        admin_user = (
            db.query(models.UserAccount)
            .filter(models.UserAccount.id == assigned_approver_user_id)
            .first()
        )
    if not admin_user and approver_name:
        admin_user = (
            db.query(models.UserAccount)
            .filter(
                func.lower(models.UserAccount.role).in_(list(ADMIN_ROLES)),
                models.UserAccount.full_name == approver_name,
            )
            .first()
        )
    if not admin_user:
        admin_user = (
            db.query(models.UserAccount)
            .filter(
                func.lower(models.UserAccount.role).in_(list(ADMIN_ROLES)),
                models.UserAccount.is_active == 1,
            )
            .order_by(models.UserAccount.id.asc())
            .first()
        )

    return {
        "user_id": admin_user.id if admin_user else None,
        "name": (admin_user.full_name if admin_user else None) or approver_name or "Dr. Rajesh Rao",
        "title": (admin_user.authority_title if admin_user and admin_user.authority_title else None)
        or routed_to_role
        or "Warden",
        "email": (
            (admin_user.contact_email or admin_user.email)
            if admin_user
            else "admin@campvion.edu"
        ),
        "phone": (admin_user.phone if admin_user and admin_user.phone else None) or "+91 98765 01042",
        "office": (admin_user.office if admin_user and admin_user.office else None)
        or "Hostel Block A, Warden Office",
        "office_hours": (admin_user.office_hours if admin_user and admin_user.office_hours else None)
        or "Mon-Fri 10:00-16:00",
    }


def get_primary_warden(db: Session) -> Tuple[Optional[models.UserAccount], str, str]:
    contact = get_authority_contact(db)
    uid = contact.get("user_id")
    admin = db.query(models.UserAccount).filter(models.UserAccount.id == uid).first() if uid else None
    return admin, str(contact["name"]), str(contact["title"])


def build_leave_snapshots(
    db: Session,
    student_id: str,
    days_count: int = 1,
    category: str = "personal",
    reason: str = "",
) -> Tuple[Optional[models.Student], float, Dict[str, Any]]:
    student = student_service.get_student_by_id(db, student_id)
    elig_tool = CheckLeaveEligibilityTool()
    elig = elig_tool.execute(
        db=db,
        student_id=student_id,
        days=days_count,
        category=category,
        reason=reason,
    )
    att_pct = float(elig.get("attendance_percentage", 0.0) or 0.0)
    policy_result = {
        "eligible": bool(elig.get("eligible")),
        "status": elig.get("status"),
        "reason": elig.get("reason"),
        "attendance_percentage": att_pct,
        "required_threshold": 75.0,
        "policy_applied": elig.get("policy_applied") or "POL-ATT-001 / POL-LV-001",
        "policy_provenance": elig.get("policy_provenance") or "illustrative_demo",
        "assigned_approver": elig.get("assigned_approver") or "Dr. Rajesh Rao",
        "approver_role": elig.get("approver_role") or "Warden",
        "requires_documentation": bool(elig.get("requires_documentation")),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    return student, att_pct, policy_result


def _find_student_user_account(db: Session, student_id: str) -> Optional[models.UserAccount]:
    user = (
        db.query(models.UserAccount)
        .filter(models.UserAccount.student_id == student_id, models.UserAccount.is_active == 1)
        .first()
    )
    if user:
        return user
    student = student_service.get_student_by_id(db, student_id)
    if student and student.email:
        return (
            db.query(models.UserAccount)
            .filter(models.UserAccount.email == student.email.lower())
            .first()
        )
    return None


def _get_active_admins(db: Session) -> List[models.UserAccount]:
    return (
        db.query(models.UserAccount)
        .filter(func.lower(models.UserAccount.role).in_(list(ADMIN_ROLES)), models.UserAccount.is_active == 1)
        .all()
    )


def _format_display_name(name: Optional[str], fallback: str = "Student") -> str:
    if not name:
        return fallback
    cleaned = name.strip()
    if cleaned.isupper() and len(cleaned) > 2:
        return cleaned.title()
    return cleaned


def serialize_leave_request(db: Session, leave: models.LeaveRequest, include_workflow: bool = True) -> Dict[str, Any]:
    req_type = (getattr(leave, "request_type", None) or "leave").lower()
    student = leave.student or student_service.get_student_by_id(db, leave.student_id)
    decider = (
        db.query(models.UserAccount).filter(models.UserAccount.id == leave.decided_by).first()
        if leave.decided_by
        else None
    )
    authority = get_authority_contact(
        db,
        assigned_approver_user_id=leave.assigned_approver_user_id,
        approver_name=decider.full_name if decider else leave.assigned_approver,
        routed_to_role=(decider.authority_title if decider and decider.authority_title else leave.routed_to_role),
    )

    try:
        policy_data = json.loads(leave.policy_result) if leave.policy_result else {}
    except Exception:
        policy_data = {}

    workflow_info: Optional[Dict[str, Any]] = None
    trace_events: List[Dict[str, Any]] = []
    if include_workflow and leave.workflow_run_id:
        agent_model = (
            db.query(models.AgentStateModel)
            .filter(models.AgentStateModel.request_id == leave.workflow_run_id)
            .first()
        )
        if agent_model:
            try:
                st = json.loads(agent_model.state_data)
                workflow_info = {
                    "request_id": leave.workflow_run_id,
                    "current_status": st.get("current_status"),
                    "human_approval_status": st.get("human_approval_status"),
                    "completed_tasks": st.get("completed_tasks", []),
                    "pending_tasks": st.get("pending_tasks", []),
                    "failed_tasks": st.get("failed_tasks", []),
                    "plan": st.get("plan", []),
                }
            except Exception:
                workflow_info = None

        traces = (
            db.query(models.DecisionTrace)
            .filter(models.DecisionTrace.request_id == leave.workflow_run_id)
            .order_by(models.DecisionTrace.step_number.asc())
            .all()
        )
        trace_events = [
            {
                "id": t.id,
                "step_number": t.step_number,
                "event_type": t.event_type,
                "component": t.component,
                "action": t.action,
                "status": t.status,
                "error_message": t.error_message,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            }
            for t in traces
        ]

    try:
        details_dict = json.loads(leave.details_json) if getattr(leave, "details_json", None) else {}
        if not isinstance(details_dict, dict):
            details_dict = {}
    except Exception:
        details_dict = {}

    if not isinstance(policy_data, dict):
        policy_data = {}

    days_val = int(leave.days_count) if leave.days_count is not None else 1
    code_val = leave.leave_code or f"REQ-{leave.id}"
    cat_val = (leave.category or req_type or "general").strip()
    start_val = leave.start_date or ""
    end_val = leave.end_date or start_val

    if req_type == "leave":
        day_word = "day" if days_val == 1 else "days"
        default_title = f"{cat_val.replace('_', ' ').title()} Leave ({days_val} {day_word})"
    else:
        default_title = f"{get_request_type_label(req_type)} Request"

    reason_val = leave.reason or getattr(leave, "title", None) or default_title
    status_norm = normalize_leave_status(leave.status)
    submitted_iso = (leave.submitted_at or leave.created_at).isoformat() if (leave.submitted_at or leave.created_at) else None
    decided_iso = leave.decided_at.isoformat() if leave.decided_at else None
    from_at_val = getattr(leave, "from_at", None)
    to_at_val = getattr(leave, "to_at", None)
    approved_at_raw = getattr(leave, "approved_at", None) or (leave.decided_at if status_norm == STATUS_APPROVED else None)
    college_val = (
        getattr(leave, "college_snapshot", None)
        or (getattr(student, "college", None) if student else None)
        or "Lovely Professional University"
    )
    res_type = (getattr(student, "residence_type", None) or "").lower() if student else ""
    h_block = getattr(student, "hostel_block", None) if student else None
    h_room = (getattr(student, "hostel_room", None) or getattr(student, "room_number", None)) if student else None
    if h_block and h_room:
        residence_label = f"{h_block} • Room {h_room}"
    elif res_type == "hosteller":
        residence_label = "Hosteller"
    elif res_type == "day_scholar":
        residence_label = "Day Scholar"
    else:
        residence_label = "Registered Student"

    has_slip = bool(
        status_norm == STATUS_APPROVED
        and getattr(leave, "slip_no", None)
        and (
            (req_type == "leave" and from_at_val is not None and to_at_val is not None)
            or req_type in {"library_room", "hostel_allocation"}
        )
    )
    now_utc = datetime.now(timezone.utc)
    can_cancel = bool(
        status_norm in {STATUS_PENDING_APPROVAL, STATUS_DRAFT}
        or (
            status_norm == STATUS_APPROVED
            and from_at_val is not None
            and timezone_utils.ensure_utc(from_at_val) > now_utc
        )
    )

    return {
        "id": leave.id,
        "leave_code": code_val,
        "request_code": code_val,
        "request_type": req_type,
        "request_type_label": get_request_type_label(req_type),
        "title": getattr(leave, "title", None) or default_title,
        "details": details_dict,
        "workflow_run_id": leave.workflow_run_id,
        "student_id": leave.student_id or "",
        "student_name": _format_display_name(student.name if student else None, fallback=leave.student_id or "Student"),
        "student_email": student.email if student else None,
        "student_program": student.program if student else None,
        "student_semester": student.semester if student else None,
        "student_department": student.department if student else None,
        "student_college": college_val,
        "college": college_val,
        "student_residence_type": res_type or None,
        "student_residence_label": residence_label,
        "student_hostel_block": h_block,
        "student_room_number": h_room,
        "category": cat_val,
        "start_date": start_val,
        "end_date": end_val,
        "days_count": days_val,
        "from_at": timezone_utils.utc_iso(from_at_val),
        "to_at": timezone_utils.utc_iso(to_at_val),
        "from_at_campus": timezone_utils.campus_iso(from_at_val),
        "to_at_campus": timezone_utils.campus_iso(to_at_val),
        "from_display": timezone_utils.format_campus_dt(from_at_val) if from_at_val else None,
        "to_display": timezone_utils.format_campus_dt(to_at_val) if to_at_val else None,
        "from_day": timezone_utils.format_day_name(from_at_val or start_val),
        "to_day": timezone_utils.format_day_name(to_at_val or end_val),
        "campus_tz": settings.CAMPUS_TZ,
        "destination": getattr(leave, "destination", None),
        "exit_gate": getattr(leave, "exit_gate", None),
        "entry_gate": getattr(leave, "entry_gate", None),
        "slip_no": getattr(leave, "slip_no", None),
        "verify_code": getattr(leave, "verify_code", None),
        "approved_at": timezone_utils.utc_iso(approved_at_raw),
        "approved_at_display": timezone_utils.format_campus_dt(approved_at_raw) if approved_at_raw else None,
        "has_slip": has_slip,
        "can_cancel": can_cancel,
        "reason": reason_val,
        "doc_required": bool(leave.doc_required),
        "status": status_norm,
        "attendance_snapshot": leave.attendance_snapshot,
        "policy_result": policy_data,
        "routed_to_role": leave.routed_to_role or leave.approver_role or "Warden",
        "assigned_approver": authority["name"],
        "approver_role": authority["title"],
        "authority_contact": authority,
        "decided_by": leave.decided_by,
        "decided_by_name": leave.decided_by_name or (decider.full_name if decider else None),
        "decision_comment": leave.decision_comment or leave.decision_remarks,
        "rejection_reason": leave.rejection_reason,
        "submitted_at": submitted_iso,
        "decided_at": decided_iso,
        "created_at": (leave.created_at or leave.submitted_at).isoformat() if (leave.created_at or leave.submitted_at) else None,
        "updated_at": (leave.updated_at or leave.decided_at or leave.submitted_at).isoformat() if (leave.updated_at or leave.decided_at or leave.submitted_at) else None,
        "version": leave.version or 1,
        "workflow": workflow_info,
        "traces": trace_events,
    }


def _build_notification_payload(leave_dict: Dict[str, Any], message: str) -> str:
    return json.dumps(
        {
            "leave_request": leave_dict,
            "message": message,
        },
        default=str,
    )


def submit_leave_at_gate(
    db: Session,
    *,
    student_id: str,
    workflow_run_id: Optional[int],
    days_count: int,
    category: str,
    reason: str,
    start_date_hint: Optional[str] = None,
    from_at: Optional[datetime] = None,
    to_at: Optional[datetime] = None,
    destination: Optional[str] = None,
    college_snapshot: Optional[str] = None,
    actor_user: Optional[models.UserAccount] = None,
    ip_address: Optional[str] = None,
    enforce_overlap_check: bool = True,
) -> Tuple[models.LeaveRequest, Dict[str, Any]]:
    """
    Create or retrieve a PENDING_APPROVAL LeaveRequest when hitting create_leave_application gate.
    Creates transactional admin notification(s) & audit entry, commits, then broadcasts SSE events.
    """
    if workflow_run_id is not None:
        existing = (
            db.query(models.LeaveRequest)
            .filter(models.LeaveRequest.workflow_run_id == workflow_run_id)
            .first()
        )
        if existing:
            return existing, serialize_leave_request(db, existing, include_workflow=False)

    from_utc = timezone_utils.ensure_utc(from_at) if from_at else None
    to_utc = timezone_utils.ensure_utc(to_at) if to_at else None

    if from_utc is not None and to_utc is not None:
        validate_leave_window_v2(
            db,
            student_id=student_id,
            from_at=from_utc,
            to_at=to_utc,
            category=category,
            reason=reason,
            college=college_snapshot,
            exclude_workflow_run_id=workflow_run_id,
        )
        from_c = timezone_utils.to_campus(from_utc)
        to_c = timezone_utils.to_campus(to_utc)
        start_date = from_c.date().isoformat()
        end_date = to_c.date().isoformat()
        computed_days = max(1, (to_c.date() - from_c.date()).days + 1)
    else:
        start_date, end_date = compute_date_range(start_date_hint, days_count)
        computed_days = max(1, int(days_count or 1))
        if enforce_overlap_check:
            overlap = find_overlapping_pending_leave(
                db,
                student_id=student_id,
                start_date=start_date,
                end_date=end_date,
                exclude_workflow_run_id=workflow_run_id,
            )
            if overlap:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"You already have a pending leave request ({overlap.leave_code}) covering "
                        f"{overlap.start_date} to {overlap.end_date}. Please wait for a decision or withdraw {overlap.leave_code} first."
                    ),
                )

    student, att_snapshot, policy_result = build_leave_snapshots(
        db, student_id=student_id, days_count=computed_days, category=category, reason=reason
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if not policy_result.get("eligible"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=policy_result.get("reason") or "Student is not eligible for leave under institutional policy.",
        )

    resolved_college = (
        (college_snapshot or "").strip()
        or (getattr(student, "college", None) or "").strip()
        or "Lovely Professional University"
    )
    clean_dest = (destination or "").strip() or None

    admin_user, approver_name, approver_title = get_primary_warden(db)
    routed_role = approver_title or "Warden"
    now = datetime.now(timezone.utc)
    leave_code = generate_unique_leave_code(db)

    leave_record = models.LeaveRequest(
        leave_code=leave_code,
        workflow_run_id=workflow_run_id,
        student_id=student.student_id,
        category=(category or "personal").lower(),
        start_date=start_date,
        end_date=end_date,
        days_count=computed_days,
        from_at=from_utc,
        to_at=to_utc,
        college_snapshot=resolved_college,
        destination=clean_dest,
        reason=reason or "Personal leave",
        supporting_doc_url=None,
        doc_required=1 if policy_result.get("requires_documentation") else 0,
        status=STATUS_PENDING_APPROVAL,
        attendance_snapshot=att_snapshot,
        policy_result=json.dumps(policy_result),
        routed_to_role=routed_role,
        assigned_approver=approver_name,
        approver_role=routed_role,
        assigned_approver_user_id=admin_user.id if admin_user else None,
        submitted_at=now,
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(leave_record)
    db.flush()

    resolved_actor = actor_user or _find_student_user_account(db, student.student_id)
    audit_service.record_audit_event(
        db,
        actor_user=resolved_actor,
        actor_role="student" if not resolved_actor else resolved_actor.role,
        action="submit",
        target_type="leave_request",
        target_id=leave_record.id,
        details={
            "leave_code": leave_record.leave_code,
            "workflow_run_id": workflow_run_id,
            "days_count": leave_record.days_count,
            "start_date": start_date,
            "end_date": end_date,
            "attendance_snapshot": att_snapshot,
        },
        ip_address=ip_address,
    )

    leave_payload = serialize_leave_request(db, leave_record, include_workflow=False)

    admins = _get_active_admins(db)
    admin_notifications: List[models.Notification] = []
    student_display = _format_display_name(student.name, student.student_id)
    notif_title = f"New Leave Request from {student_display}"
    notif_body = (
        f"{leave_record.leave_code}: {leave_record.days_count} day(s) "
        f"({leave_record.start_date} to {leave_record.end_date}) — {leave_record.reason}"
    )
    for adm in admins:
        n = models.Notification(
            user_id=adm.id,
            leave_request_id=leave_record.id,
            event_type="request.created",
            title=notif_title,
            body=notif_body,
            payload_json=_build_notification_payload(leave_payload, notif_body),
            created_at=now,
        )
        db.add(n)
        admin_notifications.append(n)

    db.commit()
    db.refresh(leave_record)
    leave_payload = serialize_leave_request(db, leave_record, include_workflow=True)

    # Publish SSE events AFTER transaction commit
    first_notif_id = str(admin_notifications[0].id) if admin_notifications else None
    event_broker = events_service.event_broker
    target_uids = []
    if resolved_actor:
        target_uids.append(resolved_actor.id)

    event_broker.publish(
        event_type="request.created",
        payload={"request": leave_payload, "notification_title": notif_title, "notification_body": notif_body},
        target_user_ids=target_uids,
        target_roles=list(ADMIN_ROLES),
        event_id=first_notif_id,
    )
    for n in admin_notifications:
        event_broker.publish(
            event_type="notification.created",
            payload={
                "notification": {
                    "id": n.id,
                    "leave_request_id": n.leave_request_id,
                    "event_type": n.event_type,
                    "title": n.title,
                    "body": n.body,
                    "read_at": None,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "request": leave_payload,
                }
            },
            target_user_ids=[n.user_id],
            event_id=str(n.id),
        )

    return leave_record, leave_payload


def _apply_optimistic_decision(
    db: Session,
    leave: models.LeaveRequest,
    *,
    target_status: str,
    expected_version: Optional[int],
    actor_user: Optional[models.UserAccount],
    decision_comment: Optional[str],
    rejection_reason: Optional[str],
    extra_fields: Optional[Dict[str, Any]] = None,
) -> models.LeaveRequest:
    ensure_valid_transition(leave.status, target_status)
    version_to_match = expected_version if expected_version is not None else (leave.version or 1)
    now = datetime.now(timezone.utc)

    update_values: Dict[str, Any] = {
        "status": target_status,
        "decided_at": now,
        "decided_by": actor_user.id if actor_user else None,
        "decided_by_name": actor_user.full_name if actor_user else "Dr. Rajesh Rao",
        "updated_at": now,
        "version": version_to_match + 1,
    }
    if decision_comment is not None:
        update_values["decision_comment"] = decision_comment
        update_values["decision_remarks"] = decision_comment
    if rejection_reason is not None:
        update_values["rejection_reason"] = rejection_reason
        if not decision_comment:
            update_values["decision_remarks"] = rejection_reason
    if extra_fields:
        update_values.update(extra_fields)

    stmt = (
        update(models.LeaveRequest)
        .where(
            models.LeaveRequest.id == leave.id,
            models.LeaveRequest.version == version_to_match,
        )
        .values(**update_values)
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This request has already been decided or modified by another action. Queue refreshed.",
        )
    db.flush()
    db.refresh(leave)
    return leave


def approve_leave_request(
    db: Session,
    *,
    leave_id: Optional[int] = None,
    workflow_run_id: Optional[int] = None,
    actor_user: models.UserAccount,
    comment: Optional[str] = None,
    expected_version: Optional[int] = None,
    exit_gate: Optional[str] = None,
    entry_gate: Optional[str] = None,
    room_id: Optional[int] = None,
    room_name: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[models.LeaveRequest, Dict[str, Any], Optional[Any]]:
    leave = None
    if leave_id is not None:
        leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    elif workflow_run_id is not None:
        leave = (
            db.query(models.LeaveRequest)
            .filter(models.LeaveRequest.workflow_run_id == workflow_run_id)
            .first()
        )

    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if normalize_leave_status(leave.status) != STATUS_PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Leave request {leave.leave_code} is already {normalize_leave_status(leave.status)}.",
        )

    req_type_pre = (getattr(leave, "request_type", None) or "leave").lower()
    student_obj = leave.student or student_service.get_student_by_id(db, leave.student_id)
    now_utc = datetime.now(timezone.utc)
    extra_fields: Dict[str, Any] = {"approved_at": now_utc}
    audit_extra: Dict[str, Any] = {}

    if req_type_pre == "leave":
        is_hosteller = bool(
            student_obj
            and ((getattr(student_obj, "residence_type", "") or "").lower() == "hosteller" or getattr(student_obj, "hostel_block", None))
        )
        default_gate = "Gate 2 - Hostel Gate" if is_hosteller else "Gate 1 - Main Gate"
        chosen_exit = (exit_gate or "").strip() or default_gate
        chosen_entry = (entry_gate or "").strip() or chosen_exit
        extra_fields["exit_gate"] = chosen_exit
        extra_fields["entry_gate"] = chosen_entry
        audit_extra["exit_gate"] = chosen_exit
        audit_extra["entry_gate"] = chosen_entry
        if getattr(leave, "from_at", None) and getattr(leave, "to_at", None):
            extra_fields["slip_no"] = generate_unique_slip_no(db)
            extra_fields["verify_code"] = generate_unique_verify_code(db)
            audit_extra["slip_no"] = extra_fields["slip_no"]
    elif req_type_pre == "library_room":
        try:
            det_lib = json.loads(leave.details_json) if getattr(leave, "details_json", None) else {}
            if not isinstance(det_lib, dict):
                det_lib = {}
        except Exception:
            det_lib = {}
        if room_id is not None or (room_name and room_name.strip()):
            target_rm = None
            if room_id is not None:
                target_rm = db.query(models.DiscussionRoom).filter(models.DiscussionRoom.id == room_id).first()
            if not target_rm and room_name:
                target_rm = (
                    db.query(models.DiscussionRoom)
                    .filter(func.lower(models.DiscussionRoom.name) == room_name.strip().lower())
                    .first()
                )
            if target_rm and leave.from_at and leave.to_at:
                occupied = find_occupied_library_rooms(
                    db,
                    from_utc=leave.from_at,
                    to_utc=leave.to_at,
                    exclude_leave_id=leave.id,
                )
                conflict = occupied.get(f"id:{target_rm.id}") or occupied.get(f"name:{target_rm.name.lower()}")
                if conflict:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Cannot reassign to {target_rm.name}: {conflict}",
                    )
                det_lib["room_id"] = target_rm.id
                det_lib["room_code"] = target_rm.room_code
                det_lib["room_name"] = target_rm.name
                det_lib["room"] = target_rm.name
                det_lib["floor"] = target_rm.floor
                det_lib["capacity"] = target_rm.capacity
                extra_fields["details_json"] = json.dumps(det_lib)
                extra_fields["title"] = f"{target_rm.name} ({det_lib.get('time_slot') or leave.start_date})"
                audit_extra["room_name"] = target_rm.name
        if getattr(leave, "from_at", None) and getattr(leave, "to_at", None):
            extra_fields["slip_no"] = generate_unique_slip_no(db)
            extra_fields["verify_code"] = generate_unique_verify_code(db)
            audit_extra["slip_no"] = extra_fields["slip_no"]

    clean_comment = (comment or "").strip() or "Approved at Institutional Governance Gate."
    _apply_optimistic_decision(
        db,
        leave,
        target_status=STATUS_APPROVED,
        expected_version=expected_version,
        actor_user=actor_user,
        decision_comment=clean_comment,
        rejection_reason=None,
        extra_fields=extra_fields,
    )

    audit_service.record_audit_event(
        db,
        actor_user=actor_user,
        action="approve",
        target_type="leave_request",
        target_id=leave.id,
        details={
            "leave_code": leave.leave_code,
            "workflow_run_id": leave.workflow_run_id,
            "comment": clean_comment,
            **audit_extra,
        },
        ip_address=ip_address,
    )

    # Resume workflow DAG execution if linked
    agent_result = None
    if leave.workflow_run_id:
        from app.agent.agent import AXORAAgent

        agent = AXORAAgent(db, auto_approve=False)
        st = agent.get_state(leave.workflow_run_id)
        if st and st.human_approval_status == "PENDING":
            agent_result = agent.approve(leave.workflow_run_id)

    # Refresh leave after agent execution and sync conversation session if present
    db.refresh(leave)
    if leave.workflow_run_id:
        conv_sessions = (
            db.query(models.ConversationSession)
            .filter(models.ConversationSession.active_workflow_request_id == leave.workflow_run_id)
            .all()
        )
        for cs in conv_sessions:
            cs.status = "completed"
            cs.updated_at = datetime.now(timezone.utc)

    student_user = _find_student_user_account(db, leave.student_id)
    leave_payload = serialize_leave_request(db, leave, include_workflow=True)
    now = datetime.now(timezone.utc)

    approver_label = actor_user.full_name if actor_user else leave.assigned_approver
    req_type = (getattr(leave, "request_type", None) or "leave").lower()
    type_label = get_request_type_label(req_type)
    if req_type == "leave":
        notif_title = f"Leave Approved ({leave.leave_code})"
        notif_body = (
            f"Your {leave.days_count}-day {leave.category} leave ({leave.start_date} to {leave.end_date}) "
            f"was approved by {approver_label}."
        )
    else:
        notif_title = f"{type_label} Approved ({leave.leave_code})"
        notif_body = (
            f"Your {type_label.lower()} request ({getattr(leave, 'title', None) or leave.reason[:60]}) "
            f"was approved by {approver_label}."
        )
    student_notif: Optional[models.Notification] = None
    if student_user:
        student_notif = models.Notification(
            user_id=student_user.id,
            leave_request_id=leave.id,
            event_type="request.updated",
            title=notif_title,
            body=notif_body,
            payload_json=_build_notification_payload(leave_payload, notif_body),
            created_at=now,
        )
        db.add(student_notif)

    db.commit()
    db.refresh(leave)
    if student_notif:
        db.refresh(student_notif)
    leave_payload = serialize_leave_request(db, leave, include_workflow=True)

    target_uids = [student_user.id] if student_user else []
    event_id = str(student_notif.id) if student_notif else None
    events_service.event_broker.publish(
        event_type="request.updated",
        payload={"request": leave_payload, "notification_title": notif_title, "notification_body": notif_body},
        target_user_ids=target_uids,
        target_roles=list(ADMIN_ROLES),
        event_id=event_id,
    )
    if student_notif and student_user:
        events_service.event_broker.publish(
            event_type="notification.created",
            payload={
                "notification": {
                    "id": student_notif.id,
                    "leave_request_id": student_notif.leave_request_id,
                    "event_type": student_notif.event_type,
                    "title": student_notif.title,
                    "body": student_notif.body,
                    "read_at": None,
                    "created_at": student_notif.created_at.isoformat() if student_notif.created_at else None,
                    "request": leave_payload,
                }
            },
            target_user_ids=[student_user.id],
            event_id=str(student_notif.id),
        )

    return leave, leave_payload, agent_result


def reject_leave_request(
    db: Session,
    *,
    leave_id: Optional[int] = None,
    workflow_run_id: Optional[int] = None,
    actor_user: models.UserAccount,
    rejection_reason: str,
    comment: Optional[str] = None,
    expected_version: Optional[int] = None,
    ip_address: Optional[str] = None,
    min_reason_len: int = 10,
) -> Tuple[models.LeaveRequest, Dict[str, Any], Optional[Any]]:
    reason_clean = (rejection_reason or "").strip()
    if len(reason_clean) < min_reason_len:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Please provide a clear rejection reason (at least {min_reason_len} characters).",
        )

    leave = None
    if leave_id is not None:
        leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    elif workflow_run_id is not None:
        leave = (
            db.query(models.LeaveRequest)
            .filter(models.LeaveRequest.workflow_run_id == workflow_run_id)
            .first()
        )

    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    if normalize_leave_status(leave.status) != STATUS_PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Leave request {leave.leave_code} is already {normalize_leave_status(leave.status)}.",
        )

    _apply_optimistic_decision(
        db,
        leave,
        target_status=STATUS_REJECTED,
        expected_version=expected_version,
        actor_user=actor_user,
        decision_comment=(comment or reason_clean).strip(),
        rejection_reason=reason_clean,
    )

    audit_service.record_audit_event(
        db,
        actor_user=actor_user,
        action="reject",
        target_type="leave_request",
        target_id=leave.id,
        details={
            "leave_code": leave.leave_code,
            "workflow_run_id": leave.workflow_run_id,
            "rejection_reason": reason_clean,
        },
        ip_address=ip_address,
    )

    agent_result = None
    if leave.workflow_run_id:
        from app.agent.agent import AXORAAgent

        agent = AXORAAgent(db, auto_approve=False)
        st = agent.get_state(leave.workflow_run_id)
        if st and st.human_approval_status == "PENDING":
            agent_result = agent.reject(leave.workflow_run_id, reason=reason_clean)

    if leave.workflow_run_id:
        conv_sessions = (
            db.query(models.ConversationSession)
            .filter(models.ConversationSession.active_workflow_request_id == leave.workflow_run_id)
            .all()
        )
        for cs in conv_sessions:
            cs.status = "completed"
            cs.updated_at = datetime.now(timezone.utc)

    student_user = _find_student_user_account(db, leave.student_id)
    leave_payload = serialize_leave_request(db, leave, include_workflow=True)
    now = datetime.now(timezone.utc)

    approver_label = actor_user.full_name if actor_user else leave.assigned_approver
    req_type = (getattr(leave, "request_type", None) or "leave").lower()
    type_label = get_request_type_label(req_type)
    if req_type == "leave":
        notif_title = f"Leave Request Declined ({leave.leave_code})"
        notif_body = f"Your leave request was declined by {approver_label}: {reason_clean}"
    else:
        notif_title = f"{type_label} Declined ({leave.leave_code})"
        notif_body = f"Your {type_label.lower()} request was declined by {approver_label}: {reason_clean}"
    student_notif: Optional[models.Notification] = None
    if student_user:
        student_notif = models.Notification(
            user_id=student_user.id,
            leave_request_id=leave.id,
            event_type="request.updated",
            title=notif_title,
            body=notif_body,
            payload_json=_build_notification_payload(leave_payload, notif_body),
            created_at=now,
        )
        db.add(student_notif)

    db.commit()
    db.refresh(leave)
    if student_notif:
        db.refresh(student_notif)
    leave_payload = serialize_leave_request(db, leave, include_workflow=True)

    target_uids = [student_user.id] if student_user else []
    event_id = str(student_notif.id) if student_notif else None
    events_service.event_broker.publish(
        event_type="request.updated",
        payload={"request": leave_payload, "notification_title": notif_title, "notification_body": notif_body},
        target_user_ids=target_uids,
        target_roles=list(ADMIN_ROLES),
        event_id=event_id,
    )
    if student_notif and student_user:
        events_service.event_broker.publish(
            event_type="notification.created",
            payload={
                "notification": {
                    "id": student_notif.id,
                    "leave_request_id": student_notif.leave_request_id,
                    "event_type": student_notif.event_type,
                    "title": student_notif.title,
                    "body": student_notif.body,
                    "read_at": None,
                    "created_at": student_notif.created_at.isoformat() if student_notif.created_at else None,
                    "request": leave_payload,
                }
            },
            target_user_ids=[student_user.id],
            event_id=str(student_notif.id),
        )

    return leave, leave_payload, agent_result


def cancel_leave_request(
    db: Session,
    *,
    leave_id: int,
    actor_user: models.UserAccount,
    expected_version: Optional[int] = None,
    ip_address: Optional[str] = None,
) -> Tuple[models.LeaveRequest, Dict[str, Any]]:
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    is_admin = (actor_user.role or "").lower() in ADMIN_ROLES
    if not is_admin and (not actor_user.student_id or actor_user.student_id != leave.student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw your own leave requests.",
        )

    cur = normalize_leave_status(leave.status)
    was_approved = cur == STATUS_APPROVED
    if cur == STATUS_APPROVED:
        if not getattr(leave, "from_at", None):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot withdraw leave request {leave.leave_code} because it is already {cur}.",
            )
        if datetime.now(timezone.utc) >= timezone_utils.ensure_utc(leave.from_at):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel {leave.leave_code} because its scheduled start time has already begun.",
            )
    elif cur not in {STATUS_PENDING_APPROVAL, STATUS_DRAFT}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot withdraw leave request {leave.leave_code} because it is already {cur}.",
        )

    cancel_note = (
        "Cancelled by student prior to scheduled start time (gate slip revoked)."
        if was_approved
        else "Withdrawn by student prior to approval decision."
    )

    _apply_optimistic_decision(
        db,
        leave,
        target_status=STATUS_CANCELLED,
        expected_version=expected_version,
        actor_user=actor_user,
        decision_comment=cancel_note,
        rejection_reason=None,
    )

    audit_service.record_audit_event(
        db,
        actor_user=actor_user,
        action="cancel",
        target_type="leave_request",
        target_id=leave.id,
        details={"leave_code": leave.leave_code, "workflow_run_id": leave.workflow_run_id},
        ip_address=ip_address,
    )

    if leave.workflow_run_id:
        from app.agent.agent import AXORAAgent

        agent = AXORAAgent(db, auto_approve=False)
        st = agent.get_state(leave.workflow_run_id)
        if st and st.human_approval_status == "PENDING":
            agent.cancel(leave.workflow_run_id)

        conv_sessions = (
            db.query(models.ConversationSession)
            .filter(models.ConversationSession.active_workflow_request_id == leave.workflow_run_id)
            .all()
        )
        for cs in conv_sessions:
            cs.status = "completed"
            cs.updated_at = datetime.now(timezone.utc)

    leave_payload = serialize_leave_request(db, leave, include_workflow=True)
    now = datetime.now(timezone.utc)
    admins = _get_active_admins(db)
    if was_approved:
        notif_title = f"Approved Leave Cancelled ({leave.leave_code})"
        notif_body = f"Student {leave.student_id} cancelled previously approved request {leave.leave_code}; gate slip revoked."
    else:
        notif_title = f"Leave Request Withdrawn ({leave.leave_code})"
        notif_body = f"Student {leave.student_id} withdrew pending leave request {leave.leave_code}."
    admin_notifs: List[models.Notification] = []
    for adm in admins:
        n = models.Notification(
            user_id=adm.id,
            leave_request_id=leave.id,
            event_type="request.updated",
            title=notif_title,
            body=notif_body,
            payload_json=_build_notification_payload(leave_payload, notif_body),
            created_at=now,
        )
        db.add(n)
        admin_notifs.append(n)

    db.commit()
    db.refresh(leave)
    leave_payload = serialize_leave_request(db, leave, include_workflow=True)

    event_id = str(admin_notifs[0].id) if admin_notifs else None
    events_service.event_broker.publish(
        event_type="request.updated",
        payload={"request": leave_payload, "notification_title": notif_title, "notification_body": notif_body},
        target_user_ids=[actor_user.id],
        target_roles=list(ADMIN_ROLES),
        event_id=event_id,
    )

    return leave, leave_payload


def create_campus_request_at_gate(
    db: Session,
    *,
    student: models.Student,
    request_type: str,
    title: Optional[str] = None,
    category: Optional[str] = None,
    start_date_hint: Optional[str] = None,
    days_count: int = 1,
    from_at: Optional[datetime] = None,
    to_at: Optional[datetime] = None,
    college_snapshot: Optional[str] = None,
    reason: str = "",
    details: Optional[Dict[str, Any]] = None,
    actor_user: Optional[models.UserAccount] = None,
    ip_address: Optional[str] = None,
    trigger_sse: bool = True,
    notify_admins: bool = True,
) -> Dict[str, Any]:
    """
    Create a generic PENDING_APPROVAL campus request (`library_room`, `hostel_allocation`,
    `certificate`, or `leave`) wired into the shared Approval Queue, Notifications & SSE stream.
    """
    req_type = (request_type or "leave").strip().lower()
    if req_type not in REQUEST_TYPE_LABELS:
        req_type = "leave"

    type_label = get_request_type_label(req_type)
    code = generate_unique_leave_code(db, request_type=req_type)
    from_utc = timezone_utils.ensure_utc(from_at) if from_at else None
    to_utc = timezone_utils.ensure_utc(to_at) if to_at else None
    if from_utc and to_utc:
        start_date = timezone_utils.to_campus(from_utc).date().isoformat()
        end_date = timezone_utils.to_campus(to_utc).date().isoformat()
    else:
        start_date, end_date = compute_date_range(start_date_hint, days_count)

    # Snapshot student attendance for reviewer visibility
    elig_tool = CheckLeaveEligibilityTool()
    elig_res = elig_tool.execute(db=db, student_id=student.student_id, days=days_count)
    att_pct = elig_res.get("attendance_percentage", 75.0) if isinstance(elig_res, dict) else 75.0

    approver_user, approver_name, default_role = get_primary_warden(db)
    routed_role = (
        "Library Desk"
        if req_type == "library_room"
        else "Registrar"
        if req_type == "certificate"
        else default_role
    )

    clean_title = (title or "").strip() or f"{type_label} Request"
    clean_reason = (reason or "").strip() or clean_title
    details_payload = details or {}
    resolved_college = (
        (college_snapshot or "").strip()
        or (getattr(student, "college", None) or "").strip()
        or "Lovely Professional University"
    )
    now = datetime.now(timezone.utc)

    record = models.LeaveRequest(
        leave_code=code,
        request_type=req_type,
        title=clean_title,
        details_json=json.dumps(details_payload),
        workflow_run_id=None,
        student_id=student.student_id,
        category=(category or req_type).strip().lower(),
        start_date=start_date,
        end_date=end_date,
        days_count=max(1, int(days_count or 1)),
        from_at=from_utc,
        to_at=to_utc,
        college_snapshot=resolved_college,
        reason=clean_reason,
        doc_required=0,
        status=STATUS_PENDING_APPROVAL,
        attendance_snapshot=att_pct,
        policy_result=json.dumps(
            {
                "eligible": True,
                "status": "PENDING_APPROVAL",
                "request_type": req_type,
                "attendance_percentage": att_pct,
                "assigned_approver": approver_name,
                "approver_role": routed_role,
                "checked_at": now.isoformat(),
            }
        ),
        routed_to_role=routed_role,
        assigned_approver=approver_name,
        assigned_approver_user_id=approver_user.id if approver_user else None,
        approver_role=routed_role,
        submitted_at=now,
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(record)
    db.flush()

    audit_service.record_audit_event(
        db,
        actor_user=actor_user,
        action="submit",
        target_type="leave_request",
        target_id=record.id,
        details={
            "leave_code": code,
            "request_type": req_type,
            "title": clean_title,
            "student_id": student.student_id,
        },
        ip_address=ip_address,
    )

    payload = serialize_leave_request(db, record, include_workflow=False)
    student_display = _format_display_name(student.name, fallback=student.student_id)
    notif_title = f"New {type_label} Request from {student_display}"
    notif_body = f"{code}: {clean_title} — {clean_reason[:100]}"

    admin_notifs: List[models.Notification] = []
    if notify_admins:
        for adm in _get_active_admins(db):
            n = models.Notification(
                user_id=adm.id,
                leave_request_id=record.id,
                event_type="request.created",
                title=notif_title,
                body=notif_body,
                payload_json=_build_notification_payload(payload, notif_body),
                created_at=now,
            )
            db.add(n)
            admin_notifs.append(n)

    db.commit()
    db.refresh(record)
    if admin_notifs:
        for n in admin_notifs:
            db.refresh(n)

    payload = serialize_leave_request(db, record, include_workflow=False)
    if trigger_sse:
        event_id = str(admin_notifs[0].id) if admin_notifs else str(record.id)
        events_service.event_broker.publish(
            event_type="request.created",
            payload={
                "request": payload,
                "notification_title": notif_title,
                "notification_body": notif_body,
            },
            target_roles=list(ADMIN_ROLES),
            event_id=event_id,
        )
        for n in admin_notifs:
            events_service.event_broker.publish(
                event_type="notification.created",
                payload={
                    "notification": {
                        "id": n.id,
                        "leave_request_id": n.leave_request_id,
                        "event_type": n.event_type,
                        "title": n.title,
                        "body": n.body,
                        "read_at": None,
                        "created_at": n.created_at.isoformat() if n.created_at else now.isoformat(),
                    }
                },
                target_user_ids=[n.user_id],
                event_id=f"notif-{n.id}",
            )

    return payload


def seed_sample_multi_type_requests(db: Session) -> int:
    """
    Idempotently seed 3 sample PENDING_APPROVAL requests across non-leave campus request types
    (`library_room`, `hostel_allocation`, `certificate`) if no row of each type exists yet.
    """
    samples = [
        {
            "request_type": "library_room",
            "title": "Seminar Room B-204 Group Study",
            "category": "library_room",
            "reason": "Capstone team architecture sprint & database modeling session (4 students).",
            "preferred_students": ["S002", "S003", "S001"],
            "days": 1,
            "start_date_hint": "tomorrow",
            "details": {
                "room": "Central Library — Seminar Room B-204",
                "time_slot": "Tomorrow 14:00 - 16:00",
                "seats": "4 students",
                "purpose": "Capstone project sprint",
            },
        },
        {
            "request_type": "hostel_allocation",
            "title": "Hostel Room Transfer to BH-2",
            "category": "hostel_allocation",
            "reason": "Requesting quieter upper-floor room transfer in BH-2 near project lab.",
            "preferred_students": ["S003", "S002", "S001"],
            "days": 1,
            "start_date_hint": "tomorrow",
            "details": {
                "current_room": "BH-1 / Room 214",
                "requested_block": "BH-2 (Block B, 3rd Floor)",
                "occupancy": "Single / Quiet Wing",
                "term": "Active Semester",
            },
        },
        {
            "request_type": "certificate",
            "title": "Bonafide & Enrollment Certificate",
            "category": "certificate",
            "reason": "Official university bonafide certificate required for summer research internship.",
            "preferred_students": ["S002", "S001"],
            "days": 1,
            "start_date_hint": "today",
            "details": {
                "certificate_type": "Bonafide & Enrollment Verification",
                "purpose": "Summer Research Internship & Passport KYC",
                "copies": "1 Signed Copy",
                "delivery": "Digital PDF + Registrar Desk",
            },
        },
    ]

    created_count = 0
    for spec in samples:
        exists = (
            db.query(models.LeaveRequest)
            .filter(
                models.LeaveRequest.request_type == spec["request_type"],
                models.LeaveRequest.status.in_(
                    [STATUS_PENDING_APPROVAL, "pending", "PENDING", "WAITING_FOR_HUMAN"]
                ),
            )
            .first()
        )
        if exists:
            continue

        target_student: Optional[models.Student] = None
        for sid in spec["preferred_students"]:
            target_student = student_service.get_student_by_id(db, sid)
            if target_student:
                break
        if not target_student:
            target_student = db.query(models.Student).first()
        if not target_student:
            continue

        create_campus_request_at_gate(
            db,
            student=target_student,
            request_type=spec["request_type"],
            title=spec["title"],
            category=spec["category"],
            start_date_hint=spec["start_date_hint"],
            days_count=spec["days"],
            reason=spec["reason"],
            details=spec["details"],
            trigger_sse=False,
            notify_admins=False,
        )
        created_count += 1

    return created_count
