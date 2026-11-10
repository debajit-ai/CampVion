import json
import pytest
from sqlalchemy.exc import IntegrityError
from app.db import models
from app.db.seed_engine import seed_campus_database

def test_database_integrity_and_relationships(db):
    """
    Verify foreign-key relationships and relational model consistency.
    """
    # 1. Departments and Courses
    dept = db.query(models.Department).filter(models.Department.code == "CSE").first()
    assert dept is not None
    assert dept.name == "School of Computer Science & Engineering"
    assert len(dept.programs) > 0
    assert len(dept.courses) > 0

    # 2. Student S001 relationships
    s1 = db.query(models.Student).filter(models.Student.student_id == "S001").first()
    assert s1 is not None
    assert s1.name == "Alice"
    assert s1.department is not None
    assert s1.residence_type == "hostel"
    assert len(s1.attendance_records) > 0
    assert len(s1.daily_attendance_records) > 0
    assert len(s1.course_registrations) > 0
    assert s1.hostel_allocation is not None
    assert len(s1.fee_accounts) > 0

def test_duplicate_prevention(db):
    """
    Verify that unique constraints on primary identifiers strictly prevent duplicate inserts.
    """
    # Duplicate student_id
    dup_student = models.Student(
        student_id="S001",
        name="Duplicate Alice",
        email="dup_alice@lpu.edu",
        program="B.Tech Computer Science",
        semester=5
    )
    db.add(dup_student)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Duplicate student email
    dup_email = models.Student(
        student_id="S998",
        name="Different Name",
        email="alice@lpu.edu",
        program="B.Tech Computer Science",
        semester=5
    )
    db.add(dup_email)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Duplicate course code
    dup_course = models.Course(
        course_code="CSE101",
        course_name="Duplicate Course",
        faculty="Dr. Test"
    )
    db.add(dup_course)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

def test_attendance_math_and_provenance(db):
    """
    Verify that summary attendance percentages match exact daily session log counts (100% provenance).
    """
    students = db.query(models.Student).all()
    assert len(students) >= 2

    for student in students:
        # Check summary records
        summaries = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.student_id
        ).all()
        for summary in summaries:
            # Check daily session logs for this course
            daily_logs = db.query(models.DailyAttendanceRecord).filter(
                models.DailyAttendanceRecord.student_id == student.student_id,
                models.DailyAttendanceRecord.course_id == summary.course_id
            ).all()

            if daily_logs:
                total_sessions = len(daily_logs)
                present_sessions = sum(1 for d in daily_logs if d.status == "present")

                # Provable mathematical equality
                assert summary.total_classes == total_sessions, f"Total classes mismatch for student {student.student_id}"
                assert summary.attended_classes == present_sessions, f"Attended classes mismatch for student {student.student_id}"

def test_leave_eligibility_calculations(client, db):
    """
    Verify leave eligibility tool and logic across eligible (S001, 75%) and ineligible (S002, 50%) students.
    """
    # S001 Alice Sharma: 30/40 = 75.0% -> Eligible
    res_s1 = client.post("/api/agent/run", json={"student_id": "S001", "goal": "I want to apply for 1 day leave"})
    assert res_s1.status_code == 200
    data_s1 = res_s1.json()
    assert data_s1["status"] == "WAITING_FOR_HUMAN"

    # S002 Bob Verma: 20/40 = 50.0% -> Ineligible
    res_s2 = client.post("/api/agent/run", json={"student_id": "S002", "goal": "I want to apply for 1 day leave"})
    assert res_s2.status_code == 200
    data_s2 = res_s2.json()
    assert data_s2["status"] == "FAILED"
    assert "below 75%" in data_s2["final_message"]

def test_policy_version_and_provenance_consistency(client, db):
    """
    Verify that all 10 policies are registered, labeled with illustrative_demo, and contain RAG chunks.
    """
    res = client.get("/api/policies/")
    assert res.status_code == 200
    policies = res.json()
    assert len(policies) >= 10

    categories = {p["category"] for p in policies}
    assert "attendance" in categories
    assert "leave" in categories
    assert "hostel" in categories
    assert "financial" in categories
    assert "support" in categories

    for p in policies:
        assert p["provenance_type"] == "illustrative_demo"
        assert p["verification_status"] == "verified"
        assert p["version"] is not None
        assert "rule_conditions" in p
        assert isinstance(p["rule_conditions"], dict)

    # Test single policy endpoint with chunks
    res_single = client.get("/api/policies/POL-ATT-001")
    assert res_single.status_code == 200
    pol_data = res_single.json()
    assert pol_data["policy_id"] == "POL-ATT-001"
    assert len(pol_data["chunks"]) > 0
    assert "75%" in pol_data["chunks"][0]["content_text"]

