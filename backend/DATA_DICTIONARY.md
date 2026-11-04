# CampVion Master Campus Data Foundation — Data Dictionary

## 1. Overview

CampVion’s Master Campus Data Foundation provides a structured, normalized, and extensible relational data layer supporting multi-step autonomous AI workflows across academic, residential, financial, and administrative university operations.

- **Engine:** SQLite (`axora.db`) / PostgreSQL compatible
- **ORM:** SQLAlchemy 2.0+
- **Schema Management:** Automated safe, idempotent migrations (`app/db/migrations.py`)
- **Seeding Engine:** Deterministic multi-profile generator (`app/db/seed_engine.py`)

---

## 2. Relational Database Tables

### Domain A: Student Records

#### `students`
Primary identity store for enrolled university students.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Surrogate primary key |
| `student_id` | VARCHAR | UNIQUE, NOT NULL, INDEX | University registration ID (e.g., `S001`) |
| `name` | VARCHAR | NOT NULL | Full legal student name |
| `email` | VARCHAR | UNIQUE, NOT NULL, INDEX | University-issued email address |
| `program` | VARCHAR | NOT NULL | Enrolled degree program name |
| `semester` | INTEGER | NOT NULL | Active academic semester (1–8) |
| `department` | VARCHAR | NULLABLE | School / academic department |
| `academic_year` | INTEGER | NULLABLE | Current study year (1–4) |
| `section` | VARCHAR | NULLABLE | Assigned classroom section (e.g., `K21CS`) |
| `enrollment_status`| VARCHAR | NULLABLE | `active`, `on_leave`, `graduated`, `suspended` |
| `advisor_name` | VARCHAR | NULLABLE | Assigned faculty advisor name |
| `advisor_email` | VARCHAR | NULLABLE | Assigned faculty advisor email |
| `residence_type` | VARCHAR | NULLABLE | `hostel` or `day_scholar` |
| `hostel_block` | VARCHAR | NULLABLE | Block code (e.g., `BH-1`) |
| `room_number` | VARCHAR | NULLABLE | Room number (e.g., `302`) |

---

### Domain B: Academic Records & Departments

#### `departments`
University academic divisions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `code` | VARCHAR | UNIQUE, NOT NULL, INDEX | Department code (`CSE`, `ECE`, `MECH`, `MGMT`, `SCI`) |
| `name` | VARCHAR | NOT NULL | Full department title |
| `building` | VARCHAR | NOT NULL | Campus facility building |
| `hod_name` | VARCHAR | NOT NULL | Head of Department name |
| `hod_email` | VARCHAR | NOT NULL | Head of Department email |

#### `programs`
Degree programs offered by departments.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `code` | VARCHAR | UNIQUE, NOT NULL, INDEX | Program code (`BTECH_CSE`, `MCA`, etc.) |
| `name` | VARCHAR | NOT NULL | Program title |
| `department_id` | INTEGER | FK (`departments.id`) | Owning department |
| `degree_level` | VARCHAR | NOT NULL | `Undergraduate` or `Postgraduate` |
| `total_credits` | INTEGER | DEFAULT 160 | Degree credit requirements |

#### `courses`
Curricular courses.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `course_code` | VARCHAR | UNIQUE, NOT NULL, INDEX | Course code (e.g., `CSE101`) |
| `course_name` | VARCHAR | NOT NULL | Course title |
| `faculty` | VARCHAR | NOT NULL | Instructor in charge |
| `credits` | INTEGER | DEFAULT 4 | Course credit value |
| `department_id` | INTEGER | FK (`departments.id`) | Sponsoring department |
| `semester` | INTEGER | DEFAULT 1 | Standard offering semester |

#### `course_registrations`
Student-to-course enrollments.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `course_id` | INTEGER | FK (`courses.id`) | Course identifier |
| `semester` | INTEGER | NOT NULL | Semester of enrollment |
| `academic_year` | VARCHAR | DEFAULT '2025-2026' | Academic session |
| `registration_date`| DATETIME| DEFAULT UTC | Enrollment timestamp |
| `status` | VARCHAR | DEFAULT 'enrolled' | `enrolled`, `completed`, `dropped` |
| `grade` | VARCHAR | NULLABLE | Letter grade (`A+`, `A`, `B`, `IP`) |

