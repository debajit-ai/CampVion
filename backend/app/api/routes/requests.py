"""
REST API Routes for Leave Requests & Institutional Approval Queue.
Supports Student submissions/cancellations/history and Admin/Warden queue filtering,
optimistic-lock approve/reject decisions, and full audit/workflow inspection.
"""

from datetime import datetime, timezone
import logging
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.agent import AXORAAgent
from app.core import timezone_utils
from app.core.security import (
    auth_rate_limiter,
    is_admin_role,
    require_admin,
    require_authenticated_user,
)
from app.db import models
from app.db.database import get_db
from app.services import leave_service, pdf_service, student_service

logger = logging.getLogger("campvion.requests")
router = APIRouter()


class CreateLeaveBody(BaseModel):
    days: int = Field(default=1, ge=1, le=30, description="Number of leave days requested")
    start_date: Optional[str] = Field(default=None, max_length=64)
    category: str = Field(default="personal", max_length=40)
    reason: str = Field(..., min_length=3, max_length=500)
    from_at: Optional[str] = Field(default=None, max_length=64)
    to_at: Optional[str] = Field(default=None, max_length=64)
    from_date: Optional[str] = Field(default=None, max_length=64)
    from_time: Optional[str] = Field(default=None, max_length=32)
    to_date: Optional[str] = Field(default=None, max_length=64)
    to_time: Optional[str] = Field(default=None, max_length=32)
    destination: Optional[str] = Field(default=None, max_length=200)
    college: Optional[str] = Field(default=None, max_length=120)
    idempotency_key: Optional[str] = Field(default=None, max_length=80)


class ApproveBody(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=500)
    version: Optional[int] = Field(default=None, ge=1)
    exit_gate: Optional[str] = Field(default=None, max_length=120)
    entry_gate: Optional[str] = Field(default=None, max_length=120)
    room_id: Optional[int] = Field(default=None, ge=1)
    room_name: Optional[str] = Field(default=None, max_length=120)
    hostel_block: Optional[str] = Field(default=None, max_length=60)
    hostel_room: Optional[str] = Field(default=None, max_length=40)


class RejectBody(BaseModel):
    reason: str = Field(..., min_length=10, max_length=500)
    comment: Optional[str] = Field(default=None, max_length=500)
    version: Optional[int] = Field(default=None, ge=1)


class CancelBody(BaseModel):
    version: Optional[int] = Field(default=None, ge=1)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _compute_queue_stats(rows: List[models.LeaveRequest]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    today_date = now.date()
    pending_count = 0
    approved_today = 0
    rejected_today = 0
    decided_total = 0
    approved_total = 0
    response_minutes: List[float] = []

    for row in rows:
        st = leave_service.normalize_leave_status(row.status)
        if st == leave_service.STATUS_PENDING_APPROVAL:
            pending_count += 1
        elif st in {leave_service.STATUS_APPROVED, leave_service.STATUS_REJECTED}:
            decided_total += 1
            if st == leave_service.STATUS_APPROVED:
                approved_total += 1
            if row.decided_at:
                dec_dt = row.decided_at.replace(tzinfo=timezone.utc) if row.decided_at.tzinfo is None else row.decided_at
                if dec_dt.date() == today_date:
                    if st == leave_service.STATUS_APPROVED:
                        approved_today += 1
                    else:
                        rejected_today += 1
                sub_dt = row.submitted_at or row.created_at
                if sub_dt:
                    sub_utc = sub_dt.replace(tzinfo=timezone.utc) if sub_dt.tzinfo is None else sub_dt
                    diff_mins = max(0.0, (dec_dt - sub_utc).total_seconds() / 60.0)
                    response_minutes.append(diff_mins)

    avg_response_minutes = round(sum(response_minutes) / len(response_minutes), 1) if response_minutes else 0.0
    approval_rate_pct = round((approved_total / decided_total) * 100.0, 1) if decided_total else 0.0
    return {
        "pending_count": pending_count,
        "approved_today_count": approved_today,
        "rejected_today_count": rejected_today,
        "avg_response_minutes": avg_response_minutes,
        "approval_rate_pct": approval_rate_pct,
    }


@router.get("/stats")
def get_queue_stats(
    response: Response,
    student_id: Optional[str] = Query(default=None),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    req_id = f"req_{secrets.token_hex(6)}"
    response.headers["X-Request-ID"] = req_id
    try:
        is_admin = is_admin_role(user.role)
        query = db.query(models.LeaveRequest)
        if is_admin:
            if student_id:
                query = query.filter(models.LeaveRequest.student_id == student_id.strip())
        else:
            student_service.ensure_student_for_user(db, user)
            if student_id and student_id.strip() != user.student_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Students can only view their own request statistics.", "request_id": req_id},
                )
            query = query.filter(models.LeaveRequest.student_id == user.student_id)
        return _compute_queue_stats(query.all())
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[%s] Failed computing queue stats for user=%s: %s", req_id, user.email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": f"Failed to load queue statistics ({type(exc).__name__})", "request_id": req_id},
        )


