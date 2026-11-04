from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

def get_utc_now():
    return datetime.now(timezone.utc)

# =============================================================================
# DOMAIN A: STUDENT RECORDS
# =============================================================================

class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    program = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)
    
    # Extended Campus Profile Attributes (backward-compatible, nullable)
    department = Column(String, nullable=True, default="School of Computer Science & Engineering")
    academic_year = Column(Integer, nullable=True, default=3)
    section = Column(String, nullable=True, default="K21CS")
    enrollment_status = Column(String, nullable=True, default="active") # active, on_leave, graduated, suspended
    advisor_name = Column(String, nullable=True, default="Dr. Rajesh Rao")
    advisor_email = Column(String, nullable=True, default="rajesh.rao@lpu.edu")
    residence_type = Column(String, nullable=True, default="hostel") # hostel, day_scholar
    hostel_block = Column(String, nullable=True, default="BH-1")
    room_number = Column(String, nullable=True, default="302")

    # Relationships
    attendance_records = relationship("AttendanceRecord", back_populates="student")
    daily_attendance_records = relationship("DailyAttendanceRecord", back_populates="student")
    course_registrations = relationship("CourseRegistration", back_populates="student")
    requests = relationship("CampusRequest", back_populates="student")
    leave_requests = relationship("LeaveRequest", back_populates="student")
    hostel_allocation = relationship("HostelAllocation", back_populates="student", uselist=False)
    hostel_requests = relationship("HostelRequest", back_populates="student")
    fee_accounts = relationship("FeeAccount", back_populates="student")
    fee_transactions = relationship("FeeTransaction", back_populates="student")
    scholarships = relationship("ScholarshipRecord", back_populates="student")
    support_tickets = relationship("SupportTicket", back_populates="student")

# =============================================================================
# DOMAIN B: ACADEMIC RECORDS & DEPARTMENTS
# =============================================================================

class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False) # CSE, ECE, MECH, MGMT
    name = Column(String, nullable=False)
    building = Column(String, nullable=False)
    hod_name = Column(String, nullable=False)
    hod_email = Column(String, nullable=False)

    programs = relationship("Program", back_populates="department")
    courses = relationship("Course", back_populates="department")

class Program(Base):
    __tablename__ = "programs"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False) # BTECH_CSE, BTECH_IT, BCA, MBA
    name = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    degree_level = Column(String, nullable=False, default="Undergraduate") # Undergraduate, Postgraduate
    total_credits = Column(Integer, default=160)

    department = relationship("Department", back_populates="programs")

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, unique=True, index=True, nullable=False)
    course_name = Column(String, nullable=False)
    faculty = Column(String, nullable=False)
    credits = Column(Integer, default=4)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    semester = Column(Integer, default=1)

    department = relationship("Department", back_populates="courses")
    attendance_records = relationship("AttendanceRecord", back_populates="course")
    daily_attendance_records = relationship("DailyAttendanceRecord", back_populates="course")
    course_registrations = relationship("CourseRegistration", back_populates="course")
    timetables = relationship("ClassTimetable", back_populates="course")
    exam_schedules = relationship("ExamSchedule", back_populates="course")

class CourseRegistration(Base):
    __tablename__ = "course_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    semester = Column(Integer, nullable=False)
    academic_year = Column(String, default="2025-2026")
    registration_date = Column(DateTime, default=get_utc_now)
    status = Column(String, default="enrolled") # enrolled, completed, dropped
    grade = Column(String, nullable=True) # A+, A, B+, B, C, F, IP

    student = relationship("Student", back_populates="course_registrations")
    course = relationship("Course", back_populates="course_registrations")

class ClassTimetable(Base):
    __tablename__ = "class_timetables"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    section = Column(String, nullable=False, default="A")
    day_of_week = Column(String, nullable=False) # Monday, Tuesday, Wednesday, Thursday, Friday
    start_time = Column(String, nullable=False) # HH:MM (e.g. 09:00)
    end_time = Column(String, nullable=False) # HH:MM (e.g. 10:00)
    room = Column(String, nullable=False) # Block-34 Room-204
    faculty = Column(String, nullable=False)

    course = relationship("Course", back_populates="timetables")

class ExamSchedule(Base):
    __tablename__ = "exam_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    exam_type = Column(String, nullable=False, default="End-Term") # Mid-Term, End-Term, Practical
    exam_date = Column(String, nullable=False) # YYYY-MM-DD
    start_time = Column(String, nullable=False) # HH:MM
    duration_minutes = Column(Integer, default=120)
    room = Column(String, nullable=False)

    course = relationship("Course", back_populates="exam_schedules")

# =============================================================================
# DOMAIN C: ATTENDANCE (SUMMARY + DAILY LOGS)
# =============================================================================

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    attended_classes = Column(Integer, default=0)
    total_classes = Column(Integer, default=0)
    
    student = relationship("Student", back_populates="attendance_records")
    course = relationship("Course", back_populates="attendance_records")