#### `class_timetables`
Weekly timetable schedules.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `course_id` | INTEGER | FK (`courses.id`) | Course identifier |
| `section` | VARCHAR | DEFAULT 'A' | Student section |
| `day_of_week` | VARCHAR | NOT NULL | `Monday` through `Friday` |
| `start_time` | VARCHAR | NOT NULL | `HH:MM` format |
| `end_time` | VARCHAR | NOT NULL | `HH:MM` format |
| `room` | VARCHAR | NOT NULL | Classroom location |
| `faculty` | VARCHAR | NOT NULL | Instructor |

#### `exam_schedules`
Mid-term and end-term examination calendar.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `course_id` | INTEGER | FK (`courses.id`) | Course identifier |
| `exam_type` | VARCHAR | DEFAULT 'End-Term' | `Mid-Term`, `End-Term`, `Practical` |
| `exam_date` | VARCHAR | NOT NULL | Scheduled exam date (`YYYY-MM-DD`) |
| `start_time` | VARCHAR | NOT NULL | Scheduled start time |
| `duration_minutes`| INTEGER| DEFAULT 120 | Duration in minutes |
| `room` | VARCHAR | NOT NULL | Exam hall venue |

---

### Domain C: Attendance

#### `attendance_records` (Aggregate Summary)
Course-wise attendance aggregates for fast decision checks.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `course_id` | INTEGER | FK (`courses.id`) | Course identifier |
| `attended_classes`| INTEGER| DEFAULT 0 | Count of classes attended |
| `total_classes` | INTEGER | DEFAULT 0 | Total lectures conducted |

#### `daily_attendance_records` (Session Logs - 100% Provenance)
Individual date-stamped lecture session records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `course_id` | INTEGER | FK (`courses.id`) | Course identifier |
| `class_date` | VARCHAR | NOT NULL | Lecture date (`YYYY-MM-DD`) |
| `status` | VARCHAR | NOT NULL | `present`, `absent`, `excused`, `late` |
| `remarks` | VARCHAR | NULLABLE | Absence justification or notes |

*Provable constraint:* For every student and course:
$$\text{attended\_classes} = \sum [\text{status} = \text{'present'}]$$
$$\text{total\_classes} = \text{count}(\text{daily\_attendance\_records})$$

---

### Domain D: Leave Management

#### `leave_requests`
Official student absence applications.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `leave_code` | VARCHAR | UNIQUE, NOT NULL, INDEX | Reference code (e.g., `LV-2026-0001`) |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `category` | VARCHAR | NOT NULL | `personal`, `medical`, `family_emergency`, etc. |
| `start_date` | VARCHAR | NOT NULL | Absence start date (`YYYY-MM-DD`) |
| `end_date` | VARCHAR | NOT NULL | Absence return date (`YYYY-MM-DD`) |
| `days_count` | INTEGER | NOT NULL | Total calendar days |
| `reason` | VARCHAR | NOT NULL | Absence justification |
| `supporting_doc_url`| VARCHAR| NULLABLE | Uploaded document URL |
| `doc_required` | INTEGER | DEFAULT 0 | Whether certificate is mandatory |
| `status` | VARCHAR | DEFAULT 'pending' | `pending`, `approved`, `rejected`, `cancelled` |
| `assigned_approver`| VARCHAR| NOT NULL | Approver name |
| `approver_role` | VARCHAR | NOT NULL | `Advisor`, `HOD`, `Proctor`, `Warden` |
| `submitted_at` | DATETIME| DEFAULT UTC | Submission timestamp |
| `decided_at` | DATETIME| NULLABLE | Decision timestamp |
| `decision_remarks`| VARCHAR | NULLABLE | Approver notes |

---

### Domain E: Hostel Services

#### `hostel_allocations`
Residential bed assignments.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `student_id` | VARCHAR | FK, UNIQUE | Student identifier |
| `hostel_name` | VARCHAR | NOT NULL | Hostel facility title |
| `block` | VARCHAR | NOT NULL | Facility block (`A`, `B`, `C`) |
| `room_number` | VARCHAR | NOT NULL | Assigned room number |
| `bed_number` | VARCHAR | DEFAULT 'B1' | Assigned bed space |
| `warden_name` | VARCHAR | NOT NULL | Chief Warden name |
| `warden_contact` | VARCHAR | NOT NULL | Chief Warden email |
| `check_in_date` | VARCHAR | NOT NULL | Check-in date |
| `status` | VARCHAR | DEFAULT 'allocated'| `allocated`, `vacated` |

