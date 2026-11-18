"""
Authenticated Server-Sent Events (SSE) Stream & Notification Inbox API Routes.
Provides real-time bidirectional notification updates with 15s keepalive heartbeats
and Last-Event-ID catchup recovery.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import require_authenticated_user, resolve_session_and_user
from app.db import models
from app.db.database import SessionLocal, get_db
from app.services import events_service

logger = logging.getLogger("campvion.sse")

events_router = APIRouter()
notifications_router = APIRouter()


def _serialize_notification(n: models.Notification) -> Dict[str, Any]:
    payload_data: Dict[str, Any] = {}
    if n.payload_json:
        try:
            payload_data = json.loads(n.payload_json)
        except Exception:
            payload_data = {}
    return {
        "id": n.id,
        "user_id": n.user_id,
        "leave_request_id": n.leave_request_id,
        "event_type": n.event_type,
        "title": n.title,
        "body": n.body,
        "request": payload_data.get("leave_request"),
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@events_router.get("")
@events_router.get("/", include_in_schema=False)
async def stream_events(
    request: Request,
    last_event_id: Optional[str] = Query(default=None),
):
    """
    Authenticated SSE endpoint (`text/event-stream`).
    - Rejects unauthenticated clients immediately with 401.
    - Supports `Last-Event-ID` header or `last_event_id` query parameter catchup.
    - Uses a short-lived DB session only for auth & catchup so infinite SSE streams never pin DB pool connections.
    """
    raw_last_id = request.headers.get("Last-Event-ID") or last_event_id
    parsed_last_id: Optional[int] = None
    if raw_last_id and str(raw_last_id).strip().isdigit():
        parsed_last_id = int(str(raw_last_id).strip())

    missed_frames = []
    db = SessionLocal()
    try:
        _, user = resolve_session_and_user(request, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for event stream.",
            )

        user_id = int(user.id)
        user_role = str(user.role or "student")

        # Preload any missed events before releasing DB connection
        if parsed_last_id is not None:
            missed = (
                db.query(models.Notification)
                .filter(
                    models.Notification.user_id == user_id,
                    models.Notification.id > parsed_last_id,
                )
                .order_by(models.Notification.id.asc())
                .limit(50)
                .all()
            )
            for m in missed:
                serialized = _serialize_notification(m)
                evt = events_service.SSEEvent(
                    event_id=str(m.id),
                    event_type=m.event_type or "notification.created",
                    payload={
                        "notification": serialized,
                        "request": serialized.get("request"),
                        "catchup": True,
                    },
                )
                missed_frames.append(evt.to_sse_frame())
    finally:
        db.close()

    async def event_generator():
        connected_evt = events_service.SSEEvent(
            event_id="0",
            event_type="connected",
            payload={"user_id": user_id, "role": user_role},
        )
        yield connected_evt.to_sse_frame()

        for frame in missed_frames:
            yield frame

        sub = events_service.event_broker._register(user_id=user_id, role=user_role)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(sub.queue.get(), timeout=15.0)
                    yield event.to_sse_frame()
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            events_service.event_broker._unregister(sub)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@notifications_router.get("")
@notifications_router.get("/", include_in_schema=False)
def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    rows = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id)
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
        .limit(limit)
        .all()
    )
    unread_count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user.id,
            models.Notification.read_at.is_(None),
        )
        .count()
    )
    return {
        "items": [_serialize_notification(n) for n in rows],
        "unread_count": unread_count,
    }


@notifications_router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    notif = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notif.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this notification.")

    if notif.read_at is None:
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)

    unread_count = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.read_at.is_(None))
        .count()
    )
    return {"notification": _serialize_notification(notif), "unread_count": unread_count}


@notifications_router.post("/read-all")
def mark_all_notifications_read(
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user.id,
            models.Notification.read_at.is_(None),
        )
        .update({"read_at": now}, synchronize_session=False)
    )
    db.commit()
    return {"unread_count": 0}
