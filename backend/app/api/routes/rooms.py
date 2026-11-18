"""
Authenticated API route for Library Discussion Room discovery & live availability checks.
Checks open hours (CAMPUS_TZ 08:00-20:00), max 2-hour duration, capacity, and overlapping
PENDING_APPROVAL / APPROVED bookings.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core import timezone_utils
from app.core.config import settings
from app.core.security import require_authenticated_user
from app.db import models
from app.db.database import get_db
from app.db.seed_v2 import seed_discussion_rooms
from app.services import leave_service

router = APIRouter()


@router.get("/available")
def list_available_discussion_rooms(
    date: Optional[str] = Query(default=None, description="YYYY-MM-DD in campus timezone"),
    start_time: Optional[str] = Query(default=None, description="HH:MM (24h)"),
    end_time: Optional[str] = Query(default=None, description="HH:MM (24h)"),
    people: int = Query(default=2, ge=1, le=20),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    rooms = (
        db.query(models.DiscussionRoom)
        .filter(models.DiscussionRoom.is_active == 1)
        .order_by(models.DiscussionRoom.capacity.asc(), models.DiscussionRoom.id.asc())
        .all()
    )
    if not rooms:
        seed_discussion_rooms(db)
        rooms = (
            db.query(models.DiscussionRoom)
            .filter(models.DiscussionRoom.is_active == 1)
            .order_by(models.DiscussionRoom.capacity.asc(), models.DiscussionRoom.id.asc())
            .all()
        )

    from_utc: Optional[datetime] = None
    to_utc: Optional[datetime] = None
    window_error: Optional[str] = None

    if date and start_time and end_time:
        from_utc = timezone_utils.combine_campus_to_utc(date, start_time)
        to_utc = timezone_utils.combine_campus_to_utc(date, end_time)
        if not from_utc or not to_utc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid date or time format for room search.",
            )
        try:
            leave_service.validate_library_time_window(from_utc, to_utc)
        except HTTPException as exc:
            window_error = str(exc.detail)

    occupied_map: Dict[str, str] = {}
    if from_utc and to_utc:
        occupied_map = leave_service.find_occupied_library_rooms(db, from_utc=from_utc, to_utc=to_utc)

    items: List[Dict[str, Any]] = []
    for rm in rooms:
        conflict = (
            occupied_map.get(f"id:{rm.id}")
            or occupied_map.get(f"code:{rm.room_code.lower()}")
            or occupied_map.get(f"name:{rm.name.lower()}")
        )
        fits_cap = rm.capacity >= people
        items.append(
            {
                "id": rm.id,
                "room_code": rm.room_code,
                "name": rm.name,
                "floor": rm.floor,
                "capacity": rm.capacity,
                "amenities": rm.amenities or "",
                "fits_capacity": fits_cap,
                "available": (conflict is None) and fits_cap and (window_error is None),
                "conflict_reason": (
                    window_error
                    or conflict
                    or (f"Capacity {rm.capacity} is smaller than group size ({people})." if not fits_cap else None)
                ),
            }
        )

    return {
        "items": items,
        "window_valid": window_error is None,
        "window_error": window_error,
        "library_hours": {
            "open_hour": settings.LIBRARY_OPEN_HOUR,
            "close_hour": settings.LIBRARY_CLOSE_HOUR,
            "max_hours": 2,
            "campus_tz": settings.CAMPUS_TZ,
        },
    }
