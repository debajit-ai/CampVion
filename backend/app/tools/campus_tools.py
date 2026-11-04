import json
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.tools.base import BaseTool
from app.services import student_service
from app.db import models

def get_utc_now():
    return datetime.now(timezone.utc)

# =============================================================================
# 1. GET STUDENT PROFILE TOOL (CORE OPERATIONAL)
# =============================================================================
class GetStudentProfileTool(BaseTool):
    name = "get_student_profile"
    description = "Retrieve basic identity and academic registration details for a student"
    category = "student_records"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "University Student ID (e.g. S001)"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "name": {"type": "string"},
            "email": {"type": "string"},
            "program": {"type": "string"},
            "semester": {"type": "integer"},
            "department": {"type": "string"},
            "enrollment_status": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty", "admin"]
    expected_failure_conditions = ["STUDENT_NOT_FOUND", "DB_CONNECTION_TIMEOUT", "INACTIVE_ENROLLMENT"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout", "temporary_network"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        if not student_id or not isinstance(student_id, str):
            return {"error": "Invalid student ID format"}

        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        enrollment_status = getattr(student, "enrollment_status", "active")
        if enrollment_status in ["suspended", "withdrawn"]:
            return {"error": f"Student enrollment status is inactive ({enrollment_status})"}

        return {
            "student_id": student.student_id,
            "name": student.name,
            "email": student.email,
            "program": student.program,
            "semester": student.semester,
            "department": getattr(student, "department", "School of Computer Science & Engineering"),
            "enrollment_status": enrollment_status
        }

# =============================================================================
# 2. GET ATTENDANCE TOOL (CORE OPERATIONAL)
# =============================================================================
class GetAttendanceTool(BaseTool):
    name = "get_attendance"
    description = "Retrieve aggregated course-wise attendance metrics for a student"
    category = "academic"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "University Student ID"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "course_id": {"type": "integer"},
                "attended": {"type": "integer"},
                "total": {"type": "integer"}
            }
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty", "admin"]
    expected_failure_conditions = ["NO_ATTENDANCE_RECORDS", "STUDENT_NOT_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout", "attendance_timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        records = student_service.get_student_attendance(db, student_id)
        if not records:
            return {"error": "No attendance records found or student not found"}

        return [{"course_id": r.course_id, "attended": r.attended_classes, "total": r.total_classes} for r in records]

# =============================================================================
# 3. GET COURSE SCHEDULE TOOL (CORE OPERATIONAL)
# =============================================================================
class GetCourseScheduleTool(BaseTool):
    name = "get_course_schedule"
    description = "Retrieve current course enrollments and designated faculty instructors for a student"
    category = "academic"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "University Student ID"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "course_code": {"type": "string"},
                "course_name": {"type": "string"},
                "faculty": {"type": "string"}
            }
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty"]
    expected_failure_conditions = ["NO_COURSES_REGISTERED", "STUDENT_NOT_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        courses = student_service.get_student_courses(db, student_id)
        return [{"course_code": c.course_code, "course_name": c.course_name, "faculty": c.faculty} for c in courses]

# =============================================================================
# 4. GET LEAVE POLICY TOOL (POLICY & KNOWLEDGE LAYER)
# =============================================================================
class GetLeavePolicyTool(BaseTool):
    name = "get_leave_policy"
    description = "Retrieve university regulations and attendance threshold requirements for student leaves"
    category = "policy"
    input_schema = {
        "type": "object",
        "properties": {}
    }
    output_schema = {
        "type": "object",
        "properties": {
            "policy": {"type": "string"},
            "threshold": {"type": "number"},
            "delegation": {"type": "string"},
            "provenance": {"type": "string"},
            "version": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty", "public"]
    expected_failure_conditions = []
    retry_policy = {"max_retries": 1, "retryable_errors": [], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "none"

    def execute(self, db: Session = None, **kwargs) -> Any:
        policy_text = "Students must have >75% attendance. Leaves require HOD approval if >3 days."
        threshold = 75.0
        delegation = "Advisor <=3 days, HOD >3 days, Proctor >7 days"
        provenance = "illustrative_demo"
        version = "2.0"

        if db:
            p_att = db.query(models.CampusPolicy).filter(models.CampusPolicy.policy_id == "POL-ATT-001").first()
            p_lv = db.query(models.CampusPolicy).filter(models.CampusPolicy.policy_id == "POL-LV-001").first()
            if p_att and p_lv:
                try:
                    cond_att = json.loads(p_att.rule_conditions)
                    cond_lv = json.loads(p_lv.rule_conditions)
                    threshold = float(cond_att.get("min_percentage_for_leave", 75.0))
                    t1_max = cond_lv.get("tier_1_max_days", 3)
                    t1_app = cond_lv.get("tier_1_approver", "Faculty Advisor")
                    t2_app = cond_lv.get("tier_2_approver", "Head of Department (HOD)")
                    t3_app = cond_lv.get("tier_3_approver", "Proctor / Dean Student Welfare")
                    delegation = f"Tier 1 (<={t1_max} days): {t1_app}; Tier 2: {t2_app}; Tier 3: {t3_app}"
                    provenance = p_lv.provenance_type
                    version = p_lv.version
                    policy_text = f"Minimum {threshold:.0f}% attendance required under {p_att.policy_id}. Approvals tiered under {p_lv.policy_id}."
                except Exception:
                    pass

        return {
            "policy": policy_text,
            "threshold": threshold,
            "delegation": delegation,
            "provenance": provenance,
            "version": version
        }

# =============================================================================
# 5. CHECK LEAVE ELIGIBILITY TOOL (POLICY-DRIVEN DECISION GATE)
# =============================================================================
class CheckLeaveEligibilityTool(BaseTool):
    name = "check_leave_eligibility"
    description = "Evaluate whether a student satisfies policy attendance thresholds, date limits, and documentation criteria"
    category = "leave"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "University Student ID"},
            "days": {"type": "integer", "description": "Requested leave duration in days", "default": 1},
            "category": {"type": "string", "description": "Leave category", "default": "personal"},
            "reason": {"type": "string", "description": "Leave justification", "default": ""}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "eligible": {"type": "boolean"},
            "status": {"type": "string"},
            "reason": {"type": "string"},
            "attendance_percentage": {"type": "number"},
            "assigned_approver": {"type": "string"},
            "approver_role": {"type": "string"},
            "policy_applied": {"type": "string"},
            "policy_provenance": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty", "system"]
    expected_failure_conditions = [
        "NO_ATTENDANCE_DATA",
        "BELOW_ATTENDANCE_THRESHOLD",
        "INVALID_DURATION",
        "INACTIVE_ENROLLMENT",
        "DUPLICATE_ACTIVE_REQUEST"
    ]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "eligibility_audit_log"

    def execute(
        self,
        db: Session,
        student_id: str,
        days: int = 1,
        category: str = "personal",
        reason: str = ""
    ) -> Any:
        # 1. Validate student existence and active status
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"eligible": False, "status": "ineligible", "reason": "Student not found"}

        enrollment_status = getattr(student, "enrollment_status", "active")
        if enrollment_status in ["suspended", "withdrawn"]:
            return {
                "eligible": False,
                "status": "ineligible",
                "reason": f"Student enrollment status is {enrollment_status}"
            }

        # 2. Validate duration
        if days is not None and days <= 0:
            return {
                "eligible": False,
                "status": "ineligible",
                "reason": f"Invalid leave duration ({days} days). Duration must be at least 1 day."
            }

        # 3. Retrieve policy thresholds from database
        threshold = 75.0
        policy_id = "POL-ATT-001"
        policy_prov = "illustrative_demo"
        tier_1_max = 3
        tier_1_app = getattr(student, "advisor_name", "Faculty Advisor") or "Faculty Advisor"
        tier_2_app = "Head of Department (HOD)"
        tier_3_app = "Proctor / Dean Student Welfare"

        if db:
            p_att = db.query(models.CampusPolicy).filter(models.CampusPolicy.policy_id == "POL-ATT-001").first()
            if p_att:
                try:
                    cond = json.loads(p_att.rule_conditions)
                    threshold = float(cond.get("min_percentage_for_leave", 75.0))
                    policy_prov = p_att.provenance_type
                except Exception:
                    pass

            p_lv = db.query(models.CampusPolicy).filter(models.CampusPolicy.policy_id == "POL-LV-001").first()
            if p_lv:
                try:
                    cond_lv = json.loads(p_lv.rule_conditions)
                    tier_1_max = int(cond_lv.get("tier_1_max_days", 3))
                    tier_2_app = cond_lv.get("tier_2_approver", "Head of Department (HOD)")
                    tier_3_app = cond_lv.get("tier_3_approver", "Proctor / Dean Student Welfare")
                except Exception:
                    pass

        # 4. Check attendance metrics
        records = student_service.get_student_attendance(db, student_id)
        if not records:
            return {"eligible": False, "status": "ineligible", "reason": "No attendance data"}

        total_attended = sum(r.attended_classes for r in records)
        total_classes = sum(r.total_classes for r in records)
        if total_classes == 0:
            percentage = 100.0
        else:
            percentage = (total_attended / total_classes) * 100

        # Exact boundary check
        if percentage < threshold:
            return {
                "eligible": False,
                "status": "ineligible",
                "reason": f"Attendance is {percentage:.2f}%, which is below {threshold:.0f}%",
                "attendance_percentage": round(percentage, 2),
                "policy_applied": policy_id,
                "policy_provenance": policy_prov
            }

        # 5. Determine approval hierarchy
        effective_days = days or 1
        if effective_days <= tier_1_max:
            approver = tier_1_app
            role = "Advisor"
        elif effective_days <= 7:
            approver = tier_2_app
            role = "HOD"
        else:
            approver = tier_3_app
            role = "Proctor"

        # 6. Check documentation requirements
        requires_doc = (category == "medical" and effective_days > 2)

        return {
            "eligible": True,
            "status": "eligible",
            "reason": f"Attendance is {percentage:.2f}%",
            "attendance_percentage": round(percentage, 2),
            "days": effective_days,
            "category": category,
            "assigned_approver": approver,
            "approver_role": role,
            "requires_documentation": requires_doc,
            "policy_applied": policy_id,
            "policy_provenance": policy_prov
        }

# =============================================================================
# 6. CREATE LEAVE APPLICATION TOOL (GOVERNED ACTION GATE & DB WRITER)
# =============================================================================
class CreateLeaveApplicationTool(BaseTool):
    name = "create_leave_application"
    description = "Submit and persist a formal student leave request in the institutional database"
    category = "leave"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "University Student ID"},
            "reason": {"type": "string", "description": "Justification for absence"},
            "days": {"type": "integer", "description": "Requested absence duration in days", "default": 1},
            "category": {"type": "string", "description": "Leave category", "default": "personal"}
        },
        "required": ["student_id", "reason", "days"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "leave_code": {"type": "string"},
            "message": {"type": "string"},
            "assigned_approver": {"type": "string"},
            "approver_role": {"type": "string"}
        }
    }
    requires_human_approval = True  # STRICT CONTEXTUAL AUTHORIZATION GATE
    required_permissions = ["student"]
    expected_failure_conditions = ["STUDENT_NOT_FOUND", "DB_WRITE_ERROR"]
    retry_policy = {"max_retries": 1, "retryable_errors": [], "is_idempotent": False}
    side_effects = "state_modification_record_created"
    audit_requirements = "immutable_action_audit_log"

    def execute(
        self,
        db: Session,
        student_id: str,
        reason: str,
        days: int,
        category: str = "personal",
        request_id: int = None,
        human_approved: bool = False
    ) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        # Determine approver from duration
        effective_days = days or 1
        if effective_days <= 3:
            approver = getattr(student, "advisor_name", "Dr. Rajesh Rao") or "Faculty Advisor"
            role = "Advisor"
        elif effective_days <= 7:
            approver = "Head of Department (HOD)"
            role = "HOD"
        else:
            approver = "Proctor / Dean Student Welfare"
            role = "Proctor"

        # Unique sequential leave reference code
        existing_count = db.query(models.LeaveRequest).count()
        leave_code = f"LV-2026-{(existing_count + 1):04d}"

        start_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        end_date = (datetime.now(timezone.utc) + timedelta(days=effective_days)).strftime("%Y-%m-%d")

        # Persist real LeaveRequest record
        leave_record = models.LeaveRequest(
            leave_code=leave_code,
            student_id=student.student_id,
            category=category or "personal",
            start_date=start_date,
            end_date=end_date,
            days_count=effective_days,
            reason=reason or "Personal leave",
            supporting_doc_url=None,
            doc_required=1 if (category == "medical" and effective_days > 2) else 0,
            status="approved" if human_approved else "pending",
            assigned_approver=approver,
            approver_role=role,
            submitted_at=get_utc_now(),
            decided_at=get_utc_now() if human_approved else None,
            decision_remarks="Approved by Human Authorization Gate" if human_approved else None
        )

        try:
            db.add(leave_record)
            db.commit()
            db.refresh(leave_record)
        except Exception as e:
            db.rollback()
            return {"error": f"Failed to persist leave application: {str(e)}"}

        return {
            "status": "created",
            "leave_code": leave_record.leave_code,
            "student_id": student.student_id,
            "category": leave_record.category,
            "days_count": leave_record.days_count,
            "assigned_approver": leave_record.assigned_approver,
            "approver_role": leave_record.approver_role,
            "approval_status": leave_record.status,
            "message": "Leave application submitted and awaiting approval"
        }

