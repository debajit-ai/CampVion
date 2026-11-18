from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class Task(BaseModel):
    task_id: str
    description: str
    dependencies: List[str] = []
    candidate_tools: List[str] = []
    status: str = "PENDING"  # PENDING, COMPLETED, FAILED
    requires_human_approval: bool = False

class AgentState(BaseModel):
    request_id: int
    student_id: str
    original_goal: str = ""
    normalized_goal: Optional[Dict[str, Any]] = None
    current_status: str = "IDLE"  # IDLE, UNDERSTANDING, PLANNING, EXECUTING, OBSERVING, REPLANNING, WAITING_FOR_HUMAN, COMPLETED, FAILED, ENDED_REJECTED, CANCELLED
    current_step: int = 0
    plan: List[Task] = []
    completed_tasks: List[str] = []
    pending_tasks: List[str] = []
    failed_tasks: List[str] = []
    observations: List[Dict[str, Any]] = []
    selected_tools: Dict[str, str] = {} # task_id -> tool_name
    tool_results: Dict[str, Any] = {} # task_id -> result
    replanning_count: int = 0
    human_approval_required: bool = False
    human_approval_status: str = "NONE" # NONE, PENDING, APPROVED, REJECTED, CANCELLED
    leave_request_id: Optional[int] = None
    leave_code: Optional[str] = None
    routed_to: Optional[str] = None
    decision_reason: Optional[str] = None
    final_result: Optional[str] = None
    error: Optional[str] = None
