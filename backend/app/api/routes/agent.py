from typing import List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.agent.agent import AXORAAgent
from app.agent.result import AgentResult
from app.agent.state import AgentState, Task
from app.schemas.trace import TraceResponse
from app.services.trace_service import get_traces_by_request
from app.db.models import AgentStateModel, CampusRequest, Student

router = APIRouter()

class RunRequest(BaseModel):
    student_id: str
    goal: str

class PendingApprovalItem(BaseModel):
    request_id: int
    student_id: str
    student_name: str
    student_email: Optional[str] = None
    goal: str
    days: Optional[int] = None
    category: Optional[str] = None
    reason: Optional[str] = None
    attendance_percentage: Optional[float] = None
    assigned_approver: Optional[str] = None
    current_status: str
    human_approval_status: str
    pending_task_description: Optional[str] = None
    created_at: Optional[str] = None

@router.post("/run", response_model=AgentResult)
def run_agent(req: RunRequest, db: Session = Depends(get_db)):
    agent = AXORAAgent(db, auto_approve=False)
    result = agent.start(req.student_id, req.goal)
    return result

@router.get("/pending-approvals", response_model=List[PendingApprovalItem])
def get_pending_approvals(db: Session = Depends(get_db)):
    results = []
    states = db.query(AgentStateModel).order_by(AgentStateModel.request_id.desc()).all()
    for s in states:
        try:
            data = json.loads(s.state_data)
            if data.get("human_approval_status") == "PENDING" or data.get("current_status") == "WAITING_FOR_HUMAN":
                req = db.query(CampusRequest).filter(CampusRequest.id == s.request_id).first()
                stud_id = data.get("student_id")
                stud = db.query(Student).filter(Student.student_id == stud_id).first() if stud_id else None

                t1 = data.get("tool_results", {}).get("t1", {}) or {}
                t4 = data.get("tool_results", {}).get("t4", {}) or {}
                params = data.get("normalized_goal", {}).get("parameters", {}) or {}

                plan = data.get("plan", [])
                pending_task = next((t for t in plan if t.get("requires_human_approval") and t.get("status") == "PENDING"), None)
                if not pending_task:
                    pending_task = next((t for t in plan if t.get("status") == "PENDING"), None)

                student_name = stud.name if stud else t1.get("name") or f"Student ({stud_id})"
                student_email = stud.email if stud else t1.get("email")

                results.append(PendingApprovalItem(
                    request_id=s.request_id,
                    student_id=stud_id or "UNKNOWN",
                    student_name=student_name,
                    student_email=student_email,
                    goal=data.get("original_goal") or (req.description if req else "Leave application"),
                    days=t4.get("days") or params.get("days") or 1,
                    category=t4.get("category") or params.get("category") or "general",
                    reason=params.get("reason") or t4.get("reason"),
                    attendance_percentage=t4.get("attendance_percentage"),
                    assigned_approver=t4.get("assigned_approver") or t4.get("approver_role") or "Academic Administrator",
                    current_status=data.get("current_status", "WAITING_FOR_HUMAN"),
                    human_approval_status=data.get("human_approval_status", "PENDING"),
                    pending_task_description=pending_task.get("description") if pending_task else "Approval required",
                    created_at=req.created_at.isoformat() if req and req.created_at else None
                ))
        except Exception:
            continue
    return results

@router.get("/{request_id}", response_model=AgentState)
def get_state(request_id: int, db: Session = Depends(get_db)):
    agent = AXORAAgent(db)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    return state

@router.get("/{request_id}/plan", response_model=List[Task])
def get_plan(request_id: int, db: Session = Depends(get_db)):
    agent = AXORAAgent(db)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    return state.plan

@router.get("/{request_id}/trace", response_model=List[TraceResponse])
def get_trace(request_id: int, db: Session = Depends(get_db)):
    return get_traces_by_request(db, request_id)

@router.post("/{request_id}/approve", response_model=AgentResult)
def approve(request_id: int, db: Session = Depends(get_db)):
    agent = AXORAAgent(db, auto_approve=False)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="Request not found")
    if state.human_approval_status != "PENDING":
        raise HTTPException(status_code=400, detail="Workflow is not waiting for approval")
    res = agent.approve(request_id)
    return res

@router.post("/{request_id}/reject", response_model=AgentResult)
def reject(request_id: int, db: Session = Depends(get_db)):
    agent = AXORAAgent(db, auto_approve=False)
    state = agent.get_state(request_id)
    if not state:
        raise HTTPException(status_code=404, detail="Request not found")
    if state.human_approval_status != "PENDING":
        raise HTTPException(status_code=400, detail="Workflow is not waiting for approval")
    res = agent.reject(request_id)
    return res
