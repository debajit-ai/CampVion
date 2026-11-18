"""
Idempotent demo user account seeder for CampVion authentication.
Creates or repairs the two default institutional evaluation accounts:
  - Student (S001): alice@lpu.edu / CampVion@2026
  - Administrator:  admin@campvion.edu / Admin@CampVion2026
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db import models
from app.db.database import SessionLocal
from app.db.migrations import run_migrations
from app.services import student_service

logger = logging.getLogger("campvion.seed_users")

DEMO_ACCOUNTS = [
    {
        "email": "alice@lpu.edu",
        "password": "CampVion@2026",
        "full_name": "Alice Sharma",
        "role": "student",
        "student_id": "S001",
    },
    {
        "email": "admin@campvion.edu",
        "password": "Admin@CampVion2026",
        "full_name": "Dr. Rajesh Rao",
        "role": "administrator",
        "student_id": None,
        "authority_title": "Warden",
        "phone": "+91 98765 01042",
        "office": "Hostel Block A, Warden Office",
        "office_hours": "Mon-Fri 10:00-16:00",
        "contact_email": "admin@campvion.edu",
    },
]


def seed_demo_users(db: Optional[Session] = None, verbose: bool = True) -> None:
    """
    Idempotently ensure default Student (S001) and Administrator accounts exist
    with valid scrypt password hashes and active, unlocked flags.
    """
    owns_session = db is None
    if owns_session:
        run_migrations()
        db = SessionLocal()

    assert db is not None
    try:
        for spec in DEMO_ACCOUNTS:
            existing = (
                db.query(models.UserAccount)
                .filter(models.UserAccount.email == spec["email"])
                .first()
            )
            if existing is None:
                account = models.UserAccount(
                    email=spec["email"],
                    full_name=spec["full_name"],
                    password_hash=hash_password(spec["password"]),
                    role=spec["role"],
                    student_id=spec["student_id"],
                    authority_title=spec.get("authority_title"),
                    phone=spec.get("phone"),
                    office=spec.get("office"),
                    office_hours=spec.get("office_hours"),
                    contact_email=spec.get("contact_email"),
                    is_active=1,
                    failed_login_attempts=0,
                    locked_until=None,
                )
                db.add(account)
                db.commit()
                db.refresh(account)
                existing = account
                action = "Created"
            else:
                changed = False
                if not existing.password_hash or not verify_password(spec["password"], existing.password_hash):
                    existing.password_hash = hash_password(spec["password"])
                    changed = True
                if existing.role != spec["role"]:
                    existing.role = spec["role"]
                    changed = True
                if existing.full_name != spec["full_name"]:
                    existing.full_name = spec["full_name"]
                    changed = True
                if not existing.is_active:
                    existing.is_active = 1
                    changed = True
                if existing.failed_login_attempts:
                    existing.failed_login_attempts = 0
                    changed = True
                if existing.locked_until is not None:
                    existing.locked_until = None
                    changed = True
                if existing.student_id != spec["student_id"]:
                    existing.student_id = spec["student_id"]
                    changed = True
                for attr in ("authority_title", "phone", "office", "office_hours", "contact_email"):
                    spec_val = spec.get(attr)
                    if spec_val is not None and not getattr(existing, attr, None):
                        setattr(existing, attr, spec_val)
                        changed = True
                if changed:
                    db.commit()
                    db.refresh(existing)
                    action = "Repaired"
                else:
                    action = "Verified"

            if spec["role"] == "student":
                student_service.ensure_student_for_user(db, existing)

            if verbose:
                print(
                    f"[seed] {action:<8} | {spec['role']:<13} | {spec['email']:<20} | password: {spec['password']}"
                )

        # Ensure Title Case display consistency for any ALL-CAPS student profiles/accounts
        for st in db.query(models.Student).all():
            if st.name and st.name.isupper() and len(st.name) > 2:
                st.name = st.name.title()
        for ua in db.query(models.UserAccount).filter(models.UserAccount.role == "student").all():
            if ua.full_name and ua.full_name.isupper() and len(ua.full_name) > 2:
                ua.full_name = ua.full_name.title()
        db.commit()
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_demo_users(verbose=True)
