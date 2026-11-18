import logging
from sqlalchemy import text, inspect
from app.db.database import engine, Base
import app.db.models  # Ensure all models are registered with Base

logger = logging.getLogger("campvion.migrations")

def run_migrations():
    """
    Safely and idempotently applies database schema updates to SQLite.
    1. Detects missing columns on existing tables and executes ALTER TABLE ADD COLUMN.
    2. Invokes Base.metadata.create_all to create new relational tables.
    3. Guarantees zero data loss and full backward compatibility.
    """
    logger.info("Starting CampVion database migration check...")

    with engine.connect() as conn:
        inspector = inspect(conn)
        existing_tables = inspector.get_table_names()

        # 1. Check and migrate `students` table if it already exists
        if "students" in existing_tables:
            student_columns = [col["name"] for col in inspector.get_columns("students")]
            new_student_columns = [
                ("department", "VARCHAR DEFAULT 'School of Computer Science & Engineering'"),
                ("academic_year", "INTEGER DEFAULT 3"),
                ("section", "VARCHAR DEFAULT 'K21CS'"),
                ("enrollment_status", "VARCHAR DEFAULT 'active'"),
                ("advisor_name", "VARCHAR DEFAULT 'Dr. Rajesh Rao'"),
                ("advisor_email", "VARCHAR DEFAULT 'rajesh.rao@lpu.edu'"),
                ("residence_type", "VARCHAR DEFAULT 'hostel'"),
                ("hostel_block", "VARCHAR DEFAULT 'BH-1'"),
                ("room_number", "VARCHAR DEFAULT '302'"),
                ("college", "VARCHAR DEFAULT 'Lovely Professional University'"),
            ]
            for col_name, col_def in new_student_columns:
                if col_name not in student_columns:
                    logger.info(f"Adding column '{col_name}' to 'students' table...")
                    conn.execute(text(f"ALTER TABLE students ADD COLUMN {col_name} {col_def};"))
                    conn.commit()
            conn.execute(text("UPDATE students SET college = 'Lovely Professional University' WHERE college IS NULL OR TRIM(college) = '';"))
            conn.commit()

        # 2. Check and migrate `courses` table if it already exists
        if "courses" in existing_tables:
            course_columns = [col["name"] for col in inspector.get_columns("courses")]
            new_course_columns = [
                ("credits", "INTEGER DEFAULT 4"),
                ("department_id", "INTEGER DEFAULT NULL"),
                ("semester", "INTEGER DEFAULT 1"),
            ]
            for col_name, col_def in new_course_columns:
                if col_name not in course_columns:
                    logger.info(f"Adding column '{col_name}' to 'courses' table...")
                    conn.execute(text(f"ALTER TABLE courses ADD COLUMN {col_name} {col_def};"))
                    conn.commit()

        # 3. Check and migrate `user_accounts` table for administrative metadata
        if "user_accounts" in existing_tables:
            user_columns = [col["name"] for col in inspector.get_columns("user_accounts")]
            new_user_columns = [
                ("authority_title", "VARCHAR DEFAULT NULL"),
                ("phone", "VARCHAR DEFAULT NULL"),
                ("office", "VARCHAR DEFAULT NULL"),
                ("office_hours", "VARCHAR DEFAULT NULL"),
                ("contact_email", "VARCHAR DEFAULT NULL"),
            ]
            for col_name, col_def in new_user_columns:
                if col_name not in user_columns:
                    logger.info(f"Adding column '{col_name}' to 'user_accounts' table...")
                    conn.execute(text(f"ALTER TABLE user_accounts ADD COLUMN {col_name} {col_def};"))
                    conn.commit()

        # 4. Check and migrate `leave_requests` table for workflow state, snapshots & optimistic locking
        if "leave_requests" in existing_tables:
            leave_columns = [col["name"] for col in inspector.get_columns("leave_requests")]
            new_leave_columns = [
                ("workflow_run_id", "INTEGER DEFAULT NULL"),
                ("attendance_snapshot", "FLOAT DEFAULT NULL"),
                ("policy_result", "TEXT DEFAULT NULL"),
                ("routed_to_role", "VARCHAR NOT NULL DEFAULT 'Warden'"),
                ("assigned_approver_user_id", "INTEGER DEFAULT NULL"),
                ("decided_by", "INTEGER DEFAULT NULL"),
                ("decided_by_name", "VARCHAR DEFAULT NULL"),
                ("decision_comment", "TEXT DEFAULT NULL"),
                ("rejection_reason", "TEXT DEFAULT NULL"),
                ("created_at", "DATETIME DEFAULT NULL"),
                ("updated_at", "DATETIME DEFAULT NULL"),
                ("version", "INTEGER NOT NULL DEFAULT 1"),
                ("request_type", "VARCHAR NOT NULL DEFAULT 'leave'"),
                ("title", "VARCHAR DEFAULT NULL"),
                ("details_json", "TEXT DEFAULT NULL"),
                ("from_at", "DATETIME DEFAULT NULL"),
                ("to_at", "DATETIME DEFAULT NULL"),
                ("college_snapshot", "VARCHAR DEFAULT NULL"),
                ("destination", "VARCHAR DEFAULT NULL"),
                ("exit_gate", "VARCHAR DEFAULT NULL"),
                ("entry_gate", "VARCHAR DEFAULT NULL"),
                ("slip_no", "VARCHAR DEFAULT NULL"),
                ("verify_code", "VARCHAR DEFAULT NULL"),
                ("approved_at", "DATETIME DEFAULT NULL"),
            ]
            for col_name, col_def in new_leave_columns:
                if col_name not in leave_columns:
                    logger.info(f"Adding column '{col_name}' to 'leave_requests' table...")
                    conn.execute(text(f"ALTER TABLE leave_requests ADD COLUMN {col_name} {col_def};"))
                    conn.commit()

            # Unique indexes for v2 slip numbers & verification codes (safe alongside existing NULLs)
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_leave_requests_slip_no ON leave_requests (slip_no);"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_leave_requests_verify_code ON leave_requests (verify_code);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leave_requests_from_at ON leave_requests (from_at);"))
            conn.commit()

            # Backfill timestamps & normalize legacy lowercase status values idempotently
            conn.execute(text("UPDATE leave_requests SET created_at = COALESCE(created_at, submitted_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, decided_at, submitted_at, CURRENT_TIMESTAMP), version = COALESCE(version, 1), request_type = COALESCE(request_type, 'leave');"))
            conn.execute(text("UPDATE leave_requests SET status = 'PENDING_APPROVAL' WHERE LOWER(status) = 'pending';"))
            conn.execute(text("UPDATE leave_requests SET status = 'APPROVED' WHERE LOWER(status) = 'approved';"))
            conn.execute(text("UPDATE leave_requests SET status = 'REJECTED' WHERE LOWER(status) = 'rejected';"))
            conn.execute(text("UPDATE leave_requests SET status = 'CANCELLED' WHERE LOWER(status) IN ('cancelled', 'canceled');"))
            conn.commit()

    # 5. Create all new relational tables (including `notifications` and `audit_log`)
    Base.metadata.create_all(bind=engine)
    logger.info("CampVion database migrations successfully verified and up-to-date.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()

