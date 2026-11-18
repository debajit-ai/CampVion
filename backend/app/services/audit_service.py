"""
Immutable Audit Trail Service for CampVion governance actions.
Records who performed each sensitive operation, when, on what target, and from where.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.db import models

logger = logging.getLogger("campvion.audit")


def record_audit_event(
    db: Session,
    *,
    action: str,
    target_type: str,
    target_id: Any,
    actor_user: Optional[models.UserAccount] = None,
    actor_role: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> models.AuditLog:
    """Append an immutable audit log entry inside the active transaction."""
    resolved_role = actor_role or (actor_user.role if actor_user else None)
    entry = models.AuditLog(
        actor_user_id=actor_user.id if actor_user else None,
        actor_role=resolved_role,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details_json=json.dumps(details, default=str) if details is not None else None,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    return entry