def test_tool_definitions_and_governance(client):
    """
    Verify tool registry completeness, input/output schemas, and governance authorization gates.
    """
    res = client.get("/api/tools/")
    assert res.status_code == 200
    tools = res.json()
    assert len(tools) >= 14

    tool_names = {t["name"] for t in tools}
    # Required core tools
    assert "get_student_profile" in tool_names
    assert "get_attendance" in tool_names
    assert "get_course_schedule" in tool_names
    assert "get_leave_policy" in tool_names
    assert "check_leave_eligibility" in tool_names
    assert "create_leave_application" in tool_names
    assert "get_leave_application_status" in tool_names
    # Extended campus tools
    assert "get_student_academic_summary" in tool_names
    assert "get_hostel_status" in tool_names
    assert "submit_hostel_service_request" in tool_names
    assert "get_fee_status" in tool_names
    assert "create_support_ticket" in tool_names
    assert "query_campus_policy" in tool_names
    assert "get_examination_schedule" in tool_names

    # Verify governance flags
    tool_map = {t["name"]: t for t in tools}
    assert tool_map["create_leave_application"]["requires_human_approval"] is True
    assert tool_map["submit_hostel_service_request"]["requires_human_approval"] is True
    assert tool_map["get_student_profile"]["requires_human_approval"] is False

    # Verify schema fields
    for t in tools:
        assert "input_schema" in t
        assert "output_schema" in t
        assert "retry_policy" in t
        assert "side_effects" in t
        assert "audit_requirements" in t

def test_evaluation_benchmark_dataset_completeness(client, db):
    """
    Verify that all 15 benchmark evaluation scenarios are present and structured.
    """
    res = client.get("/api/evaluation/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) == 15

    scenario_ids = [s["scenario_id"] for s in scenarios]
    for i in range(1, 16):
        expected_id = f"SCEN-{i:02d}"
        assert expected_id in scenario_ids

    # Check detail of SCEN-01
    scen_1 = next(s for s in scenarios if s["scenario_id"] == "SCEN-01")
    assert scen_1["student_id"] == "S001"
    assert scen_1["expected_eligibility"] is True
    assert len(scen_1["expected_workflow_steps"]) == 6

def test_evaluation_scenario_execution(client, db):
    """
    Execute scenario benchmark runner on SCEN-01 and verify agent assertions.
    """
    res = client.post("/api/evaluation/run/SCEN-01")
    assert res.status_code == 200
    data = res.json()
    assert data["scenario_id"] == "SCEN-01"
    assert data["benchmark_passed"] is True
    assert data["actual_status"] == "WAITING_FOR_HUMAN"
    assert len(data["passed_checks"]) > 0

def test_new_student_domain_endpoints(client):
    """
    Verify extended operational domain endpoints for student S001.
    """
    # 1. Academic Summary
    res_acad = client.get("/api/students/S001/academic-summary")
    assert res_acad.status_code == 200
    acad_data = res_acad.json()
    assert acad_data["student_id"] == "S001"
    assert acad_data["overall_attendance_percentage"] == 75.0
    assert acad_data["section"] == "K21CS"

    # 2. Hostel Info
    res_hst = client.get("/api/students/S001/hostel")
    assert res_hst.status_code == 200
    hst_data = res_hst.json()
    assert hst_data["student_id"] == "S001"
    assert hst_data["is_resident"] is True
    assert "Hostel" in hst_data["hostel_name"]

    # 3. Fees Info
    res_fee = client.get("/api/students/S001/fees")
    assert res_fee.status_code == 200
    fee_data = res_fee.json()
    assert fee_data["student_id"] == "S001"
    assert fee_data["total_fees"] >= 90000
    assert "status" in fee_data

    # 4. Support Tickets
    res_tkt = client.get("/api/students/S001/tickets")
    assert res_tkt.status_code == 200
    assert isinstance(res_tkt.json(), list)

def test_project_55_comparative_benchmark_api(client, db):
    """
    Verify Project 55 baseline comparison report endpoint and benchmark execution.
    """
    res = client.get("/api/evaluation/report")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "task_completion_rate" in data["summary"]
    assert data["summary"]["task_completion_rate"]["agentic_pct"] >= 90.0
    assert data["summary"]["task_completion_rate"]["baseline_pct"] <= 60.0
    assert data["summary"]["failure_recovery_rate"]["agentic_pct"] == 100.0
    assert data["summary"]["failure_recovery_rate"]["baseline_pct"] == 0.0
    assert len(data["scenarios"]) == 15