class DailyAttendanceRecord(Base):
    __tablename__ = "daily_attendance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    class_date = Column(String, nullable=False) # YYYY-MM-DD
    status = Column(String, nullable=False, default="present") # present, absent, excused, late
    remarks = Column(String, nullable=True)

    student = relationship("Student", back_populates="daily_attendance_records")
    course = relationship("Course", back_populates="daily_attendance_records")

# =============================================================================
# DOMAIN D: LEAVE MANAGEMENT
# =============================================================================

class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    leave_code = Column(String, unique=True, index=True, nullable=False) # LV-2026-0001
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    category = Column(String, nullable=False, default="personal") # personal, medical, family_emergency, academic_event, placement
    start_date = Column(String, nullable=False) # YYYY-MM-DD
    end_date = Column(String, nullable=False) # YYYY-MM-DD
    days_count = Column(Integer, nullable=False, default=1)
    reason = Column(String, nullable=False)
    supporting_doc_url = Column(String, nullable=True)
    doc_required = Column(Integer, default=0) # 0 = false, 1 = true
    status = Column(String, default="pending") # pending, approved, rejected, cancelled
    assigned_approver = Column(String, nullable=False, default="Faculty Advisor")
    approver_role = Column(String, nullable=False, default="Advisor") # Advisor, HOD, Proctor, Warden
    submitted_at = Column(DateTime, default=get_utc_now)
    decided_at = Column(DateTime, nullable=True)
    decision_remarks = Column(String, nullable=True)

    student = relationship("Student", back_populates="leave_requests")

# =============================================================================
# DOMAIN E: HOSTEL SERVICES
# =============================================================================

class HostelAllocation(Base):
    __tablename__ = "hostel_allocations"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), unique=True, nullable=False)
    hostel_name = Column(String, nullable=False) # Boys Hostel 1 (Aravali), Girls Hostel 2 (Nilgiri)
    block = Column(String, nullable=False) # A, B, C
    room_number = Column(String, nullable=False) # 302
    bed_number = Column(String, nullable=False, default="B1")
    warden_name = Column(String, nullable=False)
    warden_contact = Column(String, nullable=False)
    check_in_date = Column(String, nullable=False)
    status = Column(String, default="allocated") # allocated, vacated

    student = relationship("Student", back_populates="hostel_allocation")

class HostelRequest(Base):
    __tablename__ = "hostel_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String, unique=True, index=True, nullable=False) # HR-2026-0001
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    request_type = Column(String, nullable=False) # maintenance, room_change, night_out_pass, complaint
    details = Column(String, nullable=False)
    priority = Column(String, default="medium") # low, medium, high, emergency
    warden_approval_required = Column(Integer, default=0) # 0 = false, 1 = true
    status = Column(String, default="pending") # pending, approved, in_progress, resolved, rejected
    created_at = Column(DateTime, default=get_utc_now)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(String, nullable=True)

    student = relationship("Student", back_populates="hostel_requests")

# =============================================================================
# DOMAIN F: FEES & FINANCIAL SERVICES (SYNTHETIC)
# =============================================================================

class FeeAccount(Base):
    __tablename__ = "fee_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    academic_year = Column(String, nullable=False, default="2025-2026")
    semester = Column(Integer, nullable=False, default=5)
    total_fees = Column(Integer, default=120000)
    paid_amount = Column(Integer, default=120000)
    outstanding_balance = Column(Integer, default=0)
    due_date = Column(String, nullable=False, default="2026-11-30")
    status = Column(String, default="cleared") # cleared, due, overdue

    student = relationship("Student", back_populates="fee_accounts")

class FeeTransaction(Base):
    __tablename__ = "fee_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_ref = Column(String, unique=True, index=True, nullable=False) # TXN-2026-0001
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    category = Column(String, nullable=False, default="tuition") # tuition, hostel, examination, library_fine
    amount = Column(Integer, nullable=False)
    payment_method = Column(String, default="NetBanking") # UPI, NetBanking, Card, Challan
    payment_date = Column(String, nullable=False)
    status = Column(String, default="completed") # completed, pending, failed

    student = relationship("Student", back_populates="fee_transactions")

class ScholarshipRecord(Base):
    __tablename__ = "scholarships"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    scholarship_name = Column(String, nullable=False)
    amount_per_semester = Column(Integer, nullable=False)
    eligibility_criteria = Column(String, nullable=False)
    status = Column(String, default="active") # active, under_review, discontinued

    student = relationship("Student", back_populates="scholarships")

# =============================================================================
# DOMAIN G: CAMPUS SUPPORT SERVICES
# =============================================================================

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, index=True, nullable=False) # TKT-2026-0001
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    category = Column(String, nullable=False, default="it_support") # it_support, library, transport, id_card, facilities, general
    subject = Column(String, nullable=False)
    description = Column(String, nullable=False)
    priority = Column(String, default="medium") # low, medium, high
    status = Column(String, default="open") # open, in_progress, resolved, closed
    assigned_team = Column(String, default="Campus IT Helpdesk")
    created_at = Column(DateTime, default=get_utc_now)
    resolved_at = Column(DateTime, nullable=True)

    student = relationship("Student", back_populates="support_tickets")

