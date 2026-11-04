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
            ]
            for col_name, col_def in new_student_columns:
                if col_name not in student_columns:
                    logger.info(f"Adding column '{col_name}' to 'students' table...")
                    conn.execute(text(f"ALTER TABLE students ADD COLUMN {col_name} {col_def};"))
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

    # 3. Create all new relational tables
    Base.metadata.create_all(bind=engine)
    logger.info("CampVion database migrations successfully verified and up-to-date.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()