#### `hostel_requests`
Hostel service, maintenance, and night pass tickets.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `request_code` | VARCHAR | UNIQUE, NOT NULL, INDEX | Reference code (`HR-2026-0001`) |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `request_type` | VARCHAR | NOT NULL | `maintenance`, `room_change`, `night_out_pass` |
| `details` | VARCHAR | NOT NULL | Request description |
| `priority` | VARCHAR | DEFAULT 'medium' | `low`, `medium`, `high`, `emergency` |
| `warden_approval_required` | INTEGER | DEFAULT 0 | Boolean flag |
| `status` | VARCHAR | DEFAULT 'pending' | `pending`, `approved`, `resolved`, `rejected` |
| `created_at` | DATETIME| DEFAULT UTC | Creation timestamp |
| `resolved_at` | DATETIME| NULLABLE | Completion timestamp |
| `resolution_notes`| VARCHAR | NULLABLE | Maintenance action notes |

---

### Domain F: Fees and Financial Records (Synthetic)

#### `fee_accounts`
Semester billing and dues ledger.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `academic_year` | VARCHAR | DEFAULT '2025-2026' | Academic session |
| `semester` | INTEGER | DEFAULT 5 | Billed semester |
| `total_fees` | INTEGER | DEFAULT 120000 | Total tuition fee (INR) |
| `paid_amount` | INTEGER | DEFAULT 120000 | Amount paid (INR) |
| `outstanding_balance`| INTEGER| DEFAULT 0 | Balance remaining (INR) |
| `due_date` | VARCHAR | NOT NULL | Payment deadline |
| `status` | VARCHAR | DEFAULT 'cleared' | `cleared`, `due`, `overdue` |

#### `fee_transactions`
Payment execution logs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `transaction_ref` | VARCHAR | UNIQUE, NOT NULL, INDEX | Transaction reference |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `category` | VARCHAR | DEFAULT 'tuition' | `tuition`, `hostel`, `examination` |
| `amount` | INTEGER | NOT NULL | Amount paid |
| `payment_method` | VARCHAR | DEFAULT 'NetBanking' | `UPI`, `NetBanking`, `Card` |
| `payment_date` | VARCHAR | NOT NULL | Payment date |
| `status` | VARCHAR | DEFAULT 'completed' | `completed`, `pending`, `failed` |

#### `scholarships`
Fee concessions and merit scholarships.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `scholarship_name`| VARCHAR | NOT NULL | Scholarship scheme title |
| `amount_per_semester`| INTEGER| NOT NULL | Concession amount (INR) |
| `eligibility_criteria`| VARCHAR | NOT NULL | Retention rule requirements |
| `status` | VARCHAR | DEFAULT 'active' | `active`, `under_review`, `discontinued` |

---

### Domain G: Campus Support Services

#### `support_tickets`
IT helpdesk, library, and campus infrastructure complaints.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `ticket_number` | VARCHAR | UNIQUE, NOT NULL, INDEX | Ticket number (`TKT-2026-0001`) |
| `student_id` | VARCHAR | FK (`students.student_id`) | Student identifier |
| `category` | VARCHAR | DEFAULT 'it_support' | `it_support`, `library`, `transport`, etc. |
| `subject` | VARCHAR | NOT NULL | Issue summary |
| `description` | VARCHAR | NOT NULL | Detailed description |
| `priority` | VARCHAR | DEFAULT 'medium' | `low`, `medium`, `high` |
| `status` | VARCHAR | DEFAULT 'open' | `open`, `in_progress`, `resolved`, `closed` |
| `assigned_team` | VARCHAR | NOT NULL | Service desk queue |
| `created_at` | DATETIME| DEFAULT UTC | Ticket creation timestamp |
| `resolved_at` | DATETIME| NULLABLE | Resolution timestamp |

---

### Domain H: University Knowledge Base (Policies & RAG Chunks)

#### `campus_policies`
Structured university regulations with provenance labeling.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `policy_id` | VARCHAR | UNIQUE, NOT NULL, INDEX | Policy identifier (e.g., `POL-ATT-001`) |
| `title` | VARCHAR | NOT NULL | Policy title |
| `category` | VARCHAR | NOT NULL | `attendance`, `leave`, `hostel`, `financial`, `support` |
| `description` | TEXT | NOT NULL | Full policy narrative |
| `rule_conditions` | TEXT | NOT NULL | JSON string of numeric rule parameters |
| `applicable_groups`| TEXT | NOT NULL | JSON string array of student cohorts |
| `effective_date` | VARCHAR | NOT NULL | Effective date (`YYYY-MM-DD`) |
| `expiry_date` | VARCHAR | NULLABLE | Expiration date |
| `source_document` | VARCHAR | NOT NULL | Reference document or manual chapter |
| `provenance_type` | VARCHAR | DEFAULT 'illustrative_demo'| `illustrative_demo` vs `verified_university` |
| `verification_status`| VARCHAR| DEFAULT 'verified' | `verified`, `provisional`, `draft` |
| `version` | VARCHAR | DEFAULT '1.0' | Document version number |

