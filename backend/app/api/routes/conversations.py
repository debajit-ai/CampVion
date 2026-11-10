"""
CampVion Phase 4 — Conversational Assistant API Routes
Provides persistent multi-turn conversation management, student identity authorization,
smart action confirmation/modification/cancellation, and session recovery across refreshes.
"""

import json
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import require_authenticated_user
from app.db import models
from app.db.database import get_db
from app.services import student_service
from app.llm.conversation_engine import ConversationEngine, resolve_human_date

router = APIRouter()

# Authorized demonstration student profiles selectable in the workspace demo selector
AUTHORIZED_DEMO_STUDENT_IDS = {"S001", "S002", "S003", "S004", "S005"}


def _ensure_conversation_tables(db: Session) -> None:
    """Ensure conversation tables exist in the active SQLite database."""
    bind = db.get_bind()
    models.Base.metadata.create_all(
        bind=bind,
        tables=[
            models.ConversationSession.__table__,
            models.ConversationMessage.__table__,
        ],
    )


def _resolve_authorized_student_id(
    user: models.UserAccount,
    requested_student_id: Optional[str],
    strict_isolation: bool,
    db: Session,
) -> str:
    """
    Independently verify which student profile the authenticated user is allowed to access.
    In strict production isolation mode (or for non-demo arbitrary student IDs), a student
    account can only access their own linked `user.student_id`.
    """
    if user.role == "student":
        student_service.ensure_student_for_user(db, user)

    own_id = (user.student_id or "S001").strip()
    target_id = (requested_student_id or own_id).strip()

    if user.role == "student":
        if strict_isolation and target_id != own_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied: Student account '{user.email}' ({own_id}) is not authorized "
                    f"to access or impersonate student record '{target_id}'."
                ),
            )
        if target_id != own_id and target_id not in AUTHORIZED_DEMO_STUDENT_IDS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied: Student profile '{target_id}' is not an authorized demonstration "
                    f"profile for account '{user.email}'."
                ),
            )

    student = (
        db.query(models.Student)
        .filter(models.Student.student_id == target_id)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student profile '{target_id}' not found.",
        )
    return student.student_id


class SendMessageRequest(BaseModel):
    conversation_id: Optional[str] = Field(
        default=None,
        description="Existing conversation session UUID, or null to start/resume active session",
    )
    student_id: Optional[str] = Field(
        default=None,
        description="Selected student context ID (validated against backend authorization)",
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Student natural language message",
    )
    user_display_name: str = Field(
        default="Student",
        description="Student's preferred display name",
    )


class ConfirmActionRequest(BaseModel):
    action: str = Field(
        ...,
        description="One of: 'confirm', 'cancel', 'edit'",
    )
    updated_slots: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional updated fields when action == 'edit' (e.g. days, start_date, category, reason)",
    )


class NewConversationRequest(BaseModel):
    student_id: Optional[str] = Field(default=None)
    title: Optional[str] = Field(default=None)


