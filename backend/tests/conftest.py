import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.db import models
from app.knowledge.policies import POLICIES_DATA
from app.evaluation.benchmark_dataset import BENCHMARK_SCENARIOS

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Departments and Programs
    dept_cse = models.Department(
        code="CSE",
        name="School of Computer Science & Engineering",
        building="Block-34",
        hod_name="Dr. Rajesh Rao",
        hod_email="rajesh.rao@lpu.edu"
    )
    db.add(dept_cse)
    db.flush()

    prog_cse = models.Program(
        code="BTECH_CSE",
        name="B.Tech Computer Science",
        department_id=dept_cse.id,
        degree_level="Undergraduate",
        total_credits=160
    )
    db.add(prog_cse)
    db.flush()

    # 2. Students: S001 Alice (Eligible 75%) and S002 Bob (Ineligible 50%)
    s1 = models.Student(
        student_id="S001",
        name="Alice",
        email="alice@lpu.edu",
        program="B.Tech CS",
        semester=5,
        department="School of Computer Science & Engineering",
        academic_year=3,
        section="K21CS",
        enrollment_status="active",
        advisor_name="Dr. Rajesh Rao",
        advisor_email="rajesh.rao@lpu.edu",
        residence_type="hostel",
        hostel_block="BH-1",
        room_number="302"
    )
    s2 = models.Student(
        student_id="S002",
        name="Bob",
        email="bob@lpu.edu",
        program="B.Tech IT",
        semester=3,
        department="School of Computer Science & Engineering",
        academic_year=2,
        section="K22IT",
        enrollment_status="active",
        advisor_name="Dr. Rajesh Rao",
        advisor_email="rajesh.rao@lpu.edu",
        residence_type="day_scholar",
        hostel_block=None,
        room_number=None
    )
    db.add_all([s1, s2])
    db.flush()

    # 3. Courses
    c1 = models.Course(
        course_code="CSE101",
        course_name="Intro to CS",
        faculty="Dr. Bob",
        credits=4,
        department_id=dept_cse.id,
        semester=1
    )
    db.add(c1)
    db.commit() # commit first to get course_id
    
    # 4. Summary Attendance
    a1 = models.AttendanceRecord(student_id=s1.student_id, course_id=c1.id, attended_classes=30, total_classes=40)
    a2 = models.AttendanceRecord(student_id=s2.student_id, course_id=c1.id, attended_classes=20, total_classes=40)
    db.add_all([a1, a2])

    # 5. Daily Attendance Logs (100% Provenance)
    for i in range(40):
        dt_str = f"2026-09-{(i % 28) + 1:02d}"
        db.add(models.DailyAttendanceRecord(
            student_id=s1.student_id,
            course_id=c1.id,
            class_date=dt_str,
            status="present" if i < 30 else "absent",
            remarks=None if i < 30 else "Unexcused Absence"
        ))
        db.add(models.DailyAttendanceRecord(
            student_id=s2.student_id,
            course_id=c1.id,
            class_date=dt_str,
            status="present" if i < 20 else "absent",
            remarks=None if i < 20 else "Unexcused Absence"
        ))

    # 6. Course Registrations
    db.add(models.CourseRegistration(
        student_id=s1.student_id,
        course_id=c1.id,
        semester=s1.semester,
        academic_year="2025-2026",
        status="enrolled",
        grade="IP"
    ))

    # 7. Hostel Allocation
    db.add(models.HostelAllocation(
        student_id=s1.student_id,
        hostel_name="Boys Hostel 1 (Aravali)",
        block="BH-1",
        room_number="302",
        bed_number="B1",
        warden_name="Mr. Suresh Kumar",
        warden_contact="suresh.kumar@lpu.edu",
        check_in_date="2025-08-01",
        status="allocated"
    ))

    # 8. Fee Account & Transaction
    db.add(models.FeeAccount(
        student_id=s1.student_id,
        academic_year="2025-2026",
        semester=5,
        total_fees=120000,
        paid_amount=120000,
        outstanding_balance=0,
        due_date="2026-11-30",
        status="cleared"
    ))
    db.add(models.FeeTransaction(
        transaction_ref="TXN-2026-TEST01",
        student_id=s1.student_id,
        category="tuition",
        amount=120000,
        payment_method="NetBanking",
        payment_date="2025-08-05",
        status="completed"
    ))

    # 9. Support Ticket
    db.add(models.SupportTicket(
        ticket_number="TKT-2026-TEST01",
        student_id=s1.student_id,
        category="it_support",
        subject="WiFi Connectivity",
        description="WiFi dropping in library",
        priority="medium",
        status="open",
        assigned_team="Campus IT Helpdesk"
    ))

    # 10. Policies & Chunks
    for p_data in POLICIES_DATA:
        pol = models.CampusPolicy(
            policy_id=p_data["policy_id"],
            title=p_data["title"],
            category=p_data["category"],
            description=p_data["description"],
            rule_conditions=json.dumps(p_data["rule_conditions"]),
            applicable_groups=json.dumps(p_data["applicable_groups"]),
            effective_date=p_data["effective_date"],
            expiry_date=p_data.get("expiry_date"),
            source_document=p_data["source_document"],
            provenance_type=p_data.get("provenance_type", "illustrative_demo"),
            verification_status=p_data.get("verification_status", "verified"),
            version=p_data.get("version", "1.0")
        )
        db.add(pol)
        db.flush()
        for chk in p_data.get("chunks", []):
            db.add(models.PolicyKnowledgeChunk(
                policy_id=p_data["policy_id"],
                chunk_index=chk["chunk_index"],
                title=chk["title"],
                content_text=chk["content_text"],
                metadata_json=json.dumps(chk.get("metadata", {})),
                source_reference=f"{p_data['source_document']} [Chunk {chk['chunk_index']}]",
                token_count=len(chk["content_text"].split()),
                embedding_id=None
            ))

    # 11. Evaluation Scenarios
    for sc in BENCHMARK_SCENARIOS:
        db.add(models.EvaluationScenario(
            scenario_id=sc["scenario_id"],
            name=sc["name"],
            category=sc["category"],
            student_id=sc["student_id"],
            natural_language_request=sc["natural_language_request"],
            expected_interpretation=sc["expected_interpretation"],
            expected_eligibility=sc["expected_eligibility"],
            expected_workflow_steps=json.dumps(sc["expected_workflow_steps"]),
            expected_approval_required=sc["expected_approval_required"],
            expected_final_state=sc["expected_final_state"],
            expected_failure_mode=sc.get("expected_failure_mode"),
            evaluation_criteria=json.dumps(sc["evaluation_criteria"])
        ))

    # 12. Default Authenticated Test User & Session
    from datetime import datetime, timedelta, timezone
    from app.core.security import generate_secure_token, hash_password, hash_token

    test_user = models.UserAccount(
        email="alice@lpu.edu",
        full_name="Alice Sharma",
        password_hash=hash_password("CampVion@2026"),
        role="student",
        student_id="S001",
        is_active=1,
    )
    db.add(test_user)
    db.flush()

    raw_test_token = generate_secure_token(32)
    test_session = models.AuthSession(
        user_id=test_user.id,
        token_hash=hash_token(raw_test_token),
        csrf_token=generate_secure_token(24),
        remember_me=0,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        revoked=0,
    )
    db.add(test_session)
    db.commit()
    db.info["test_session_token"] = raw_test_token
    
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    tc = TestClient(app)
    tc.cookies.set("campvion_session", db.info["test_session_token"])
    yield tc
    del app.dependency_overrides[get_db]

@pytest.fixture
def unauthenticated_client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    if get_db in app.dependency_overrides:
        del app.dependency_overrides[get_db]