@router.get("")
@router.get("/", include_in_schema=False)
def list_leave_requests(
    response: Response,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    request_type: Optional[str] = Query(default=None),
    request_type_alias: Optional[str] = Query(default=None, alias="type"),
    q: Optional[str] = Query(default=None),
    sort: str = Query(default="newest"),
    student_id: Optional[str] = Query(default=None),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    req_id = f"req_{secrets.token_hex(6)}"
    response.headers["X-Request-ID"] = req_id
    try:
        is_admin = is_admin_role(user.role)

        query = db.query(models.LeaveRequest)
        if is_admin:
            if student_id:
                query = query.filter(models.LeaveRequest.student_id == student_id.strip())
        else:
            student_service.ensure_student_for_user(db, user)
            if student_id and student_id.strip() != user.student_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Students can only view their own leave requests.", "request_id": req_id},
                )
            query = query.filter(models.LeaveRequest.student_id == user.student_id)

        all_rows = query.all()
        stats_data = _compute_queue_stats(all_rows)

        # Filter by status
        filtered_rows = all_rows
        if status_filter and status_filter.strip().upper() != "ALL":
            target = leave_service.normalize_leave_status(status_filter)
            filtered_rows = [r for r in filtered_rows if leave_service.normalize_leave_status(r.status) == target]

        # Filter by request_type (`request_type` or `type` query alias: leave, library_room, hostel_allocation, certificate)
        eff_type = (request_type if request_type is not None else request_type_alias) or ""
        if eff_type.strip().lower() not in {"", "all"}:
            rt_target = eff_type.strip().lower()
            filtered_rows = [
                r for r in filtered_rows if (getattr(r, "request_type", None) or "leave").strip().lower() == rt_target
            ]

        # Search filter
        if q and q.strip():
            needle = q.strip().lower()
            student_lookup = {
                s.student_id: (s.name or "")
                for s in db.query(models.Student).filter(
                    models.Student.student_id.in_({r.student_id for r in filtered_rows if r.student_id})
                ).all()
            } if filtered_rows else {}
            filtered_rows = [
                r
                for r in filtered_rows
                if needle in (r.leave_code or "").lower()
                or needle in (r.student_id or "").lower()
                or needle in (student_lookup.get(r.student_id or "", "")).lower()
                or needle in (r.reason or "").lower()
                or needle in (r.category or "").lower()
                or needle in (getattr(r, "title", None) or "").lower()
                or needle in (getattr(r, "request_type", None) or "").lower()
            ]

        # Null-safe sort (avoids datetime.min.timestamp() OSError on Windows)
        def _sort_key(r: models.LeaveRequest):
            dt = r.submitted_at or r.created_at
            if not dt:
                return 0.0
            try:
                return dt.timestamp()
            except Exception:
                return 0.0

        filtered_rows.sort(key=_sort_key, reverse=(sort != "oldest"))

        serialized: List[Dict[str, Any]] = []
        for r in filtered_rows:
            try:
                serialized.append(leave_service.serialize_leave_request(db, r, include_workflow=False))
            except Exception as row_exc:
                logger.exception(
                    "[%s] Skipping/recovering malformed request row id=%s: %s",
                    req_id,
                    getattr(r, "id", None),
                    row_exc,
                )

        return {
            "items": serialized,
            "total": len(serialized),
            "stats": stats_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[%s] Unhandled error listing requests for user=%s: %s", req_id, user.email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": f"Failed to load requests ({type(exc).__name__})", "request_id": req_id},
        )


