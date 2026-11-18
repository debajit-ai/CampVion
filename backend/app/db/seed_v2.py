"""
Idempotent seed helpers for CampVion Services v2 infrastructure tables.
Called automatically at API startup and inside integration tests.
"""

from sqlalchemy.orm import Session

from app.db import models

DEFAULT_CAMPUS_GATES = [
    {
        "gate_code": "GATE-1",
        "name": "Gate 1 - Main Gate",
        "location": "University Main Entrance, GT Road",
        "is_default_hostel": 0,
    },
    {
        "gate_code": "GATE-2",
        "name": "Gate 2 - Hostel Gate",
        "location": "Residential Hostel Zone",
        "is_default_hostel": 1,
    },
    {
        "gate_code": "GATE-3",
        "name": "Gate 3 - Library Gate",
        "location": "Central Academic & Library Plaza",
        "is_default_hostel": 0,
    },
    {
        "gate_code": "GATE-4",
        "name": "Gate 4 - Sports Complex Gate",
        "location": "Athletics & Indoor Stadium Wing",
        "is_default_hostel": 0,
    },
]


def seed_campus_gates(db: Session) -> None:
    existing_names = {g.name for g in db.query(models.CampusGate).all()}
    added = False
    for entry in DEFAULT_CAMPUS_GATES:
        if entry["name"] not in existing_names:
            db.add(
                models.CampusGate(
                    gate_code=entry["gate_code"],
                    name=entry["name"],
                    location=entry["location"],
                    is_default_hostel=entry["is_default_hostel"],
                    is_active=1,
                )
            )
            added = True
    if added:
        db.commit()


def seed_services_v2_defaults(db: Session) -> None:
    seed_campus_gates(db)
