import json
import time
from sqlalchemy.orm import Session
from app.agent.state import AgentState, Task
from app.agent.goal import Goal
from app.agent.normalizer import GoalNormalizer
from app.agent.decomposer import GoalDecomposer
from app.agent.planner import Planner
from app.agent.tool_selector import ToolSelector
from app.agent.observer import Observer, ObservationResult
from app.agent.replanner import Replanner
from app.agent.policies import PolicyEngine
from app.agent.result import AgentResult
from typing import Any, Optional
from app.tools.registry import registry
from app.services.trace_service import create_trace
from app.schemas.trace import TraceCreate
from app.db.models import AgentStateModel, CampusRequest

class AXORAAgent:
    def __init__(
        self,
        db: Session,
        auto_approve: bool = False,
        start_date_hint: Optional[str] = None,
        actor_user: Optional[Any] = None,
        enforce_overlap_check: bool = False,
        ip_address: Optional[str] = None,
        leave_v2_fields: Optional[dict[str, Any]] = None,
    ):
        self.db = db
        self.auto_approve = auto_approve
        self.start_date_hint = start_date_hint
        self.actor_user = actor_user
        self.enforce_overlap_check = enforce_overlap_check
        self.ip_address = ip_address
        self.leave_v2_fields = leave_v2_fields or {}
        self.normalizer = GoalNormalizer()
        self.decomposer = GoalDecomposer()
        self.planner = Planner()
        self.tool_selector = ToolSelector()
        self.observer = Observer()
        self.replanner = Replanner()
        self.policy_engine = PolicyEngine()
        
    def _log_trace(self, request_id: int, step_number: int, event_type: str, component: str, action: str, status: str, input_data: str = None, output_data: str = None, error_message: str = None):
        try:
            create_trace(self.db, TraceCreate(
                request_id=request_id,
                step_number=step_number,
                event_type=event_type,
                component=component,
                action=action,
                status=status,
                input_data=input_data,
                output_data=output_data,
                error_message=error_message
            ))
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass

    def _save_state(self, state: AgentState):
        try:
            model = self.db.query(AgentStateModel).filter(AgentStateModel.request_id == state.request_id).first()
            if not model:
                model = AgentStateModel(request_id=state.request_id, state_data=state.model_dump_json())
                self.db.add(model)
            else:
                model.state_data = state.model_dump_json()

            # Keep CampusRequest status synchronized with AgentState
            req = self.db.query(CampusRequest).filter(CampusRequest.id == state.request_id).first()
            if req:
                req.status = state.current_status.lower()

            self.db.commit()
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass

    def get_state(self, request_id: int) -> AgentState:
        model = self.db.query(AgentStateModel).filter(AgentStateModel.request_id == request_id).first()
        if model:
            return AgentState.model_validate_json(model.state_data)
        return None

    def start(self, student_id: str, goal_text: str) -> AgentResult:
        start_time = time.time()
        # Create a new CampusRequest
        req = CampusRequest(student_id=student_id, request_type="agent_workflow", description=goal_text)
        self.db.add(req)
        self.db.commit()
        self.db.refresh(req)
        
        state = AgentState(request_id=req.id, student_id=student_id, original_goal=goal_text)
        state.current_step += 1
        self._log_trace(state.request_id, state.current_step, "GOAL_RECEIVED", "orchestrator", "start", "success", input_data=goal_text)
        self._save_state(state)
        
        return self.run(state.request_id, start_time=start_time)

    def run(self, request_id: int, start_time: float = None) -> AgentResult:
        if start_time is None:
            start_time = time.time()

        state = self.get_state(request_id)
        if not state:
            raise ValueError(f"State not found for request_id {request_id}")

        from fastapi import HTTPException

        try:
            if state.current_status == "IDLE":
                state.current_status = "UNDERSTANDING"
                
                # 1. Deterministic Goal Normalization
                goal = self.normalizer.normalize(state.student_id, state.original_goal)
                if self.start_date_hint and "start_date" not in goal.parameters:
                    goal.parameters["start_date"] = self.start_date_hint
                state.normalized_goal = goal.model_dump()
                state.current_step += 1
                self._log_trace(state.request_id, state.current_step, "GOAL_NORMALIZED", "orchestrator", "normalize", "success", output_data=json.dumps(state.normalized_goal))
                
                # 2. Goal Decomposition
                tasks = self.decomposer.decompose(goal)
                state.current_step += 1
                self._log_trace(state.request_id, state.current_step, "GOAL_DECOMPOSED", "decomposer", "decompose", "success", output_data=json.dumps([t.model_dump() for t in tasks]))
                
                state.current_status = "PLANNING"
                
                # 3. Topological Dependency Planning
                self.planner.create_plan(tasks, state)
                state.current_step += 1
                self._log_trace(state.request_id, state.current_step, "PLAN_CREATED", "planner", "plan", "success", output_data=json.dumps([t.model_dump() for t in state.plan]))
                
                state.current_status = "EXECUTING"

            while state.current_status == "EXECUTING" and state.pending_tasks:
                if state.human_approval_status == "REJECTED":
                    state.current_status = "ENDED_REJECTED"
                    state.error = state.decision_reason or "Request declined at institutional approval gate."
                    state.final_result = (
                        f"Leave request {state.leave_code or f'#{state.request_id}'} was declined: {state.error}"
                    )
                    state.current_step += 1
                    self._log_trace(state.request_id, state.current_step, "WORKFLOW_ENDED_REJECTED", "orchestrator", "terminate", "rejected", error_message=state.error)
                    break

                task_id = state.pending_tasks[0]
                task = next((t for t in state.plan if t.task_id == task_id), None)
                if not task:
                    raise ValueError(f"Task '{task_id}' not found in current plan")

                # Verify task dependencies
                unmet_deps = [dep for dep in task.dependencies if dep not in state.completed_tasks]
                if unmet_deps:
                    raise ValueError(f"Task '{task_id}' has unmet dependencies: {unmet_deps}")
                
                # Strict Human-in-the-Loop (HITL) Halt Gate
                # Halt immediately BEFORE tool selection or execution if task requires approval
                # or candidate tools involve consequential operations (leave application, hostel allocation)
                candidate_tools = getattr(task, "candidate_tools", []) or []
                is_consequential_task = (
                    task.requires_human_approval
                    or any(t in ["create_leave_application", "submit_hostel_service_request"] for t in candidate_tools)
                )

                if is_consequential_task and state.human_approval_status != "APPROVED":
                    if not self.auto_approve:
                        params = (state.normalized_goal or {}).get("parameters", {}) or {}
                        failure_mode_active = bool(params.get("failure_mode")) or ("failure_mode=" in state.original_goal.lower())
                        pause_message = "Pending Warden authorization at institutional approval gate."

                        if "create_leave_application" in candidate_tools and not failure_mode_active:
                            from app.services import leave_service

                            leave_rec, _ = leave_service.submit_leave_at_gate(
                                self.db,
                                student_id=state.student_id,
                                workflow_run_id=state.request_id,
                                days_count=int(params.get("days", 1) or 1),
                                category=str(params.get("category") or "personal"),
                                reason=str(params.get("reason") or "Personal leave"),
                                start_date_hint=params.get("start_date") or self.start_date_hint,
                                from_at=self.leave_v2_fields.get("from_at"),
                                to_at=self.leave_v2_fields.get("to_at"),
                                destination=self.leave_v2_fields.get("destination"),
                                college_snapshot=self.leave_v2_fields.get("college_snapshot"),
                                actor_user=self.actor_user,
                                ip_address=self.ip_address,
                                enforce_overlap_check=self.enforce_overlap_check,
                            )
                            state.leave_request_id = leave_rec.id
                            state.leave_code = leave_rec.leave_code
                            state.routed_to = f"{leave_rec.assigned_approver} ({leave_rec.routed_to_role})"
                            pause_message = (
                                f"Leave request {leave_rec.leave_code} submitted and pending approval by "
                                f"{leave_rec.assigned_approver} ({leave_rec.routed_to_role})."
                            )

                        state.current_status = "WAITING_FOR_HUMAN"
                        state.human_approval_required = True
                        state.human_approval_status = "PENDING"
                        state.final_result = pause_message
                        state.current_step += 1
                        self._log_trace(
                            state.request_id,
                            state.current_step,
                            "HUMAN_APPROVAL_REQUIRED",
                            "orchestrator",
                            "pause",
                            "pending",
                            output_data=json.dumps({
                                "task_id": task_id,
                                "task_description": task.description,
                                "leave_code": state.leave_code,
                                "routed_to": state.routed_to,
                                "message": pause_message,
                            })
                        )
                        self._save_state(state)
                        return self._build_result(state, pause_message, start_time=start_time)

                state.current_step += 1
                tool_name = self.tool_selector.select_tool(task)
                state.selected_tools[task_id] = tool_name
                self._log_trace(state.request_id, state.current_step, "TOOL_SELECTED", "tool_selector", "select", "success", output_data=tool_name)

                # Tool-level secondary safety gate: verify if selected tool requires approval
                tool = registry.get_tool(tool_name)
                tool_requires_approval = getattr(tool, "requires_human_approval", False) if tool else False
                if (tool_requires_approval or tool_name in ["create_leave_application", "submit_hostel_service_request"]) and state.human_approval_status != "APPROVED":
                    if not self.auto_approve:
                        task.requires_human_approval = True
                        state.current_status = "WAITING_FOR_HUMAN"
                        state.human_approval_required = True
                        state.human_approval_status = "PENDING"
                        state.current_step += 1
                        self._log_trace(
                            state.request_id,
                            state.current_step,
                            "HUMAN_APPROVAL_REQUIRED",
                            "orchestrator",
                            "pause",
                            "pending",
                            output_data=json.dumps({
                                "task_id": task_id,
                                "tool_name": tool_name,
                                "message": "Secondary safety gate: Consequential tool requires explicit human approval."
                            })
                        )
                        self._save_state(state)
                        return self._build_result(state, "Waiting for human approval", start_time=start_time)
                
                if not self.policy_engine.validate_tool_execution(tool_name):
                    raise ValueError(f"Tool {tool_name} failed policy check")

                kwargs = {}
                if "student_id" in tool.input_schema.get("properties", {}):
                    kwargs["student_id"] = state.student_id

                if tool_name in ["create_leave_application", "check_leave_eligibility"]:
                    params = state.normalized_goal.get("parameters", {}) if state.normalized_goal else {}
                    reason = params.get("reason", "personal leave")
                    days = params.get("days", 1)
                    category = params.get("category", "personal")
                    if "reason" in tool.input_schema.get("properties", {}):
                        kwargs["reason"] = reason
                    if "days" in tool.input_schema.get("properties", {}):
                        kwargs["days"] = days
                    if "category" in tool.input_schema.get("properties", {}):
                        kwargs["category"] = category

                if tool_name == "create_leave_application":
                    kwargs["request_id"] = state.request_id
                    kwargs["human_approved"] = (state.human_approval_status == "APPROVED")
                
                state.current_step += 1
                self._log_trace(state.request_id, state.current_step, "TOOL_STARTED", "executor", "execute", "pending", input_data=json.dumps(kwargs))
                
                # Failure simulation support for testing
                failure_mode = ""
                if state.normalized_goal and "failure_mode" in state.normalized_goal.get("parameters", {}):
                    failure_mode = state.normalized_goal["parameters"]["failure_mode"]
                elif "failure_mode=" in state.original_goal.lower():
                    failure_mode = state.original_goal.lower().split("failure_mode=")[-1].strip().split()[0]
                elif "FAILURE_MODE=" in state.original_goal:
                    failure_mode = state.original_goal.split("FAILURE_MODE=")[-1].strip().lower()

                if failure_mode == "schema_validation_error":
                    result = {"error": "schema_validation_error: Missing required parameters"}
                    state.current_step += 1
                    self._log_trace(state.request_id, state.current_step, "TOOL_FAILED", "executor", "execute", "failure", error_message="schema_validation_error")
                elif ("attendance_timeout" in failure_mode or "persistent_timeout" in failure_mode or "transient_timeout" in failure_mode) and tool_name == "get_attendance":
                    # Transient simulated failure on attempt 1; persistent if requested
                    if "persistent" in failure_mode or state.replanning_count == 0:
                        result = {"error": "attendance_timeout"}
                        state.current_step += 1
                        self._log_trace(state.request_id, state.current_step, "TOOL_FAILED", "executor", "execute", "failure", error_message="attendance_timeout")
                    else:
                        result = tool.execute(db=self.db, **kwargs)
                        state.current_step += 1
                        self._log_trace(state.request_id, state.current_step, "TOOL_COMPLETED", "executor", "execute", "success", output_data=json.dumps(result))
                elif ("unrecoverable" in failure_mode or "database_corrupted" in failure_mode) and tool_name == "get_student_profile":
                    result = {"error": "database_corrupted"}
                    state.current_step += 1
                    self._log_trace(state.request_id, state.current_step, "TOOL_FAILED", "executor", "execute", "failure", error_message="database_corrupted")
                else:
                    try:
                        result = tool.execute(db=self.db, **kwargs)
                        state.current_step += 1
                        self._log_trace(state.request_id, state.current_step, "TOOL_COMPLETED", "executor", "execute", "success", output_data=json.dumps(result))
                    except Exception as e:
                        try:
                            self.db.rollback()
                        except Exception:
                            pass
                        result = {"error": str(e)}
                        state.current_step += 1
                        self._log_trace(state.request_id, state.current_step, "TOOL_FAILED", "executor", "execute", "failure", error_message=str(e))
                
                state.tool_results[task_id] = result
                
                state.current_status = "OBSERVING"
                obs = self.observer.observe(tool_name, result)
                state.observations.append({"task_id": task_id, "observation": obs})
                state.current_step += 1
                self._log_trace(state.request_id, state.current_step, "OBSERVATION_RECEIVED", "observer", "observe", "success", output_data=obs)
                
                if obs == ObservationResult.SUCCESS:
                    state.pending_tasks.pop(0)
                    state.completed_tasks.append(task_id)
                    if task_id in state.failed_tasks:
                        state.failed_tasks.remove(task_id)
                    task.status = "COMPLETED"
                    state.current_status = "EXECUTING"
                    if task.requires_human_approval:
                        state.human_approval_required = False
                elif obs == ObservationResult.RECOVERABLE_FAILURE:
                    state.current_status = "REPLANNING"
                    if task_id not in state.failed_tasks:
                        state.failed_tasks.append(task_id)
                    task.status = "FAILED"
                    if self.replanner.can_replan(state):
                        state.pending_tasks.pop(0)
                        self.replanner.replan(state, task_id)
                        state.current_step += 1
                        self._log_trace(state.request_id, state.current_step, "REPLAN_TRIGGERED", "replanner", "replan", "success")
                        state.current_status = "EXECUTING"
                    else:
                        state.current_status = "FAILED"
                        state.error = "Max replanning limit reached."
                        state.current_step += 1
                        self._log_trace(state.request_id, state.current_step, "WORKFLOW_FAILED", "orchestrator", "terminate", "failure", error_message=state.error)
                        break
                else:
                    state.current_status = "FAILED"
                    if task_id not in state.failed_tasks:
                        state.failed_tasks.append(task_id)
                    task.status = "FAILED"
                    err_msg = ""
                    if isinstance(result, dict):
                        err_msg = result.get("error") or result.get("reason") or ""
                    state.error = f"Unrecoverable failure on task {task_id}: {err_msg}".strip(": ")
                    state.current_step += 1
                    self._log_trace(state.request_id, state.current_step, "WORKFLOW_FAILED", "orchestrator", "terminate", "failure", error_message=state.error)
                    break

            if state.current_status == "EXECUTING" and not state.pending_tasks:
                state.current_status = "COMPLETED"
                if state.leave_code:
                    state.final_result = f"Leave request {state.leave_code} approved and recorded."
                else:
                    state.final_result = "Request completed and recorded."
                state.current_step += 1
                self._log_trace(state.request_id, state.current_step, "WORKFLOW_COMPLETED", "orchestrator", "complete", "success")

        except HTTPException:
            state.current_status = "FAILED"
            self._save_state(state)
            raise

        except Exception as e:
            state.current_status = "FAILED"
            state.error = str(e)
            if state.pending_tasks:
                failed_tid = state.pending_tasks[0]
                if failed_tid not in state.failed_tasks:
                    state.failed_tasks.append(failed_tid)
                for t in state.plan:
                    if t.task_id == failed_tid:
                        t.status = "FAILED"
            state.current_step += 1
            self._log_trace(state.request_id, state.current_step, "WORKFLOW_FAILED", "orchestrator", "terminate", "failure", error_message=str(e))

        self._save_state(state)
        return self._build_result(state, state.final_result or state.error or "Pending approval", start_time=start_time)

    def _build_result(self, state: AgentState, message: str, start_time: float = None) -> AgentResult:
        exec_time = 0.0
        if start_time:
            exec_time = round(time.time() - start_time, 3)

        has_human_intervention = (
            state.human_approval_required
            or state.human_approval_status in ["APPROVED", "REJECTED", "CANCELLED"]
        )
        return AgentResult(
            request_id=state.request_id,
            status=state.current_status,
            original_goal=state.original_goal,
            completed_tasks=state.completed_tasks,
            failed_tasks=state.failed_tasks,
            replanning_count=state.replanning_count,
            human_intervention_count=1 if has_human_intervention else 0,
            final_message=message,
            execution_time=exec_time,
            trace_id=state.request_id
        )
        
    def approve(self, request_id: int):
        state = self.get_state(request_id)
        if state and state.human_approval_status == "PENDING":
            state.human_approval_status = "APPROVED"
            state.current_status = "EXECUTING"
            state.current_step += 1
            self._log_trace(state.request_id, state.current_step, "HUMAN_APPROVED", "orchestrator", "approve", "success")
            self._save_state(state)
            return self.run(request_id)
        return None
        
    def reject(self, request_id: int, reason: Optional[str] = None):
        state = self.get_state(request_id)
        if state and state.human_approval_status == "PENDING":
            state.human_approval_status = "REJECTED"
            state.decision_reason = reason or "Rejected by administrator at approval gate."
            state.current_status = "EXECUTING"
            state.current_step += 1
            self._log_trace(
                state.request_id,
                state.current_step,
                "HUMAN_REJECTED",
                "orchestrator",
                "reject",
                "success",
                output_data=json.dumps({"reason": state.decision_reason}),
            )
            self._save_state(state)
            return self.run(request_id)
        return None

    def cancel(self, request_id: int):
        state = self.get_state(request_id)
        if state and state.human_approval_status == "PENDING":
            state.human_approval_status = "CANCELLED"
            state.current_status = "CANCELLED"
            state.final_result = "Withdrawn by student prior to approval decision."
            state.current_step += 1
            self._log_trace(
                state.request_id,
                state.current_step,
                "WORKFLOW_CANCELLED",
                "orchestrator",
                "cancel",
                "cancelled",
            )
            self._save_state(state)
            return self._build_result(state, state.final_result)
        return None
