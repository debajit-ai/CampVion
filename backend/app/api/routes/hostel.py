"""
Authenticated route for Hostel Block & Room inventory discovery (for room booking/change & warden allotment).
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import require_authenticated_user
from app.db import models
from app.db.database import get_db
from app.db.seed_v2 import seed_hostel_block_rooms

router = APIRouter()


@router.get("/rooms")
def list_hostel_rooms(
    available_only: bool = Query(default=False),
    block: Optional[str] = Query(default=None),
    sharing_type: Optional[str] = Query(default=None),
    ac_type: Optional[str] = Query(default=None),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if db.query(models.HostelBlockRoom).count() == 0:
        seed_hostel_block_rooms(db)

    query = db.query(models.HostelBlockRoom).filter(models.HostelBlockRoom.is_active == 1)
    if block and block.strip():
        query = query.filter(models.HostelBlockRoom.block == block.strip())
    if sharing_type and sharing_type.strip():
        query = query.filter(models.HostelBlockRoom.sharing_type == sharing_type.strip().lower())
    if ac_type and ac_type.strip():
        query = query.filter(models.HostelBlockRoom.ac_type == ac_type.strip())

    rows = query.order_by(models.HostelBlockRoom.block.asc(), models.HostelBlockRoom.room_number.asc()).all()
    items = []
    for r in rows:
        free_beds = max(0, int(r.capacity) - int(r.occupied))
        if available_only and free_beds <= 0:
            continue
        items.append(
            {
                "id": r.id,
                "room_code": r.room_code,
                "block": r.block,
                "hostel_name": r.hostel_name,
                "room_number": r.room_number,
                "sharing_type": r.sharing_type,
                "ac_type": r.ac_type,
                "capacity": r.capacity,
                "occupied": r.occupied,
                "free_beds": free_beds,
                "available": free_beds > 0,
                "gender": r.gender,
            }
        )

    blocks = sorted({r["block"] for r in items} or {r.block for r in rows})
    return {"items": items, "blocks": blocks}