@router.get("/{leave_id}")
def get_leave_request_detail(
    leave_id: int,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

    is_admin = (user.role or "").lower() in leave_service.ADMIN_ROLES
    if not is_admin:
        student_service.ensure_student_for_user(db, user)
        if leave.student_id != user.student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you can only inspect your own leave requests.",
            )

    return leave_service.serialize_leave_request(db, leave, include_workflow=True)


class CreateCampusRequestBody(BaseModel):
    request_type: str = Field(..., description="One of: leave, library_room, hostel_allocation, certificate")
    title: Optional[str] = Field(default=None, max_length=160)
    category: Optional[str] = Field(default="general")
    start_date: Optional[str] = Field(default=None)
    end_date: Optional[str] = Field(default=None)
    days: int = Field(default=1, ge=1, le=60)
    reason: str = Field(..., min_length=3, max_length=600)
    details: Optional[Dict[str, Any]] = Field(default=None)
    from_at: Optional[str] = Field(default=None, max_length=64)
    to_at: Optional[str] = Field(default=None, max_length=64)
    from_date: Optional[str] = Field(default=None, max_length=64)
    from_time: Optional[str] = Field(default=None, max_length=32)
    to_date: Optional[str] = Field(default=None, max_length=64)
    to_time: Optional[str] = Field(default=None, max_length=32)
    destination: Optional[str] = Field(default=None, max_length=200)
    college: Optional[str] = Field(default=None, max_length=120)
    room_id: Optional[int] = Field(default=None, ge=1)
    room_name: Optional[str] = Field(default=None, max_length=120)
    hostel_block: Optional[str] = Field(default=None, max_length=60)
    hostel_room: Optional[str] = Field(default=None, max_length=40)
    people: Optional[int] = Field(default=None, ge=1, le=20)
    sub_type: Optional[str] = Field(default=None, max_length=40)
    preferred_block: Optional[str] = Field(default=None, max_length=60)
    sharing_type: Optional[str] = Field(default=None, max_length=32)
    ac_type: Optional[str] = Field(default=None, max_length=20)
    idempotency_key: Optional[str] = Field(default=None, max_length=80)


