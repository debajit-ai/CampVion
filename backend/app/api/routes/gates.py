"""
Authenticated route for Campus Exit/Entry Gates (used during leave slip approval).
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_authenticated_user
from app.db import models
from app.db.database import get_db
from app.db.seed_v2 import seed_campus_gates

router = APIRouter()


@router.get("")
@router.get("/")
def list_campus_gates(
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    rows = (
        db.query(models.CampusGate)
        .filter(models.CampusGate.is_active == 1)
        .order_by(models.CampusGate.id.asc())
        .all()
    )
    if not rows:
        seed_campus_gates(db)
        rows = (
            db.query(models.CampusGate)
            .filter(models.CampusGate.is_active == 1)
            .order_by(models.CampusGate.id.asc())
            .all()
        )
    return {
        "items": [
            {
                "id": g.id,
                "gate_code": g.gate_code,
                "name": g.name,
                "location": g.location,
                "is_default_hostel": bool(g.is_default_hostel),
            }
            for g in rows
        ]
    }
