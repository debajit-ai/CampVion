from sqlalchemy.orm import Session
from app.db import models
from app.schemas import student as schemas

def get_students(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Student).offset(skip).limit(limit).all()

def get_student_by_id(db: Session, student_id: str):
    return db.query(models.Student).filter(models.Student.student_id == student_id).first()

def get_student_attendance(db: Session, student_id: str):
    return db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student_id).all()

def get_student_courses(db: Session, student_id: str):
    attendance = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student_id).all()
    course_ids = [record.course_id for record in attendance]
    return db.query(models.Course).filter(models.Course.id.in_(course_ids)).all()

def _ensure_attendance_and_courses(db: Session, student_id: str):
    """Ensure student has attendance records and course registrations so tools don't fail."""
    existing_att = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student_id).first()
    if not existing_att:
        # Enroll in core 3rd-year CSE courses: CSE101, CSE202, CSE303, CSE404
        courses = db.query(models.Course).filter(models.Course.id.in_([1, 2, 3, 4])).all()
        for course in courses:
            db.add(models.CourseRegistration(
                student_id=student_id,
                course_id=course.id,
                semester=5,
                academic_year="2025-2026",
                status="enrolled",
            ))
            # 85% attendance: 34 attended out of 40 classes -> Eligible (>= 75%)
            db.add(models.AttendanceRecord(
                student_id=student_id,
                course_id=course.id,
                attended_classes=34,
                total_classes=40,
            ))

        # Also ensure hostel allocation and fee account exist
        has_hostel = db.query(models.HostelAllocation).filter(models.HostelAllocation.student_id == student_id).first()
        if not has_hostel:
            db.add(models.HostelAllocation(
                student_id=student_id,
                hostel_name="Boys Hostel 1 (Aravali)",
                block="A",
                room_number="302",
                bed_number="B1",
                warden_name="Mr. Suresh Kumar",
                warden_contact="+91-98765-43201",
                check_in_date="2025-08-01",
                status="allocated",
            ))

        has_fee = db.query(models.FeeAccount).filter(models.FeeAccount.student_id == student_id).first()
        if not has_fee:
            db.add(models.FeeAccount(
                student_id=student_id,
                academic_year="2025-2026",
                semester=5,
                total_fees=120000,
                paid_amount=120000,
                outstanding_balance=0,
                due_date="2026-11-30",
                status="cleared",
            ))
        db.commit()

def ensure_student_for_user(db: Session, user: models.UserAccount) -> models.Student:
    """
    Ensures an authentic Student record exists and is properly linked for a UserAccount.
    Prevents non-Alice accounts from erroneously sharing or hijacking S001.
    If the student record does not exist or points to a mismatched identity,
    a dedicated Student profile is created along with core course enrollments,
    attendance records (85% aggregate), and campus service records.
    """
    if not user or not user.email:
        return None

    # 1. Match by email first
    matched = db.query(models.Student).filter(models.Student.email == user.email).first()
    if matched:
        if user.student_id != matched.student_id:
            user.student_id = matched.student_id
            db.commit()
        _ensure_attendance_and_courses(db, matched.student_id)
        return matched

    # 2. Check if user already has a valid unique student_id that is not S001 (unless email is alice)
    if user.student_id and (user.student_id != "S001" or user.email.lower() == "alice@lpu.edu"):
        existing_student = db.query(models.Student).filter(models.Student.student_id == user.student_id).first()
        if existing_student:
            if existing_student.name != user.full_name and user.email.lower() != "alice@lpu.edu":
                existing_student.name = user.full_name
                db.commit()
            _ensure_attendance_and_courses(db, existing_student.student_id)
            return existing_student

    # 3. Generate a new sequential student ID (e.g. S026)
    all_students = db.query(models.Student.student_id).all()
    max_num = 25
    for (s_id,) in all_students:
        if s_id and s_id.startswith("S") and s_id[1:].isdigit():
            val = int(s_id[1:])
            if val > max_num:
                max_num = val
    new_student_id = f"S{max_num + 1:03d}"

    # 4. Create new Student profile record
    new_student = models.Student(
        student_id=new_student_id,
        name=user.full_name,
        email=user.email,
        program="B.Tech Computer Science & Engineering",
        semester=5,
        department="School of Computer Science & Engineering",
        academic_year=3,
        section="K21CS",
        enrollment_status="active",
        advisor_name="Dr. Rajesh Rao",
        advisor_email="rajesh.rao@lpu.edu",
        residence_type="hostel",
        hostel_block="BH-1",
        room_number="302",
    )
    db.add(new_student)
    db.flush()

    # 5. Populate attendance & course registrations
    _ensure_attendance_and_courses(db, new_student_id)

    # 6. Update user's student_id
    old_student_id = user.student_id
    user.student_id = new_student_id

    # If the user previously had conversation sessions tied to old_student_id, update them
    if old_student_id and old_student_id != new_student_id:
        db.query(models.ConversationSession).filter(
            models.ConversationSession.user_id == user.id,
            models.ConversationSession.student_id == old_student_id,
        ).update({"student_id": new_student_id})

    db.commit()
    db.refresh(user)
    return new_student