@router.post("/submit", status_code=status.HTTP_201_CREATED)
def submit_generic_campus_request(
    payload: CreateCampusRequestBody,
    request: Request,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    auth_rate_limiter.check(f"req_submit:{user.id}", max_requests=15, window_seconds=60)
    if (user.role or "").lower() in leave_service.ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators review and decide student requests and cannot submit requests.",
        )

    req_type = (payload.request_type or "").strip().lower()
    if req_type == "leave":
        d = payload.details or {}
        return submit_leave_request(
            payload=CreateLeaveBody(
                days=payload.days,
                start_date=payload.start_date,
                category=payload.category or "personal",
                reason=payload.reason,
                from_at=payload.from_at or d.get("from_at"),
                to_at=payload.to_at or d.get("to_at"),
                from_date=payload.from_date or d.get("from_date"),
                from_time=payload.from_time or d.get("from_time"),
                to_date=payload.to_date or d.get("to_date"),
                to_time=payload.to_time or d.get("to_time"),
                destination=payload.destination or d.get("destination"),
                college=payload.college or d.get("college"),
                idempotency_key=payload.idempotency_key,
            ),
            request=request,
            user=user,
            db=db,
        )

    if req_type not in leave_service.REQUEST_TYPE_LABELS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported request_type '{payload.request_type}'. Must be leave, library_room, hostel_allocation, or certificate.",
        )

    student = student_service.ensure_student_for_user(db, user)
    if not student:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student profile could not be resolved.")

    det = dict(payload.details or {})
    from_utc_val = None
    to_utc_val = None
    eff_title = payload.title

    if req_type == "library_room":
        r_id = payload.room_id or det.get("room_id")
        r_code = det.get("room_code")
        r_name = payload.room_name or det.get("room_name") or det.get("room")
        d_date = payload.from_date or payload.start_date or det.get("date")
        d_start = payload.from_time or det.get("start_time")
        d_end = payload.to_time or det.get("end_time")
        has_room_v2 = bool(r_id or r_code or payload.from_at or (d_date and d_start and d_end))
        if has_room_v2:
            from_utc_val = timezone_utils.parse_iso_or_parts_to_utc(
                iso_value=payload.from_at or det.get("from_at"),
                date_value=d_date,
                time_value=d_start,
            )
            to_utc_val = timezone_utils.parse_iso_or_parts_to_utc(
                iso_value=payload.to_at or det.get("to_at"),
                date_value=payload.to_date or d_date,
                time_value=d_end,
            )
            if not from_utc_val or not to_utc_val:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Please select valid date, start time, and end time for the discussion room.",
                )
            people_cnt = int(payload.people or det.get("people") or 2)
            room_obj = leave_service.validate_library_booking_v2(
                db,
                student_id=student.student_id,
                from_utc=from_utc_val,
                to_utc=to_utc_val,
                room_id=int(r_id) if r_id is not None else None,
                room_code=str(r_code) if r_code else None,
                room_name=str(r_name) if r_name else None,
                people=people_cnt,
            )
            slot_label = (
                f"{timezone_utils.format_campus_time_12h(from_utc_val)} - "
                f"{timezone_utils.format_campus_time_12h(to_utc_val)}"
            )
            det.update(
                {
                    "room_id": room_obj.id,
                    "room_code": room_obj.room_code,
                    "room_name": room_obj.name,
                    "room": room_obj.name,
                    "floor": room_obj.floor,
                    "capacity": room_obj.capacity,
                    "amenities": room_obj.amenities or "",
                    "people": people_cnt,
                    "date": timezone_utils.to_campus(from_utc_val).date().isoformat(),
                    "start_time": timezone_utils.to_campus(from_utc_val).strftime("%H:%M"),
                    "end_time": timezone_utils.to_campus(to_utc_val).strftime("%H:%M"),
                    "time_slot": slot_label,
                    "purpose": payload.reason.strip(),
                }
            )
            eff_title = payload.title or f"{room_obj.name} ({slot_label})"

    elif req_type == "hostel_allocation":
        hst_sub = (payload.sub_type or det.get("sub_type") or "").strip().lower()
        pref_blk = (payload.preferred_block or det.get("preferred_block") or det.get("requested_block") or "").strip()
        if hst_sub in {"room_change", "room_booking"} or pref_blk or payload.sharing_type:
            resolved_sub = hst_sub if hst_sub in {"room_change", "room_booking"} else "room_booking"
            leave_service.validate_hostel_request_v2(
                db,
                student=student,
                sub_type=resolved_sub,
                reason=payload.reason,
            )
            cur_blk = getattr(student, "hostel_block", None) or "Unassigned"
            cur_rm = getattr(student, "hostel_room", None) or getattr(student, "room_number", None) or "Unassigned"
            det.update(
                {
                    "sub_type": resolved_sub,
                    "current_block": det.get("current_block") or cur_blk,
                    "current_room": det.get("current_room") or cur_rm,
                    "preferred_block": pref_blk or "Any Available Block",
                    "requested_block": pref_blk or "Any Available Block",
                    "sharing_type": (payload.sharing_type or det.get("sharing_type") or "double").lower(),
                    "ac_type": payload.ac_type or det.get("ac_type") or "AC",
                }
            )
            eff_title = payload.title or (
                "Hostel Room Change Request"
                if resolved_sub == "room_change"
                else "Hostel Room Booking Request"
            )

    created = leave_service.create_campus_request_at_gate(
        db,
        student=student,
        request_type=req_type,
        title=eff_title,
        category=payload.category or req_type,
        start_date_hint=payload.start_date or det.get("date"),
        days_count=payload.days,
        from_at=from_utc_val,
        to_at=to_utc_val,
        college_snapshot=payload.college or det.get("college"),
        reason=payload.reason.strip(),
        details=det,
        actor_user=user,
        ip_address=_client_ip(request),
    )
    return {"request": created, "workflow": None}


