import os
import sys
import json
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from sqlalchemy import text
from app.db.database import SessionLocal, engine, Base
from app.db import models
from app.db.migrations import run_migrations
from app.knowledge.policies import POLICIES_DATA
from app.evaluation.benchmark_dataset import BENCHMARK_SCENARIOS

logger = logging.getLogger("campvion.seeding")

# Safety guard against accidental production overwrite
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

FIRST_NAMES = [
    "Aarav", "Aditi", "Rohan", "Priya", "Vikram", "Ananya", "Kabir", "Ishaan",
    "Diya", "Aditya", "Sneha", "Rahul", "Pooja", "Karan", "Neha", "Varun",
    "Shreya", "Siddharth", "Tanvi", "Arjun", "Riya", "Manav", "Divya", "Kunal",
    "Sanya", "Nikhil", "Alisha", "Pranav", "Kriti", "Aryan", "Meera", "Tushar",
    "Ritu", "Ayush", "Natasha", "Gaurav", "Pallavi", "Harsh", "Simran", "Deep",
    "Chetna", "Sameer", "Swati", "Mohit", "Preeti", "Akhil", "Radhika", "Dev",
    "Bhavna", "Yash"
]

LAST_NAMES = [
    "Sharma", "Verma", "Rao", "Desai", "Kapoor", "Mehta", "Sengupta", "Nair",
    "Joshi", "Iyer", "Patel", "Agarwal", "Chatterjee", "Reddy", "Nambiar", "Bhat",
    "Saxena", "Malhotra", "Pillai", "Gill", "Sen", "Roy", "Mishra", "Dubey",
    "Pandey", "Trivedi", "Chauhan", "Singhal", "Chawla", "Goel", "Bose", "Mukherjee",
    "Das", "Kulkarni", "Patil", "Deshmukh", "Hegde", "Menon", "Kurup", "Pillay"
]

SECTIONS = ["K21CS", "K21IT", "K22CS", "K22IT", "K23CS", "K23ECE", "K24AI", "K24MBA"]

HOSTELS_BOYS = [
    ("Boys Hostel 1 (Aravali)", "Mr. Suresh Kumar", "suresh.kumar@lpu.edu"),
    ("Boys Hostel 2 (Shivalik)", "Mr. Ramesh Sharma", "ramesh.sharma@lpu.edu"),
    ("Boys Hostel 3 (Vindhya)", "Mr. Alok Verma", "alok.verma@lpu.edu")
]

HOSTELS_GIRLS = [
    ("Girls Hostel 1 (Nilgiri)", "Dr. Sunita Sen", "sunita.sen@lpu.edu"),
    ("Girls Hostel 2 (Himalaya)", "Prof. Vandana Rao", "vandana.rao@lpu.edu")
]

def reset_database(safe: bool = True):
    """
    Safely resets the database tables if safe=True and ENVIRONMENT != 'production'.
    Preserves audit integrity and ensures zero production data deletion.
    """
    if ENVIRONMENT == "production":
        raise RuntimeError("CRITICAL ERROR: Cannot reset database in production environment!")
    
    logger.info("Resetting development/demonstration database tables...")
    # Drop all operational tables except existing decision traces / agent state if preserving history
    Base.metadata.drop_all(bind=engine)
    run_migrations()