#### `policy_knowledge_chunks` (RAG Ready)
Text chunk passages ready for vector embedding and retrieval indexing.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `policy_id` | VARCHAR | FK (`campus_policies.policy_id`)| Parent policy reference |
| `chunk_index` | INTEGER | DEFAULT 0 | Sequential order within document |
| `title` | VARCHAR | NOT NULL | Chunk subsection title |
| `content_text` | TEXT | NOT NULL | Searchable passage text |
| `metadata_json` | TEXT | NOT NULL | JSON metadata attributes |
| `source_reference`| VARCHAR| NOT NULL | Precise citation reference |
| `token_count` | INTEGER | DEFAULT 0 | Approximate word/token count |
| `embedding_id` | VARCHAR | NULLABLE | Vector database embedding reference |

---

### Domain I: Evaluation & Benchmark Dataset

#### `evaluation_scenarios`
Structured benchmark cases covering normal, failure, and edge-case execution paths.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, Auto | Primary key |
| `scenario_id` | VARCHAR | UNIQUE, NOT NULL, INDEX | Scenario identifier (`SCEN-01` to `SCEN-15`) |
| `name` | VARCHAR | NOT NULL | Benchmark scenario title |
| `category` | VARCHAR | NOT NULL | Testing domain |
| `student_id` | VARCHAR | FK (`students.student_id`) | Test student persona |
| `natural_language_request`| TEXT | NOT NULL | Input prompt |
| `expected_interpretation`| TEXT | NOT NULL | Intent understanding baseline |
| `expected_eligibility`| INTEGER | DEFAULT 1 | Expected binary eligibility (0 or 1) |
| `expected_workflow_steps`| TEXT | NOT NULL | JSON array of expected tool names |
| `expected_approval_required`| INTEGER | DEFAULT 0 | Whether approval gate is expected |
| `expected_final_state`| VARCHAR| NOT NULL | `COMPLETED`, `WAITING_FOR_HUMAN`, `FAILED` |
| `expected_failure_mode`| VARCHAR | NULLABLE | Diagnostic failure category |
| `evaluation_criteria`| TEXT | NOT NULL | JSON array of assertable checks |

---

## 3. Tool Registry Specifications

| Tool Name | Category | Human Gate | Permissions | Side Effects | Idempotent |
|---|---|:---:|---|---|:---:|
| `get_student_profile` | `student_records` | No | student, faculty, admin | read_only | Yes |
| `get_attendance` | `academic` | No | student, faculty, admin | read_only | Yes |
| `get_course_schedule` | `academic` | No | student, faculty | read_only | Yes |
| `get_leave_policy` | `policy` | No | student, faculty, public | read_only | Yes |
| `check_leave_eligibility` | `leave` | No | student, faculty, system | read_only | Yes |
| `create_leave_application` | `leave` | **Yes** | student | record_created | No |
| `get_leave_application_status` | `leave` | No | student, faculty | read_only | Yes |
| `get_student_academic_summary` | `academic` | No | student, faculty, admin | read_only | Yes |
| `get_hostel_status` | `hostel` | No | student, warden, admin | read_only | Yes |
| `submit_hostel_service_request` | `hostel` | **Yes** | student, hostel_resident | record_created | No |
| `get_fee_status` | `financial` | No | student, finance, admin | read_only | Yes |
| `create_support_ticket` | `support` | No | student, faculty | record_created | No |
| `query_campus_policy` | `policy` | No | student, faculty, public | read_only | Yes |
| `get_examination_schedule` | `academic` | No | student, faculty | read_only | Yes |

---

## 4. Seeding & Reset Instructions

### Available Profiles
- `small`: 25 students (Development default, instant load)
- `medium`: 250 students (Full university presentation)
- `large`: 1,000 students (Performance and load benchmarking)

### Seeding Command
From `project-55-campus-agent/backend`:
```powershell
.\venv\Scripts\python.exe -m app.db.seed_engine --profile small --seed 42
```

### Safe Reset & Seed
```powershell
.\venv\Scripts\python.exe -m app.db.seed_engine --profile medium --seed 42 --reset
```
*(Safety rule: Will throw an immediate exception if `ENVIRONMENT=production`)*