@router.post("/leave", status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    payload: CreateLeaveBody,
    request: Request,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    auth_rate_limiter.check(f"leave_submit:{user.id}", max_requests=10, window_seconds=60)
    is_admin = (user.role or "").lower() in leave_service.ADMIN_ROLES
    if is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot submit student leave requests on their own admin account.",
        )

    student = student_service.ensure_student_for_user(db, user)
    if not student:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student profile could not be resolved.")

    has_v2_window = any(
        bool(v)
        for v in (
            payload.from_at,
            payload.to_at,
            payload.from_date,
            payload.from_time,
            payload.to_date,
            payload.to_time,
        )
    )
    leave_v2_fields: Dict[str, Any] = {}
    effective_days = payload.days
    start_hint = payload.start_date or "tomorrow"

    if has_v2_window:
        from_utc = timezone_utils.parse_iso_or_parts_to_utc(
            iso_value=payload.from_at,
            date_value=payload.from_date,
            time_value=payload.from_time,
        )
        to_utc = timezone_utils.parse_iso_or_parts_to_utc(
            iso_value=payload.to_at,
            date_value=payload.to_date or payload.from_date,
            time_value=payload.to_time,
        )
        if not from_utc or not to_utc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please provide valid departure and return dates and times.",
            )
        leave_service.validate_leave_window_v2(
            db,
            student_id=student.student_id,
            from_at=from_utc,
            to_at=to_utc,
            category=payload.category,
            reason=payload.reason,
            college=payload.college,
        )
        from_c = timezone_utils.to_campus(from_utc)
        to_c = timezone_utils.to_campus(to_utc)
        start_hint = from_c.date().isoformat()
        effective_days = max(1, (to_c.date() - from_c.date()).days + 1)
        leave_v2_fields = {
            "from_at": from_utc,
            "to_at": to_utc,
            "destination": payload.destination,
            "college_snapshot": payload.college or getattr(student, "college", None),
        }
    elif payload.college or payload.destination:
        leave_v2_fields = {
            "destination": payload.destination,
            "college_snapshot": payload.college or getattr(student, "college", None),
        }

    goal_text = (
        f"Apply for {payload.category.strip()} leave for {effective_days} days "
        f"starting {start_hint} because {payload.reason.strip()}"
    )

    agent = AXORAAgent(
        db,
        auto_approve=False,
        start_date_hint=start_hint,
        actor_user=user,
        enforce_overlap_check=True,
        ip_address=_client_ip(request),
        leave_v2_fields=leave_v2_fields,
    )
    result = agent.start(student.student_id, goal_text)
    state = agent.get_state(result.request_id)

    if result.status == "FAILED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(state.error if state and state.error else result.final_message) or "Leave request eligibility check failed.",
        )

    leave_row = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.workflow_run_id == result.request_id)
        .first()
    )
    if not leave_row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workflow paused but leave record was not created.",
        )

    return {
        "request": leave_service.serialize_leave_request(db, leave_row, include_workflow=True),
        "workflow": result.model_dump(),
    }