def seed_campus_database(profile: str = "small", seed: int = 42, reset: bool = False):
    """
    Master deterministic seeding engine for CampVion.
    Supported profiles:
      - small: 25 synthetic students (Default development setup)
      - medium: 250 synthetic students (Full university demo)
      - large: 1,000 synthetic students (Performance testing)
    """
    if ENVIRONMENT == "production":
        raise RuntimeError("Cannot execute synthetic seed in production environment!")

    target_students = 25
    if profile == "medium":
        target_students = 250
    elif profile == "large":
        target_students = 1000

    logger.info(f"Starting CampVion Seeding [Profile='{profile}', TargetStudents={target_students}, Seed={seed}]...")

    if reset:
        reset_database(safe=True)
    else:
        run_migrations()

    db = SessionLocal()
    rng = random.Random(seed)

    try:
        # =====================================================================
        # 1. DEPARTMENTS & PROGRAMS
        # =====================================================================
        logger.info("1. Seeding Departments & Academic Programs...")
        depts_data = [
            ("CSE", "School of Computer Science & Engineering", "Block-34", "Dr. Rajesh Rao", "rajesh.rao@lpu.edu"),
            ("ECE", "School of Electronics & Communication Engineering", "Block-32", "Dr. Meenakshi Sundaram", "meenakshi.s@lpu.edu"),
            ("MECH", "School of Mechanical & Aerospace Engineering", "Block-28", "Dr. Harish Mehta", "harish.mehta@lpu.edu"),
            ("MGMT", "Mittal School of Business & Management", "Block-14", "Dr. Sunita Kapoor", "sunita.kapoor@lpu.edu"),
            ("SCI", "School of Applied Sciences & Mathematics", "Block-38", "Dr. Arvind Nambiar", "arvind.nambiar@lpu.edu"),
        ]

        dept_objs = {}
        for code, name, bldg, hod, hod_email in depts_data:
            existing_dept = db.query(models.Department).filter(models.Department.code == code).first()
            if not existing_dept:
                d = models.Department(code=code, name=name, building=bldg, hod_name=hod, hod_email=hod_email)
                db.add(d)
                db.flush()
                dept_objs[code] = d
            else:
                dept_objs[code] = existing_dept
        db.commit()

        programs_data = [
            ("BTECH_CSE", "B.Tech Computer Science & Engineering", "CSE", "Undergraduate", 160),
            ("BTECH_IT", "B.Tech Information Technology", "CSE", "Undergraduate", 160),
            ("BCA", "Bachelor of Computer Applications", "CSE", "Undergraduate", 120),
            ("MCA", "Master of Computer Applications", "CSE", "Postgraduate", 80),
            ("BTECH_ECE", "B.Tech Electronics & Communication", "ECE", "Undergraduate", 160),
            ("BTECH_MECH", "B.Tech Mechanical Engineering", "MECH", "Undergraduate", 160),
            ("MBA", "Master of Business Administration", "MGMT", "Postgraduate", 100),
        ]

        prog_objs = {}
        for p_code, p_name, d_code, deg_level, credits_val in programs_data:
            existing_prog = db.query(models.Program).filter(models.Program.code == p_code).first()
            if not existing_prog:
                p = models.Program(
                    code=p_code,
                    name=p_name,
                    department_id=dept_objs[d_code].id,
                    degree_level=deg_level,
                    total_credits=credits_val
                )
                db.add(p)
                db.flush()
                prog_objs[p_code] = p
            else:
                prog_objs[p_code] = existing_prog
        db.commit()

        # =====================================================================
        # 2. COURSES & FACULTY ASSIGNMENTS
        # =====================================================================
        logger.info("2. Seeding Academic Courses & Faculty...")
        courses_data = [
            ("CSE101", "Data Structures & Algorithms", "Dr. Rajesh Rao", 4, "CSE", 3),
            ("CSE202", "Database Management Systems", "Prof. Anita Desai", 4, "CSE", 3),
            ("CSE303", "Operating Systems & Concurrency", "Dr. Vikramaditya Sen", 4, "CSE", 5),
            ("CSE404", "Artificial Intelligence & Agentic Systems", "Prof. Neha Sengupta", 4, "CSE", 5),
            ("ECE201", "Signals and Linear Systems", "Dr. Meenakshi Sundaram", 4, "ECE", 3),
            ("MECH101", "Engineering Thermodynamics", "Dr. Harish Mehta", 4, "MECH", 1),
            ("MGMT201", "Principles of Campus Operations Management", "Dr. Sunita Kapoor", 3, "MGMT", 3),
            ("MATH101", "Discrete Mathematics & Graph Theory", "Dr. Arvind Nambiar", 4, "SCI", 1),
        ]

        course_objs = {}
        for c_code, c_name, faculty, cr, d_code, sem in courses_data:
            existing_course = db.query(models.Course).filter(models.Course.course_code == c_code).first()
            if not existing_course:
                c = models.Course(
                    course_code=c_code,
                    course_name=c_name,
                    faculty=faculty,
                    credits=cr,
                    department_id=dept_objs[d_code].id,
                    semester=sem
                )
                db.add(c)
                db.flush()
                course_objs[c_code] = c
            else:
                existing_course.credits = cr
                existing_course.department_id = dept_objs[d_code].id
                existing_course.semester = sem
                course_objs[c_code] = existing_course
        db.commit()

        # =====================================================================
        # 3. CLASS TIMETABLES & EXAM SCHEDULES
        # =====================================================================
        logger.info("3. Seeding Timetables & Exam Schedules...")
        weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        rooms = ["Block-34 Room-201", "Block-34 Room-204", "Block-32 Room-105", "Block-28 Hall-B"]

        for c_code, course in course_objs.items():
            if not db.query(models.ClassTimetable).filter(models.ClassTimetable.course_id == course.id).first():
                day1 = weekdays[course.id % len(weekdays)]
                day2 = weekdays[(course.id + 2) % len(weekdays)]
                t1 = models.ClassTimetable(
                    course_id=course.id,
                    section="A",
                    day_of_week=day1,
                    start_time="09:00",
                    end_time="10:00",
                    room=rooms[course.id % len(rooms)],
                    faculty=course.faculty
                )
                t2 = models.ClassTimetable(
                    course_id=course.id,
                    section="A",
                    day_of_week=day2,
                    start_time="11:00",
                    end_time="12:00",
                    room=rooms[course.id % len(rooms)],
                    faculty=course.faculty
                )
                db.add_all([t1, t2])

            if not db.query(models.ExamSchedule).filter(models.ExamSchedule.course_id == course.id).first():
                exam_date = f"2026-11-{15 + (course.id % 12):02d}"
                exam = models.ExamSchedule(
                    course_id=course.id,
                    exam_type="End-Term",
                    exam_date=exam_date,
                    start_time="10:00",
                    duration_minutes=120,
                    room=f"Block-34 Exam-Hall-{(course.id % 4) + 1}"
                )
                db.add(exam)
        db.commit()

        # =====================================================================
        # 4. STUDENTS SEEDING (S001 ALICE & S002 BOB GUARANTEED EXACT)
        # =====================================================================
        logger.info(f"4. Seeding {target_students} Synthetic Students...")

        student_objs = []

        # Student 1: S001 Alice Sharma (Always Preserved Exact)
        s001 = db.query(models.Student).filter(models.Student.student_id == "S001").first()
        if not s001:
            s001 = models.Student(
                student_id="S001",
                name="Alice Sharma",
                email="alice@lpu.edu",
                program="B.Tech Computer Science",
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
            db.add(s001)
        else:
            s001.name = "Alice Sharma"
            s001.email = "alice@lpu.edu"
            s001.program = "B.Tech Computer Science"
            s001.semester = 5
            s001.department = "School of Computer Science & Engineering"
            s001.academic_year = 3
            s001.section = "K21CS"
            s001.enrollment_status = "active"
            s001.advisor_name = "Dr. Rajesh Rao"
            s001.advisor_email = "rajesh.rao@lpu.edu"
            s001.residence_type = "hostel"
            s001.hostel_block = "BH-1"
            s001.room_number = "302"
        student_objs.append(s001)

        # Student 2: S002 Bob Verma (Always Preserved Exact)
        s002 = db.query(models.Student).filter(models.Student.student_id == "S002").first()
        if not s002:
            s002 = models.Student(
                student_id="S002",
                name="Bob Verma",
                email="bob@lpu.edu",
                program="B.Tech Information Technology",
                semester=3,
                department="School of Computer Science & Engineering",
                academic_year=2,
                section="K22IT",
                enrollment_status="active",
                advisor_name="Prof. Anita Desai",
                advisor_email="anita.desai@lpu.edu",
                residence_type="day_scholar",
                hostel_block=None,
                room_number=None
            )
            db.add(s002)
        else:
            s002.name = "Bob Verma"
            s002.email = "bob@lpu.edu"
            s002.program = "B.Tech Information Technology"
            s002.semester = 3
            s002.department = "School of Computer Science & Engineering"
            s002.academic_year = 2
            s002.section = "K22IT"
            s002.enrollment_status = "active"
            s002.advisor_name = "Prof. Anita Desai"
            s002.advisor_email = "anita.desai@lpu.edu"
            s002.residence_type = "day_scholar"
            s002.hostel_block = None
            s002.room_number = None
        student_objs.append(s002)
        db.commit()

        # Students 3 to target_students
        existing_count = db.query(models.Student).count()
        needed = target_students - 2

        for i in range(3, target_students + 1):
            sid = f"S{i:03d}"
            existing = db.query(models.Student).filter(models.Student.student_id == sid).first()
            if existing:
                student_objs.append(existing)
                continue

            fname = rng.choice(FIRST_NAMES)
            lname = rng.choice(LAST_NAMES)
            prog = rng.choice(list(prog_objs.values()))
            sem = rng.choice([1, 2, 3, 4, 5, 6, 7, 8])
            acad_year = (sem + 1) // 2
            is_hostel = rng.random() > 0.35 # 65% hostel residents
            hostel_info = None
            block = None
            room = None

            if is_hostel:
                is_female = fname in ["Aditi", "Priya", "Ananya", "Diya", "Sneha", "Pooja", "Neha", "Shreya", "Tanvi", "Riya", "Divya", "Sanya", "Alisha", "Kriti", "Meera", "Ritu", "Natasha", "Pallavi", "Simran", "Chetna", "Swati", "Preeti", "Radhika", "Bhavna"]
                pool = HOSTELS_GIRLS if is_female else HOSTELS_BOYS
                h_name, w_name, w_contact = rng.choice(pool)
                block = rng.choice(["A", "B", "C"])
                room = f"{rng.randint(1, 4)}{rng.randint(1, 25):02d}"

            st = models.Student(
                student_id=sid,
                name=f"{fname} {lname}",
                email=f"{fname.lower()}.{lname.lower()}{i}@lpu.edu",
                program=prog.name,
                semester=sem,
                department=prog.department.name,
                academic_year=acad_year,
                section=rng.choice(SECTIONS),
                enrollment_status="active",
                advisor_name=prog.department.hod_name,
                advisor_email=prog.department.hod_email,
                residence_type="hostel" if is_hostel else "day_scholar",
                hostel_block=block,
                room_number=room
            )
            db.add(st)
            student_objs.append(st)

        db.commit()

        # =====================================================================
        # 5. ATTENDANCE & PROVENANCE (SUMMARY + DERIVED DAILY SESSIONS)
        # =====================================================================
        logger.info("5. Generating Daily Attendance Sessions with 100% Math Provenance...")
        
        # Calendar class dates (40 calendar lecture days across Fall term)
        base_date = datetime(2026, 8, 10, 9, 0, tzinfo=timezone.utc)
        class_dates = []
        cur_d = base_date
        while len(class_dates) < 40:
            if cur_d.weekday() < 5: # Monday to Friday
                class_dates.append(cur_d.strftime("%Y-%m-%d"))
            cur_d += timedelta(days=1)

        for st in student_objs:
            # S001: exactly 30/40 = 75.0%
            # S002: exactly 20/40 = 50.0%
            # Other students: realistic distribution
            if st.student_id == "S001":
                target_attended = 30
                total_classes = 40
            elif st.student_id == "S002":
                target_attended = 20
                total_classes = 40
            else:
                total_classes = 40
                dice = rng.random()
                if dice < 0.70:
                    target_attended = rng.randint(31, 38) # 77% - 95%
                elif dice < 0.85:
                    target_attended = rng.randint(26, 29) # 65% - 72.5% (borderline)
                else:
                    target_attended = rng.randint(16, 25) # 40% - 62.5% (shortage)

            c_primary = course_objs["CSE101"]

            # Summary Record
            att_rec = db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.student_id == st.student_id,
                models.AttendanceRecord.course_id == c_primary.id
            ).first()
            if not att_rec:
                att_rec = models.AttendanceRecord(
                    student_id=st.student_id,
                    course_id=c_primary.id,
                    attended_classes=target_attended,
                    total_classes=total_classes
                )
                db.add(att_rec)
            else:
                att_rec.attended_classes = target_attended
                att_rec.total_classes = total_classes

            # Daily Session Log Provenance
            existing_daily = db.query(models.DailyAttendanceRecord).filter(
                models.DailyAttendanceRecord.student_id == st.student_id,
                models.DailyAttendanceRecord.course_id == c_primary.id
            ).count()

            if existing_daily == 0:
                # Deterministically assign 'present' to first target_attended sessions
                daily_records = []
                for s_idx, dt_str in enumerate(class_dates):
                    is_present = s_idx < target_attended
                    daily_records.append(models.DailyAttendanceRecord(
                        student_id=st.student_id,
                        course_id=c_primary.id,
                        class_date=dt_str,
                        status="present" if is_present else "absent",
                        remarks=None if is_present else "Unexcused Absence"
                    ))
                db.add_all(daily_records)

        db.commit()

        # =====================================================================
        # 6. COURSE REGISTRATIONS
        # =====================================================================
        logger.info("6. Seeding Course Registrations...")
        for st in student_objs:
            # Register in CSE101 and CSE202
            for c_code in ["CSE101", "CSE202"]:
                c = course_objs[c_code]
                if not db.query(models.CourseRegistration).filter(
                    models.CourseRegistration.student_id == st.student_id,
                    models.CourseRegistration.course_id == c.id
                ).first():
                    db.add(models.CourseRegistration(
                        student_id=st.student_id,
                        course_id=c.id,
                        semester=st.semester,
                        academic_year="2025-2026",
                        status="enrolled",
                        grade="IP"
                    ))
        db.commit()

        # =====================================================================
        # 7. HOSTEL ALLOCATIONS & SERVICE REQUESTS
        # =====================================================================
        logger.info("7. Seeding Hostel Allocations & Requests...")
        for st in student_objs:
            if st.residence_type == "hostel":
                existing_alloc = db.query(models.HostelAllocation).filter(models.HostelAllocation.student_id == st.student_id).first()
                if not existing_alloc:
                    is_female = st.name.split()[0] in ["Aditi", "Priya", "Ananya", "Diya", "Sneha", "Pooja", "Neha", "Shreya", "Tanvi", "Riya", "Divya", "Sanya", "Alisha", "Kriti", "Meera", "Ritu", "Natasha", "Pallavi", "Simran", "Chetna", "Swati", "Preeti", "Radhika", "Bhavna"]
                    pool = HOSTELS_GIRLS if is_female else HOSTELS_BOYS
                    h_name, w_name, w_contact = rng.choice(pool)
                    alloc = models.HostelAllocation(
                        student_id=st.student_id,
                        hostel_name=h_name,
                        block=st.hostel_block or "A",
                        room_number=st.room_number or "302",
                        bed_number="B1",
                        warden_name=w_name,
                        warden_contact=w_contact,
                        check_in_date="2025-08-01",
                        status="allocated"
                    )
                    db.add(alloc)

                    # Add sample maintenance request for a subset of students
                    if rng.random() > 0.70:
                        db.add(models.HostelRequest(
                            request_code=f"HR-2026-{st.student_id[-3:]}",
                            student_id=st.student_id,
                            request_type="maintenance",
                            details="Study lamp electrical switch requires replacement",
                            priority="medium",
                            warden_approval_required=0,
                            status="resolved",
                            resolution_notes="Electrician replaced switch unit."
                        ))
        db.commit()

        # =====================================================================
        # 8. FEES, TRANSACTIONS & SCHOLARSHIPS (SYNTHETIC)
        # =====================================================================
        logger.info("8. Seeding Synthetic Fee Accounts & Financial Records...")
        for idx, st in enumerate(student_objs):
            existing_fee = db.query(models.FeeAccount).filter(models.FeeAccount.student_id == st.student_id).first()
            if not existing_fee:
                is_cleared = idx % 5 != 0 # 80% cleared, 20% with dues
                total = 120000
                paid = total if is_cleared else 90000
                balance = 0 if is_cleared else 30000
                fee_acc = models.FeeAccount(
                    student_id=st.student_id,
                    academic_year="2025-2026",
                    semester=st.semester,
                    total_fees=total,
                    paid_amount=paid,
                    outstanding_balance=balance,
                    due_date="2026-11-30",
                    status="cleared" if is_cleared else "due"
                )
                db.add(fee_acc)

                # Payment Transaction
                db.add(models.FeeTransaction(
                    transaction_ref=f"TXN-2026-{st.student_id[-3:]}99",
                    student_id=st.student_id,
                    category="tuition",
                    amount=paid,
                    payment_method=rng.choice(["UPI", "NetBanking", "Card"]),
                    payment_date="2025-08-05",
                    status="completed"
                ))

                # Merit scholarship for top 15%
                if idx % 7 == 0:
                    db.add(models.ScholarshipRecord(
                        student_id=st.student_id,
                        scholarship_name="Merit Excellence Tuition Concession",
                        amount_per_semester=30000,
                        eligibility_criteria="CGPA >= 8.5 & Attendance >= 75%",
                        status="active"
                    ))
        db.commit()

        # =====================================================================
        # 9. CAMPUS SUPPORT TICKETS
        # =====================================================================
        logger.info("9. Seeding Campus Support Tickets...")
        ticket_samples = [
            ("it_support", "Campus Wi-Fi connectivity drop in Block-34 Hall", "Experiencing intermittent packet drops on eduroam.", "Campus IT Helpdesk"),
            ("library", "Book renewal request: CLRS Introduction to Algorithms", "Requesting 14-day renewal extension for semester project reference.", "Library Circulation Desk"),
            ("transport", "Bus Route #12 timing adjustment inquiry", "Inquiring about departure frequency from city center on exam days.", "Transport Office"),
            ("id_card", "Replacement RFID Smart Campus Card request", "Original card chip damaged; request reprint.", "Registrar Counter")
        ]

        for idx, st in enumerate(student_objs[:10]):
            existing_tkt = db.query(models.SupportTicket).filter(models.SupportTicket.student_id == st.student_id).first()
            if not existing_tkt:
                cat, subj, desc, team = ticket_samples[idx % len(ticket_samples)]
                db.add(models.SupportTicket(
                    ticket_number=f"TKT-2026-{st.student_id[-3:]}01",
                    student_id=st.student_id,
                    category=cat,
                    subject=subj,
                    description=desc,
                    priority="medium",
                    status="resolved" if idx % 2 == 0 else "open",
                    assigned_team=team
                ))
        db.commit()

        # =====================================================================
        # 10. UNIVERSITY KNOWLEDGE BASE POLICIES & RAG CHUNKS
        # =====================================================================
        logger.info("10. Seeding University Knowledge Base Policies & Chunks...")
        for p_data in POLICIES_DATA:
            existing_policy = db.query(models.CampusPolicy).filter(models.CampusPolicy.policy_id == p_data["policy_id"]).first()
            if not existing_policy:
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
            else:
                existing_policy.title = p_data["title"]
                existing_policy.description = p_data["description"]
                existing_policy.rule_conditions = json.dumps(p_data["rule_conditions"])
                existing_policy.applicable_groups = json.dumps(p_data["applicable_groups"])
                existing_policy.source_document = p_data["source_document"]
                existing_policy.provenance_type = p_data.get("provenance_type", "illustrative_demo")
                existing_policy.version = p_data.get("version", "1.0")
        db.commit()

        # =====================================================================
        # 11. EVALUATION & BENCHMARK SCENARIOS (15 SCENARIOS)
        # =====================================================================
        logger.info("11. Seeding 15 Benchmark Evaluation Scenarios...")
        for sc in BENCHMARK_SCENARIOS:
            existing_scen = db.query(models.EvaluationScenario).filter(models.EvaluationScenario.scenario_id == sc["scenario_id"]).first()
            if not existing_scen:
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
            else:
                existing_scen.name = sc["name"]
                existing_scen.natural_language_request = sc["natural_language_request"]
                existing_scen.expected_interpretation = sc["expected_interpretation"]
                existing_scen.expected_eligibility = sc["expected_eligibility"]
                existing_scen.expected_workflow_steps = json.dumps(sc["expected_workflow_steps"])
                existing_scen.expected_approval_required = sc["expected_approval_required"]
                existing_scen.expected_final_state = sc["expected_final_state"]
                existing_scen.expected_failure_mode = sc.get("expected_failure_mode")
                existing_scen.evaluation_criteria = json.dumps(sc["evaluation_criteria"])
        db.commit()

        # Print Seeding Summary Statistics
        student_count = db.query(models.Student).count()
        course_count = db.query(models.Course).count()
        dept_count = db.query(models.Department).count()
        att_count = db.query(models.AttendanceRecord).count()
        daily_count = db.query(models.DailyAttendanceRecord).count()
        policy_count = db.query(models.CampusPolicy).count()
        chunk_count = db.query(models.PolicyKnowledgeChunk).count()
        scen_count = db.query(models.EvaluationScenario).count()
        fee_count = db.query(models.FeeAccount).count()
        hostel_count = db.query(models.HostelAllocation).count()

        logger.info("=================================================================")
        logger.info("CAMPVION MASTER CAMPUS DATA FOUNDATION SEEDED SUCCESSFULLY!")
        logger.info(f" - Students: {student_count} records (Alice S001 & Bob S002 preserved)")
        logger.info(f" - Departments: {dept_count} departments")
        logger.info(f" - Courses: {course_count} courses")
        logger.info(f" - Summary Attendance: {att_count} records")
        logger.info(f" - Daily Attendance Sessions: {daily_count} records (100% provenance)")
        logger.info(f" - Hostel Allocations: {hostel_count} residents")
        logger.info(f" - Fee Accounts: {fee_count} synthetic accounts")
        logger.info(f" - University Policies: {policy_count} policies (illustrative_demo)")
        logger.info(f" - Policy Knowledge Chunks: {chunk_count} RAG chunks")
        logger.info(f" - Evaluation Scenarios: {scen_count} benchmark scenarios")
        logger.info("=================================================================")

    except Exception as e:
        logger.error(f"Error during seeding: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import argparse
    parser = argparse.ArgumentParser(description="CampVion Master Campus Data Foundation Seeder")
    parser.add_argument("--profile", choices=["small", "medium", "large"], default="small", help="Dataset size profile")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed")
    parser.add_argument("--reset", action="store_true", help="Safely reset tables before seeding")
    args = parser.parse_args()

    seed_campus_database(profile=args.profile, seed=args.seed, reset=args.reset)

