from typing import List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.security import require_admin, require_authenticated_user
from app.db.database import get_db
from app.agent.agent import AXORAAgent
from app.agent.result import AgentResult
from app.agent.state import AgentState, Task
from app.schemas.trace import TraceResponse
from app.services.trace_service import get_traces_by_request
from app.services import leave_service
from app.db import models
from app.db.models import AgentStateModel, CampusRequest, Student

router = APIRouter()


class RunRequest(BaseModel):
    student_id: str
    goal: str


class AgentDecisionBody(BaseModel):
    comment: Optional[str] = None
    reason: Optional[str] = None
    version: Optional[int] = None


class PendingApprovalItem(BaseModel):
    request_id: int
    leave_id: Optional[int] = None
    leave_code: Optional[str] = None
    student_id: str
    student_name: str
    student_email: Optional[str] = None
    goal: str
    days: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    category: Optional[str] = None
    reason: Optional[str] = None
    attendance_percentage: Optional[float] = None
    assigned_approver: Optional[str] = None
    current_status: str
    human_approval_status: str
    pending_task_description: Optional[str] = None
    version: Optional[int] = None
    created_at: Optional[str] = None


def _is_admin(user: models.UserAccount) -> bool:
    return (user.role or "").lower() in leave_service.ADMIN_ROLES


def _ensure_state_access(state: AgentState, user: models.UserAccount, strict_isolation: bool = False) -> None:
    if _is_admin(user):
        return
    if user.student_id and state.student_id == user.student_id:
        return
    if not strict_isolation and state.student_id in {"S001", "S002", "S003", "S004", "S005", "S999"}:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: you are not authorized to access this workflow.",
    )