@router.get("/")
def list_conversations(
    student_id: Optional[str] = Query(default=None),
    x_strict_student_isolation: Optional[str] = Header(default=None),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """List recent conversation sessions belonging to the authenticated user."""
    _ensure_conversation_tables(db)
    strict = (x_strict_student_isolation or "").lower() == "true"
    resolved_student_id = _resolve_authorized_student_id(user, student_id, strict, db)

    sessions = (
        db.query(models.ConversationSession)
        .filter(
            models.ConversationSession.user_id == user.id,
            models.ConversationSession.student_id == resolved_student_id,
        )
        .order_by(models.ConversationSession.updated_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "conversation_id": s.session_uuid,
            "student_id": s.student_id,
            "title": s.title,
            "status": s.status,
            "active_intent": s.active_intent,
            "active_workflow_request_id": s.active_workflow_request_id,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


@router.post("/new")
def create_new_conversation(
    payload: NewConversationRequest,
    x_strict_student_isolation: Optional[str] = Header(default=None),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Create a fresh persistent conversation session for the authorized student context."""
    _ensure_conversation_tables(db)
    strict = (x_strict_student_isolation or "").lower() == "true"
    resolved_student_id = _resolve_authorized_student_id(
        user, payload.student_id, strict, db
    )

    session = models.ConversationSession(
        session_uuid=f"conv_{secrets.token_hex(10)}",
        user_id=user.id,
        student_id=resolved_student_id,
        title=payload.title or f"Campus Session ({resolved_student_id})",
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    engine = ConversationEngine(db)
    return engine.serialize_session_response(session)


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Retrieve a conversation session and its full message history, enforcing account isolation."""
    _ensure_conversation_tables(db)
    session = (
        db.query(models.ConversationSession)
        .filter(models.ConversationSession.session_uuid == conversation_id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation session not found.",
        )
    if session.user_id is not None and session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access another user's conversation session.",
        )

    engine = ConversationEngine(db)
    return engine.serialize_session_response(session)


@router.post("/message")
async def send_conversation_message(
    payload: SendMessageRequest,
    x_strict_student_isolation: Optional[str] = Header(default=None),
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Process a student message within a persistent multi-turn conversation.
    Enforces student authorization, retains slot context, invokes Groq LLM +
    read-only campus tools, and prepares confirmation cards before consequential actions.
    """
    _ensure_conversation_tables(db)
    trimmed = payload.message.strip()
    if not trimmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    strict = (x_strict_student_isolation or "").lower() == "true"
    resolved_student_id = _resolve_authorized_student_id(
        user, payload.student_id, strict, db
    )

    session: Optional[models.ConversationSession] = None
    if payload.conversation_id:
        session = (
            db.query(models.ConversationSession)
            .filter(models.ConversationSession.session_uuid == payload.conversation_id)
            .first()
        )
        if session and session.user_id is not None and session.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to post to another user's conversation session.",
            )
        # If the user switched student context in the selector, create or switch to a session for that student
        if session and session.student_id != resolved_student_id:
            session = None

    if not session:
        short_title = trimmed[:48] + ("..." if len(trimmed) > 48 else "")
        session = models.ConversationSession(
            session_uuid=f"conv_{secrets.token_hex(10)}",
            user_id=user.id,
            student_id=resolved_student_id,
            title=short_title,
            status="active",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    elif session.title.startswith("New Campus") or session.title.startswith("Campus Session"):
        session.title = trimmed[:48] + ("..." if len(trimmed) > 48 else "")
        db.commit()

    engine = ConversationEngine(db)
    return await engine.process_message(
        session=session,
        user_text=trimmed,
        user_display_name=payload.user_display_name or "Student",
    )


@router.post("/{conversation_id}/confirm")
def confirm_or_modify_prepared_action(
    conversation_id: str,
    payload: ConfirmActionRequest,
    user: models.UserAccount = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Handle explicit Confirmation Card actions ('confirm', 'cancel', 'edit').
    Validates backend authorization and ensures a prepared proposal exists before executing.
    """
    _ensure_conversation_tables(db)
    session = (
        db.query(models.ConversationSession)
        .filter(models.ConversationSession.session_uuid == conversation_id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation session not found.",
        )
    if session.user_id is not None and session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify another user's conversation session.",
        )

    action = payload.action.strip().lower()
    pending_proposal = (
        json.loads(session.pending_confirmation_json)
        if session.pending_confirmation_json
        else None
    )

    engine = ConversationEngine(db)

    if action == "confirm":
        if not pending_proposal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No prepared request is currently awaiting confirmation in this conversation.",
            )

        # Record user confirmation message
        user_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="user",
            content="Confirm and submit request",
            intent_category="CONFIRMATION_RESPONSE",
            metadata_json="{}",
        )
        db.add(user_msg)
        db.commit()

        reply_text, exec_meta = engine.execute_confirmed_proposal(
            session=session,
            proposal=pending_proposal,
        )
        exec_meta["intent_category"] = "CONFIRMATION_RESPONSE"

        assistant_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="assistant",
            content=reply_text,
            intent_category="CONFIRMATION_RESPONSE",
            metadata_json=json.dumps(exec_meta),
        )
        db.add(assistant_msg)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return engine.serialize_session_response(session, latest_assistant_message=assistant_msg)

    elif action == "cancel":
        user_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="user",
            content="Cancel prepared request",
            intent_category="MODIFICATION_OR_CANCELLATION",
            metadata_json="{}",
        )
        db.add(user_msg)

        session.active_intent = None
        session.collected_slots_json = "{}"
        session.missing_slots_json = "[]"
        session.pending_confirmation_json = None
        session.status = "active"

        reply_text = (
            "I've canceled the prepared request — nothing was submitted. "
            "How else can I help you today?"
        )
        assistant_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="assistant",
            content=reply_text,
            intent_category="MODIFICATION_OR_CANCELLATION",
            metadata_json=json.dumps(
                {
                    "intent_category": "MODIFICATION_OR_CANCELLATION",
                    "request_canceled": True,
                    "quick_replies": [
                        "Check my attendance",
                        "I want to apply for leave",
                        "Show my courses",
                    ],
                }
            ),
        )
        db.add(assistant_msg)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return engine.serialize_session_response(session, latest_assistant_message=assistant_msg)

    elif action == "edit":
        if not pending_proposal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No prepared request to edit.",
            )
        updates = payload.updated_slots or {}
        collected = json.loads(session.collected_slots_json or "{}")
        fields = pending_proposal.get("fields", {})

        if "days" in updates and updates["days"]:
            days_val = int(updates["days"])
            collected["days"] = days_val
            fields["days"] = days_val
            fields["duration"] = f"{days_val} {'day' if days_val == 1 else 'days'}"
            if days_val <= 3:
                fields["approver_gate"] = "Faculty Advisor (Human-in-the-Loop Gate)"
            elif days_val <= 7:
                fields["approver_gate"] = "Head of Department (HOD) (Human-in-the-Loop Gate)"
            else:
                fields["approver_gate"] = "Proctor / Dean Student Welfare (Human-in-the-Loop Gate)"

        if "start_date" in updates and updates["start_date"]:
            start_val = resolve_human_date(str(updates["start_date"]))
            collected["start_date"] = start_val
            fields["start_date"] = start_val

        if "category" in updates and updates["category"]:
            cat_val = str(updates["category"]).lower()
            collected["category"] = cat_val
            fields["category"] = cat_val.replace("_", " ").title()

        if "reason" in updates and updates["reason"]:
            rsn_val = str(updates["reason"]).strip()
            collected["reason"] = rsn_val
            fields["reason"] = rsn_val

        days_final = fields.get("days", collected.get("days", 1))
        cat_final = collected.get("category", "personal")
        start_final = fields.get("start_date", collected.get("start_date", "Tomorrow"))
        rsn_final = fields.get("reason", collected.get("reason", "Personal leave"))

        pending_proposal["fields"] = fields
        pending_proposal["raw_goal"] = (
            f"Apply for {cat_final} leave for {days_final} days starting {start_final} "
            f"because {rsn_final}"
        )

        session.collected_slots_json = json.dumps(collected)
        session.pending_confirmation_json = json.dumps(pending_proposal)

        reply_text = (
            f"I've updated your prepared leave request (**{days_final} {'day' if days_final == 1 else 'days'}**, "
            f"starting **{start_final}**, reason: **{rsn_final}**). Please review and confirm below when ready."
        )
        assistant_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="assistant",
            content=reply_text,
            intent_category="MODIFICATION_OR_CANCELLATION",
            metadata_json=json.dumps(
                {
                    "intent_category": "MODIFICATION_OR_CANCELLATION",
                    "awaiting_confirmation": True,
                    "confirmation_proposal": pending_proposal,
                    "collected_slots": collected,
                }
            ),
        )
        db.add(assistant_msg)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return engine.serialize_session_response(session, latest_assistant_message=assistant_msg)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported confirmation action '{action}'. Use 'confirm', 'cancel', or 'edit'.",
    )