@router.post("/{leave_id}/approve")
def approve_leave(
    leave_id: int,
    payload: Optional[ApproveBody] = None,
    request: Request = None,
    user: models.UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    auth_rate_limiter.check(f"leave_decision:{user.id}", max_requests=30, window_seconds=60)
    _, leave_payload, agent_result = leave_service.approve_leave_request(
        db,
        leave_id=leave_id,
        actor_user=user,
        comment=payload.comment if payload else None,
        expected_version=payload.version if payload else None,
        exit_gate=payload.exit_gate if payload else None,
        entry_gate=payload.entry_gate if payload else None,
        room_id=payload.room_id if payload else None,
        room_name=payload.room_name if payload else None,
        hostel_block=payload.hostel_block if payload else None,
        hostel_room=payload.hostel_room if payload else None,
        ip_address=_client_ip(request) if request else None,
    )
    return {
        "request": leave_payload,
        "workflow_result": agent_result.model_dump() if agent_result else None,
    }


@router.post("/{leave_id}/reject")
def reject_leave(
    leave_id: int,
    payload: RejectBody,
    request: Request,
    user: models.UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    auth_rate_limiter.check(f"leave_decision:{user.id}", max_requests=30, window_seconds=60)
    _, leave_payload, agent_result = leave_service.reject_leave_request(
        db,
        leave_id=leave_id,
        actor_user=user,
        rejection_reason=payload.reason,
        comment=payload.comment,
        expected_version=payload.version,
        ip_address=_client_ip(request),
        min_reason_len=10,
    )
    return {
        "request": leave_payload,
        "workflow_result": agent_result.model_dump() if agent_result else None,
    }


@router.post("/{leave_id}/cancel")
def cancel_leave(
    leave_id: int,
    payload: Optional[CancelBody] = None,
    request: Request = None,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    auth_rate_limiter.check(f"leave_cancel:{user.id}", max_requests=20, window_seconds=60)
    _, leave_payload = leave_service.cancel_leave_request(
        db,
        leave_id=leave_id,
        actor_user=user,
        expected_version=payload.version if payload else None,
        ip_address=_client_ip(request) if request else None,
    )
    return {"request": leave_payload}


@router.get("/{leave_id}/slip.pdf")
def download_request_slip_pdf(
    leave_id: int,
    request: Request,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Response:
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    is_admin = (user.role or "").lower() in leave_service.ADMIN_ROLES
    if not is_admin:
        student_service.ensure_student_for_user(db, user)
        if leave.student_id != user.student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you can only download your own slips.",
            )

    status_norm = leave_service.normalize_leave_status(leave.status)
    if status_norm != leave_service.STATUS_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Official slip is only issued for approved requests.",
        )

    req_type = (getattr(leave, "request_type", None) or "leave").lower()
    if req_type == "leave" and (not getattr(leave, "from_at", None) or not getattr(leave, "to_at", None)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slip not available for older requests.",
        )

    slip_dirty = False
    if not getattr(leave, "slip_no", None):
        leave.slip_no = leave_service.generate_unique_slip_no(db)
        slip_dirty = True
    if not getattr(leave, "verify_code", None):
        leave.verify_code = leave_service.generate_unique_verify_code(db)
        slip_dirty = True
    if slip_dirty:
        db.commit()
        db.refresh(leave)

    serialized = leave_service.serialize_leave_request(db, leave, include_workflow=False)
    verify_code = serialized.get("verify_code") or leave.verify_code
    base_url = timezone_utils.resolve_public_base_url(request)
    verify_url = f"{base_url}/verify/{verify_code}"

    pdf_bytes = pdf_service.generate_leave_slip_pdf(leave_data=serialized, verify_url=verify_url)
    safe_name = (serialized.get("slip_no") or serialized.get("leave_code") or f"slip-{leave.id}").replace("/", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="CampVion-{safe_name}.pdf"',
            "Cache-Control": "no-store",
        },
    )