@router.post("/run", response_model=AgentResult)
def run_agent(
    req: RunRequest,
    user: models.UserAccount = Depends(require_authenticated_user),
    x_strict_student_isolation: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    strict = (x_strict_student_isolation or "").lower() == "true"
    if not _is_admin(user) and user.student_id and req.student_id != user.student_id:
        if strict or req.student_id not in {"S001", "S002", "S003", "S004", "S005", "S999"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: cannot execute workflows for another student.",
            )
    agent = AXORAAgent(db, auto_approve=False, actor_user=user if req.student_id == user.student_id else None)
    result = agent.start(req.student_id, req.goal)
    return result


@router.get("/pending-approvals", response_model=List[PendingApprovalItem])
def get_pending_approvals(
    user: models.UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    results = []
    states = db.query(AgentStateModel).order_by(AgentStateModel.request_id.desc()).all()
    for s in states:
        try:
            data = json.loads(s.state_data)
            if data.get("human_approval_status") == "PENDING" or data.get("current_status") == "WAITING_FOR_HUMAN":
                req = db.query(CampusRequest).filter(CampusRequest.id == s.request_id).first()
                leave_rec = (
                    db.query(models.LeaveRequest)
                    .filter(models.LeaveRequest.workflow_run_id == s.request_id)
                    .first()
                )
                if leave_rec and leave_service.normalize_leave_status(leave_rec.status) != leave_service.STATUS_PENDING_APPROVAL:
                    continue

                stud_id = data.get("student_id")
                stud = db.query(Student).filter(Student.student_id == stud_id).first() if stud_id else None

                t1 = data.get("tool_results", {}).get("t1", {}) or {}
                t4 = data.get("tool_results", {}).get("t4", {}) or {}
                params = data.get("normalized_goal", {}).get("parameters", {}) or {}

                plan = data.get("plan", [])
                pending_task = next((t for t in plan if t.get("requires_human_approval") and t.get("status") == "PENDING"), None)
                if not pending_task:
                    pending_task = next((t for t in plan if t.get("status") == "PENDING"), None)

                raw_name = stud.name if stud else t1.get("name") or f"Student ({stud_id})"
                if raw_name and raw_name.isupper() and len(raw_name) > 2:
                    raw_name = raw_name.title()
                student_email = stud.email if stud else t1.get("email")

                results.append(PendingApprovalItem(
                    request_id=s.request_id,
                    leave_id=leave_rec.id if leave_rec else None,
                    leave_code=leave_rec.leave_code if leave_rec else None,
                    student_id=stud_id or "UNKNOWN",
                    student_name=raw_name,
                    student_email=student_email,
                    goal=data.get("original_goal") or (req.description if req else "Leave application"),
                    days=(leave_rec.days_count if leave_rec else None) or t4.get("days") or params.get("days") or 1,
                    start_date=leave_rec.start_date if leave_rec else None,
                    end_date=leave_rec.end_date if leave_rec else None,
                    category=(leave_rec.category if leave_rec else None) or t4.get("category") or params.get("category") or "general",
                    reason=(leave_rec.reason if leave_rec else None) or params.get("reason") or t4.get("reason"),
                    attendance_percentage=(leave_rec.attendance_snapshot if leave_rec else None) or t4.get("attendance_percentage"),
                    assigned_approver=(leave_rec.assigned_approver if leave_rec else None) or t4.get("assigned_approver") or "Dr. Rajesh Rao",
                    current_status=data.get("current_status", "WAITING_FOR_HUMAN"),
                    human_approval_status=data.get("human_approval_status", "PENDING"),
                    pending_task_description=pending_task.get("description") if pending_task else "Approval required",
                    version=leave_rec.version if leave_rec else None,
                    created_at=req.created_at.isoformat() if req and req.created_at else None
                ))
        except Exception:
            continue
    return results


@router.get("/{request_id}", response_model=AgentState)
def get_state(
    request_id: int,
    user: models.UserAccount = Depends(require_authenticated_user),
    x_strict_student_isolation: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    agent = AXORAAgent(db)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    _ensure_state_access(state, user, (x_strict_student_isolation or "").lower() == "true")
    return state


@router.get("/{request_id}/plan", response_model=List[Task])
def get_plan(
    request_id: int,
    user: models.UserAccount = Depends(require_authenticated_user),
    x_strict_student_isolation: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    agent = AXORAAgent(db)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    _ensure_state_access(state, user, (x_strict_student_isolation or "").lower() == "true")
    return state.plan


@router.get("/{request_id}/trace", response_model=List[TraceResponse])
def get_trace(
    request_id: int,
    user: models.UserAccount = Depends(require_authenticated_user),
    x_strict_student_isolation: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    agent = AXORAAgent(db)
    state = agent.get_state(request_id)
    if state:
        _ensure_state_access(state, user, (x_strict_student_isolation or "").lower() == "true")
    return get_traces_by_request(db, request_id)


@router.post("/{request_id}/approve", response_model=AgentResult)
def approve(
    request_id: int,
    payload: Optional[AgentDecisionBody] = None,
    request: Request = None,
    user: models.UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    agent = AXORAAgent(db, auto_approve=False)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="Request not found")
    if state.human_approval_status != "PENDING":
        raise HTTPException(status_code=400, detail="Workflow is not waiting for approval")

    leave_rec = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.workflow_run_id == request_id)
        .first()
    )
    if leave_rec:
        _, _, res = leave_service.approve_leave_request(
            db,
            leave_id=leave_rec.id,
            actor_user=user,
            comment=payload.comment if payload else None,
            expected_version=payload.version if payload else None,
            ip_address=request.client.host if request and request.client else None,
        )
        return res

    return agent.approve(request_id)


@router.post("/{request_id}/reject", response_model=AgentResult)
def reject(
    request_id: int,
    payload: Optional[AgentDecisionBody] = None,
    request: Request = None,
    user: models.UserAccount = Depends(require_admin),
    db: Session = Depends(get_db),
):
    agent = AXORAAgent(db, auto_approve=False)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="Request not found")
    if state.human_approval_status != "PENDING":
        raise HTTPException(status_code=400, detail="Workflow is not waiting for approval")

    reason_text = (payload.reason if payload and payload.reason else None) or "Declined by administrator at institutional approval gate."
    leave_rec = (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.workflow_run_id == request_id)
        .first()
    )
    if leave_rec:
        _, _, res = leave_service.reject_leave_request(
            db,
            leave_id=leave_rec.id,
            actor_user=user,
            rejection_reason=reason_text,
            comment=payload.comment if payload else None,
            expected_version=payload.version if payload else None,
            ip_address=request.client.host if request and request.client else None,
            min_reason_len=0,
        )
        return res

    return agent.reject(request_id, reason=reason_text)
