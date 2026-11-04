import json
import pytest
from datetime import datetime, timezone
from app.db import models
from app.tools.registry import registry
from app.tools.campus_tools import (
    GetStudentProfileTool,
    GetAttendanceTool,
    CheckLeaveEligibilityTool,
    CreateLeaveApplicationTool,
    GetLeaveApplicationStatusTool,
    GetHostelStatusTool,
    SubmitHostelServiceRequestTool,
    GetFeeStatusTool,
    CreateSupportTicketTool,
    QueryCampusPolicyTool
)

# =============================================================================
# SCENARIO A: ELIGIBLE LEAVE REQUEST (DATABASE TRANSACTION VERIFICATION)
# =============================================================================
def test_scenario_a_eligible_leave_request_persists_to_db(client, db):
    """
    Test A: Eligible leave request for S001 (75% attendance).
    Verify that upon human approval, a real LeaveRequest record is persisted
    into SQLite with the exact policy approver (Advisor for <= 3 days).
    """
    initial_leave_count = db.query(models.LeaveRequest).count()

    # 1. Dispatch leave goal
    res = client.post("/api/agent/run", json={
        "student_id": "S001",
        "goal": "I want to apply for 2 days leave for a family function."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "WAITING_FOR_HUMAN"
    request_id = data["request_id"]

    # 2. Before approval: ensure no approved leave was prematurely inserted
    premature_leaves = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.student_id == "S001",
        models.LeaveRequest.status == "approved"
    ).all()
    assert len(premature_leaves) == 0

    # 3. Approve via Human Authorization Gate
    app_res = client.post(f"/api/agent/{request_id}/approve")
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["status"] == "COMPLETED"

    # 4. Verify actual database state
    new_leave_count = db.query(models.LeaveRequest).count()
    assert new_leave_count == initial_leave_count + 1

    latest_leave = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.student_id == "S001"
    ).order_by(models.LeaveRequest.id.desc()).first()

    assert latest_leave is not None
    assert latest_leave.student_id == "S001"
    assert latest_leave.days_count == 2
    assert latest_leave.status == "approved"
    assert latest_leave.assigned_approver == "Dr. Rajesh Rao"
    assert latest_leave.approver_role == "Advisor"
    assert "LV-2026-" in latest_leave.leave_code

    # 5. Verify trace record
    trace_res = client.get(f"/api/agent/{request_id}/trace")
    assert trace_res.status_code == 200
    traces = trace_res.json()
    events = [t["event_type"] for t in traces]
    assert "HUMAN_APPROVED" in events
    assert "WORKFLOW_COMPLETED" in events