# =============================================================================
# 7. GET LEAVE APPLICATION STATUS TOOL (DATABASE RECORD QUERY)
# =============================================================================
class GetLeaveApplicationStatusTool(BaseTool):
    name = "get_leave_application_status"
    description = "Check the processing state and approver remarks of a submitted leave application from the database"
    category = "leave"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "University Student ID"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "leave_code": {"type": "string"},
            "message": {"type": "string"},
            "assigned_approver": {"type": "string"},
            "approver_role": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty"]
    expected_failure_conditions = ["NO_APPLICATION_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        # Query actual database record
        latest = db.query(models.LeaveRequest).filter(
            models.LeaveRequest.student_id == student_id
        ).order_by(models.LeaveRequest.id.desc()).first()

        if not latest:
            return {
                "status": "pending",
                "message": "Your recent leave application is pending approval"
            }

        return {
            "status": latest.status,
            "leave_code": latest.leave_code,
            "student_id": latest.student_id,
            "category": latest.category,
            "days_count": latest.days_count,
            "assigned_approver": latest.assigned_approver,
            "approver_role": latest.approver_role,
            "submitted_at": latest.submitted_at.isoformat() if latest.submitted_at else None,
            "decision_remarks": latest.decision_remarks,
            "message": f"Your leave application {latest.leave_code} is {latest.status}"
        }

# =============================================================================
# 8. GET STUDENT ACADEMIC SUMMARY TOOL (EXTENDED OPERATIONAL)
# =============================================================================
class GetStudentAcademicSummaryTool(BaseTool):
    name = "get_student_academic_summary"
    description = "Retrieve comprehensive academic standing, department, section, and faculty advisor info"
    category = "academic"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "department": {"type": "string"},
            "program": {"type": "string"},
            "academic_year": {"type": "integer"},
            "semester": {"type": "integer"},
            "section": {"type": "string"},
            "enrollment_status": {"type": "string"},
            "advisor_name": {"type": "string"},
            "advisor_email": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty", "admin"]
    expected_failure_conditions = ["STUDENT_NOT_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        attendance_records = student_service.get_student_attendance(db, student_id)
        total_att = sum(r.attended_classes for r in attendance_records)
        total_cls = sum(r.total_classes for r in attendance_records)
        overall_att = round((total_att / total_cls * 100), 2) if total_cls > 0 else 100.0

        return {
            "student_id": student.student_id,
            "department": getattr(student, "department", "School of Computer Science & Engineering"),
            "program": student.program,
            "academic_year": getattr(student, "academic_year", 3),
            "semester": student.semester,
            "section": getattr(student, "section", "K21CS"),
            "enrollment_status": getattr(student, "enrollment_status", "active"),
            "advisor_name": getattr(student, "advisor_name", "Dr. Rajesh Rao"),
            "advisor_email": getattr(student, "advisor_email", "rajesh.rao@lpu.edu"),
            "overall_attendance_percentage": overall_att,
            "enrolled_courses_count": len(attendance_records)
        }

# =============================================================================
# 9. GET HOSTEL STATUS TOOL (HOSTEL SERVICES)
# =============================================================================
class GetHostelStatusTool(BaseTool):
    name = "get_hostel_status"
    description = "Retrieve student hostel residency details, room allocation, and warden contact"
    category = "hostel"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "is_resident": {"type": "boolean"},
            "hostel_name": {"type": "string"},
            "room_number": {"type": "string"},
            "warden_name": {"type": "string"},
            "warden_contact": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "warden", "admin"]
    expected_failure_conditions = ["HOSTEL_RECORD_NOT_FOUND", "STUDENT_NOT_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        allocation = db.query(models.HostelAllocation).filter(models.HostelAllocation.student_id == student_id).first()
        if not allocation:
            res_type = getattr(student, "residence_type", "day_scholar")
            return {
                "student_id": student_id,
                "is_resident": False,
                "residence_type": res_type,
                "message": "Student is registered as day scholar (no active hostel room allocation)"
            }

        return {
            "student_id": student_id,
            "is_resident": True,
            "hostel_name": allocation.hostel_name,
            "block": allocation.block,
            "room_number": allocation.room_number,
            "bed_number": allocation.bed_number,
            "warden_name": allocation.warden_name,
            "warden_contact": allocation.warden_contact,
            "status": allocation.status
        }

# =============================================================================
# 10. SUBMIT HOSTEL SERVICE REQUEST TOOL (GOVERNED ACTION GATE & DB WRITER)
# =============================================================================
class SubmitHostelServiceRequestTool(BaseTool):
    name = "submit_hostel_service_request"
    description = "Submit a hostel maintenance, room transfer, or night out pass request"
    category = "hostel"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "request_type": {"type": "string", "enum": ["maintenance", "room_change", "night_out_pass", "complaint"]},
            "details": {"type": "string"},
            "priority": {"type": "string", "enum": ["low", "medium", "high", "emergency"], "default": "medium"}
        },
        "required": ["student_id", "request_type", "details"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "request_code": {"type": "string"},
            "message": {"type": "string"}
        }
    }
    requires_human_approval = True  # Governed by warden approval gate
    required_permissions = ["student", "hostel_resident"]
    expected_failure_conditions = ["NOT_A_HOSTEL_RESIDENT", "STUDENT_NOT_FOUND", "DB_WRITE_ERROR"]
    retry_policy = {"max_retries": 1, "retryable_errors": [], "is_idempotent": False}
    side_effects = "state_modification_record_created"
    audit_requirements = "hostel_service_audit_log"

    def execute(self, db: Session, student_id: str, request_type: str, details: str, priority: str = "medium") -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        allocation = db.query(models.HostelAllocation).filter(models.HostelAllocation.student_id == student_id).first()
        if not allocation:
            return {"error": "Student is not registered in university hostel residence"}

        count = db.query(models.HostelRequest).count()
        request_code = f"HR-2026-{(count + 1):04d}"

        requires_warden = 1 if request_type in ["night_out_pass", "room_change"] else 0

        h_req = models.HostelRequest(
            request_code=request_code,
            student_id=student.student_id,
            request_type=request_type,
            details=details,
            priority=priority or "medium",
            warden_approval_required=requires_warden,
            status="pending",
            created_at=get_utc_now(),
            resolution_notes=None
        )

        try:
            db.add(h_req)
            db.commit()
            db.refresh(h_req)
        except Exception as e:
            db.rollback()
            return {"error": f"Failed to persist hostel request: {str(e)}"}

        return {
            "status": "pending_approval",
            "request_code": h_req.request_code,
            "student_id": student.student_id,
            "request_type": h_req.request_type,
            "message": f"Hostel {request_type} request {h_req.request_code} registered in system."
        }