# =============================================================================
# DOMAIN H: UNIVERSITY KNOWLEDGE BASE & POLICY LAYER
# =============================================================================

class CampusPolicy(Base):
    __tablename__ = "campus_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(String, unique=True, index=True, nullable=False) # POL-ATT-001
    title = Column(String, nullable=False)
    category = Column(String, nullable=False) # attendance, leave, hostel, financial, academic, examination, support
    description = Column(Text, nullable=False)
    rule_conditions = Column(Text, nullable=False) # JSON encoded conditions
    applicable_groups = Column(Text, nullable=False) # JSON encoded list of target groups
    effective_date = Column(String, nullable=False) # YYYY-MM-DD
    expiry_date = Column(String, nullable=True)
    source_document = Column(String, nullable=False)
    provenance_type = Column(String, nullable=False, default="illustrative_demo") # illustrative_demo vs verified_university
    verification_status = Column(String, nullable=False, default="verified") # verified, provisional, draft
    version = Column(String, nullable=False, default="1.0")

    chunks = relationship("PolicyKnowledgeChunk", back_populates="policy")

class PolicyKnowledgeChunk(Base):
    __tablename__ = "policy_knowledge_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(String, ForeignKey("campus_policies.policy_id"), nullable=False)
    chunk_index = Column(Integer, nullable=False, default=0)
    title = Column(String, nullable=False)
    content_text = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=False) # JSON metadata
    source_reference = Column(String, nullable=False)
    token_count = Column(Integer, default=0)
    embedding_id = Column(String, nullable=True) # Pointer for future RAG / Vector store

    policy = relationship("CampusPolicy", back_populates="chunks")

# =============================================================================
# DOMAIN I: EVALUATION & BENCHMARK DATASET
# =============================================================================

class EvaluationScenario(Base):
    __tablename__ = "evaluation_scenarios"
    
    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(String, unique=True, index=True, nullable=False) # SCEN-01
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    natural_language_request = Column(Text, nullable=False)
    expected_interpretation = Column(Text, nullable=False)
    expected_eligibility = Column(Integer, default=1) # 1 = eligible, 0 = ineligible
    expected_workflow_steps = Column(Text, nullable=False) # JSON array of step/tool names
    expected_approval_required = Column(Integer, default=0) # 1 = true, 0 = false
    expected_final_state = Column(String, nullable=False) # COMPLETED, WAITING_FOR_HUMAN, FAILED
    expected_failure_mode = Column(String, nullable=True)
    evaluation_criteria = Column(Text, nullable=False) # JSON encoded assertions

# =============================================================================
# EXISTING SYSTEM TABLES (PRESERVED IN FULL)
# =============================================================================

class CampusRequest(Base):
    __tablename__ = "campus_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=False)
    request_type = Column(String, nullable=False) # e.g., 'leave', 'transcript'
    status = Column(String, default="pending") # pending, approved, rejected, completed, failed
    description = Column(String)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)
    
    student = relationship("Student", back_populates="requests")
    traces = relationship("DecisionTrace", back_populates="request")

class DecisionTrace(Base):
    __tablename__ = "decision_traces"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("campus_requests.id"), nullable=True)
    step_number = Column(Integer, nullable=False)
    event_type = Column(String, nullable=False) # GOAL_RECEIVED, TOOL_STARTED, etc.
    component = Column(String, nullable=False) # orchestrator, planner, tool_registry
    action = Column(String, nullable=False)
    input_data = Column(String) # JSON string
    output_data = Column(String) # JSON string
    status = Column(String, nullable=False) # success, failure, pending
    error_message = Column(String)
    timestamp = Column(DateTime, default=get_utc_now)

    request = relationship("CampusRequest", back_populates="traces")

class AgentStateModel(Base):
    __tablename__ = "agent_states"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("campus_requests.id"), unique=True, nullable=False)
    state_data = Column(String, nullable=False) # JSON string
    
    request = relationship("CampusRequest")

# =============================================================================
# DOMAIN J: AUTHENTICATION, SESSIONS & ROLE-BASED ACCESS CONTROL
# =============================================================================

class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="student")  # student, faculty, administrator, system_administrator
    student_id = Column(String, nullable=True, index=True)    # Optional link to Student.student_id (e.g., S001)
    is_active = Column(Integer, default=1, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    csrf_token = Column(String, nullable=False)
    remember_me = Column(Integer, default=0, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    last_active_at = Column(DateTime, default=get_utc_now, nullable=False)

    user = relationship("UserAccount", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    user = relationship("UserAccount", back_populates="reset_tokens")