# =============================================================================
# SCENARIO B: INELIGIBLE LEAVE REQUEST (ZERO CONFLICTING WRITES)
# =============================================================================
def test_scenario_b_ineligible_leave_request_blocks_db_writes(client, db):
    """
    Test B: Ineligible leave request for S002 (50% attendance < 75%).
    Verify that eligibility check fails cleanly, no approval gate is opened,
    and ZERO leave records are written to the database.
    """
    initial_leave_count = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.student_id == "S002"
    ).count()

    res = client.post("/api/agent/run", json={
        "student_id": "S002",
        "goal": "I need 2 days leave for an urgent personal matter."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert "below 75%" in data["final_message"]

    # Verify zero database writes occurred
    new_leave_count = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.student_id == "S002"
    ).count()
    assert new_leave_count == initial_leave_count

# =============================================================================
# SCENARIO C: ATTENDANCE ENQUIRY (MATHEMATICAL VERIFICATION)
# =============================================================================
def test_scenario_c_attendance_enquiry_real_records(client, db):
    """
    Test C: Attendance enquiry retrieving actual database records and
    confirming provenance matching between daily logs and summary.
    """
    tool = GetAttendanceTool()
    res = tool.execute(db=db, student_id="S001")
    assert isinstance(res, list)
    assert len(res) > 0
    assert res[0]["attended"] == 30
    assert res[0]["total"] == 40

    # Verify directly against daily attendance records
    daily_present = db.query(models.DailyAttendanceRecord).filter(
        models.DailyAttendanceRecord.student_id == "S001",
        models.DailyAttendanceRecord.status == "present"
    ).count()
    assert daily_present == 30

# =============================================================================
# SCENARIO D: MISSING STUDENT INFORMATION (SAFETY & INPUT VALIDATION)
# =============================================================================
def test_scenario_d_missing_student_fails_safely(client, db):
    """
    Test D: Request with an unassigned/unknown student ID.
    Verify structured error handling without uncaught server exceptions.
    """
    res = client.post("/api/agent/run", json={
        "student_id": "S999",
        "goal": "Apply for 1 day leave."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert "Student not found" in data["final_message"]

# =============================================================================
# SCENARIO E: INVALID LEAVE DATES / DURATION
# =============================================================================
def test_scenario_e_invalid_duration_rejected(client, db):
    """
    Test E: Request with negative duration (-2 days).
    Verify that eligibility tool detects and halts invalid date duration.
    """
    res = client.post("/api/agent/run", json={
        "student_id": "S001",
        "goal": "I want leave for -2 days."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert "must be at least 1 day" in data["final_message"]

# =============================================================================
# SCENARIO F: REQUEST REQUIRING SUPPORTING DOCUMENTS & ESCALATION
# =============================================================================
def test_scenario_f_prolonged_medical_leave_escalates_to_hod(client, db):
    """
    Test F: Prolonged medical leave (5 days).
    Under POL-LV-001 Tier 2 (>3 days), approver must escalate to Head of Department (HOD)
    and flag supporting documentation requirement under POL-ATT-002.
    """
    tool = CheckLeaveEligibilityTool()
    res = tool.execute(db=db, student_id="S001", days=5, category="medical", reason="high fever")
    assert res["eligible"] is True
    assert res["assigned_approver"] == "Head of Department (HOD)"
    assert res["approver_role"] == "HOD"
    assert res["requires_documentation"] is True

# =============================================================================
# SCENARIO G: REQUEST REQUIRING HUMAN APPROVAL (GATE ENFORCEMENT)
# =============================================================================
def test_scenario_g_human_approval_gate_enforcement(client, db):
    """
    Test G: Verify that execution strictly pauses at t5 (create_leave_application)
    and cannot be bypassed without explicit user authorization.
    """
    res = client.post("/api/agent/run", json={
        "student_id": "S001",
        "goal": "Apply for 1 day personal leave."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "WAITING_FOR_HUMAN"
    request_id = data["request_id"]

    # Verify plan inspection
    plan_res = client.get(f"/api/agent/{request_id}/plan")
    plan = plan_res.json()
    t5 = next(t for t in plan if t["task_id"] == "t5")
    assert t5["requires_human_approval"] is True
    assert t5["status"] == "PENDING"

# =============================================================================
# SCENARIO H: REJECTED APPROVAL PREVENTS ACTION EXECUTION
# =============================================================================
def test_scenario_h_rejection_prevents_db_write(client, db):
    """
    Test H: Human approver clicks Reject.
    Verify that status transitions to FAILED, consequential task is NOT executed,
    and no leave record is written.
    """
    initial_count = db.query(models.LeaveRequest).count()

    res = client.post("/api/agent/run", json={
        "student_id": "S001",
        "goal": "Apply for 1 day leave for family gathering."
    })
    request_id = res.json()["request_id"]

    # Reject
    rej_res = client.post(f"/api/agent/{request_id}/reject")
    assert rej_res.status_code == 200
    rej_data = rej_res.json()
    assert rej_data["status"] == "FAILED"
    assert "rejected" in rej_data["final_message"].lower()

    # Zero records added
    assert db.query(models.LeaveRequest).count() == initial_count

# =============================================================================
# SCENARIO I: TEMPORARY TOOL FAILURE FOLLOWED BY RECOVERY
# =============================================================================
def test_scenario_i_transient_failure_self_healing_recovery(client, db):
    """
    Test I: Simulated transient tool timeout on external attendance API.
    Verify self-healing loop recovers automatically and completes upon approval.
    """
    res = client.post("/api/agent/run", json={
        "student_id": "S001",
        "goal": "FAILURE_MODE=attendance_timeout Apply for 1 day leave."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "WAITING_FOR_HUMAN"
    assert data["replanning_count"] == 1
    request_id = data["request_id"]

    # Approve to finish
    app_res = client.post(f"/api/agent/{request_id}/approve")
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "COMPLETED"

# =============================================================================
# SCENARIO J: MULTI-STEP CAMPUS SERVICE (HOSTEL & LEAVE CROSS-DOMAIN)
# =============================================================================
def test_scenario_j_hostel_service_and_policy_integration(client, db):
    """
    Test J: Multi-step campus service request testing residential allocations,
    hostel service ticketing, fee status, and policy knowledge integration.
    """
    # 1. Query hostel allocation
    hostel_tool = GetHostelStatusTool()
    h_res = hostel_tool.execute(db=db, student_id="S001")
    assert h_res["is_resident"] is True
    assert "Hostel" in h_res["hostel_name"]

    # 2. Submit hostel night pass request
    submit_tool = SubmitHostelServiceRequestTool()
    req_res = submit_tool.execute(
        db=db,
        student_id="S001",
        request_type="night_out_pass",
        details="Visiting home for family festival",
        priority="high"
    )
    assert req_res["status"] == "pending_approval"
    assert "HR-2026-" in req_res["request_code"]

    # Verify record in database
    persisted_hr = db.query(models.HostelRequest).filter(
        models.HostelRequest.request_code == req_res["request_code"]
    ).first()
    assert persisted_hr is not None
    assert persisted_hr.student_id == "S001"
    assert persisted_hr.warden_approval_required == 1

    # 3. Query campus policy for hostel night curfew rules
    policy_tool = QueryCampusPolicyTool()
    pol_res = policy_tool.execute(db=db, query="hostel")
    assert pol_res["count"] > 0
    hostel_pol = pol_res["policies"][0]
    assert hostel_pol["category"] == "hostel"
    assert hostel_pol["provenance_type"] == "illustrative_demo"

    # 4. Check fee status
    fee_tool = GetFeeStatusTool()
    fee_res = fee_tool.execute(db=db, student_id="S001")
    assert fee_res["student_id"] == "S001"
    assert fee_res["total_fees"] >= 90000