# =============================================================================
# 11. GET FEE STATUS TOOL (FINANCIAL SERVICES)
# =============================================================================
class GetFeeStatusTool(BaseTool):
    name = "get_fee_status"
    description = "Retrieve semester tuition fees, payments, outstanding balance, and active scholarships"
    category = "financial"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "total_fees": {"type": "integer"},
            "paid_amount": {"type": "integer"},
            "outstanding_balance": {"type": "integer"},
            "status": {"type": "string"},
            "due_date": {"type": "string"},
            "scholarships": {"type": "array"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "finance", "admin"]
    expected_failure_conditions = ["STUDENT_NOT_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "financial_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        fee_account = db.query(models.FeeAccount).filter(models.FeeAccount.student_id == student_id).first()
        scholarship = db.query(models.ScholarshipRecord).filter(models.ScholarshipRecord.student_id == student_id).first()

        total = fee_account.total_fees if fee_account else 120000
        paid = fee_account.paid_amount if fee_account else 120000
        balance = fee_account.outstanding_balance if fee_account else 0
        status = fee_account.status if fee_account else "cleared"
        due_date = fee_account.due_date if fee_account else "2026-11-30"

        return {
            "student_id": student_id,
            "total_fees": total,
            "paid_amount": paid,
            "outstanding_balance": balance,
            "status": status,
            "due_date": due_date,
            "scholarship": {
                "name": scholarship.scholarship_name,
                "amount": scholarship.amount_per_semester,
                "status": scholarship.status
            } if scholarship else None
        }

# =============================================================================
# 12. CREATE SUPPORT TICKET TOOL (SUPPORT SERVICES & DB WRITER)
# =============================================================================
class CreateSupportTicketTool(BaseTool):
    name = "create_support_ticket"
    description = "Create an IT helpdesk, transport, library, or campus facilities support ticket in the database"
    category = "support"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "category": {"type": "string", "enum": ["it_support", "library", "transport", "id_card", "facilities", "general"]},
            "subject": {"type": "string"},
            "description": {"type": "string"},
            "priority": {"type": "string", "enum": ["low", "medium", "high"], "default": "medium"}
        },
        "required": ["student_id", "category", "subject", "description"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "ticket_number": {"type": "string"},
            "message": {"type": "string"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty"]
    expected_failure_conditions = ["STUDENT_NOT_FOUND", "DB_WRITE_ERROR"]
    retry_policy = {"max_retries": 2, "retryable_errors": ["timeout"], "is_idempotent": False}
    side_effects = "state_modification_record_created"
    audit_requirements = "ticket_creation_audit_log"

    def execute(self, db: Session, student_id: str, category: str, subject: str, description: str, priority: str = "medium") -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        team_map = {
            "it_support": "Campus IT Helpdesk",
            "library": "Library Circulation Desk",
            "transport": "Transport Operations Office",
            "id_card": "Registrar Counter",
            "facilities": "Estate & Facility Management",
            "general": "Student Welfare Desk"
        }
        assigned_team = team_map.get(category, "Campus IT Helpdesk")

        count = db.query(models.SupportTicket).count()
        ticket_number = f"TKT-2026-{(count + 1):04d}"

        tkt = models.SupportTicket(
            ticket_number=ticket_number,
            student_id=student.student_id,
            category=category,
            subject=subject,
            description=description,
            priority=priority or "medium",
            status="open",
            assigned_team=assigned_team,
            created_at=get_utc_now()
        )

        try:
            db.add(tkt)
            db.commit()
            db.refresh(tkt)
        except Exception as e:
            db.rollback()
            return {"error": f"Failed to persist support ticket: {str(e)}"}

        return {
            "status": "created",
            "ticket_number": tkt.ticket_number,
            "student_id": student.student_id,
            "category": tkt.category,
            "assigned_team": tkt.assigned_team,
            "message": f"Support ticket {tkt.ticket_number} created and routed to {tkt.assigned_team}."
        }

# =============================================================================
# 13. QUERY CAMPUS POLICY TOOL (POLICY RETRIEVAL)
# =============================================================================
class QueryCampusPolicyTool(BaseTool):
    name = "query_campus_policy"
    description = "Query the structured university policy repository by domain or keyword"
    category = "policy"
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search keyword or policy domain (attendance, leave, hostel, fee, exam)"}
        },
        "required": ["query"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "count": {"type": "integer"},
            "policies": {"type": "array"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty", "public"]
    expected_failure_conditions = []
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "none"

    def execute(self, db: Session, query: str) -> Any:
        q_lower = query.lower()
        policies = db.query(models.CampusPolicy).all()
        matched = []
        for p in policies:
            if (
                q_lower in p.category.lower() or
                q_lower in p.title.lower() or
                q_lower in p.policy_id.lower() or
                q_lower in p.description.lower()
            ):
                matched.append({
                    "policy_id": p.policy_id,
                    "title": p.title,
                    "category": p.category,
                    "provenance_type": p.provenance_type,
                    "description": p.description,
                    "version": p.version
                })
        return {"count": len(matched), "policies": matched[:5]}

# =============================================================================
# 14. GET EXAMINATION SCHEDULE TOOL (ACADEMIC SERVICES)
# =============================================================================
class GetExaminationScheduleTool(BaseTool):
    name = "get_examination_schedule"
    description = "Retrieve upcoming examination dates, timings, venues, and clearance status"
    category = "academic"
    input_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"}
        },
        "required": ["student_id"]
    }
    output_schema = {
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "exams": {"type": "array"}
        }
    }
    requires_human_approval = False
    required_permissions = ["student", "faculty"]
    expected_failure_conditions = ["NO_EXAM_SCHEDULES_FOUND", "STUDENT_NOT_FOUND"]
    retry_policy = {"max_retries": 3, "retryable_errors": ["timeout"], "is_idempotent": True}
    side_effects = "read_only"
    audit_requirements = "standard_read_log"

    def execute(self, db: Session, student_id: str) -> Any:
        student = student_service.get_student_by_id(db, student_id)
        if not student:
            return {"error": "Student not found"}

        student_courses = student_service.get_student_courses(db, student_id)
        course_ids = [c.id for c in student_courses]
        exams = db.query(models.ExamSchedule).filter(models.ExamSchedule.course_id.in_(course_ids)).all()

        result = []
        for ex in exams:
            course = next((c for c in student_courses if c.id == ex.course_id), None)
            result.append({
                "course_code": course.course_code if course else f"Course-{ex.course_id}",
                "course_name": course.course_name if course else "Course Name",
                "exam_type": ex.exam_type,
                "exam_date": ex.exam_date,
                "start_time": ex.start_time,
                "duration_minutes": ex.duration_minutes,
                "room": ex.room
            })
        return {"student_id": student_id, "exams": result}
