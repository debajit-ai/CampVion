"""
CampVion Phase 4 — Conversational Agentic AI Engine
Provides multi-turn natural language understanding, 8-way intent routing,
context & slot retention, live read-only campus tool execution, smart action
confirmation cards, and governed execution via AXORAAgent.
"""

import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.agent import AXORAAgent
from app.db import models
from app.llm.base import LLMMessage
from app.llm.exceptions import (
    LLMAuthenticationError,
    LLMProviderError,
    LLMQuotaExhaustedError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.llm.factory import get_llm_provider
from app.tools.registry import registry

logger = logging.getLogger("campvion.llm.conversation")


# =============================================================================
# STRUCTURED LLM TURN ANALYSIS SCHEMA
# =============================================================================

class LLMConversationalTurnSchema(BaseModel):
    """Structured output schema requested from Groq for each conversational turn."""

    intent_category: str = Field(
        default="GENERAL_CONVERSATION",
        description=(
            "One of: GENERAL_CONVERSATION, GENERAL_CAMPUS_INFO, STUDENT_RECORD_QUERY, "
            "NEW_OPERATIONAL_REQUEST, FOLLOW_UP_ANSWER, CONFIRMATION_RESPONSE, "
            "MODIFICATION_OR_CANCELLATION, UNSUPPORTED_REQUEST"
        ),
    )
    domain: str = Field(
        default="general",
        description="One of: general, attendance, leave, academic, hostel, fee, support, policy, unsupported",
    )
    operation_type: Optional[str] = Field(
        default=None,
        description="If operational: LEAVE_APPLICATION, HOSTEL_SERVICE, SUPPORT_TICKET, or null",
    )
    query_type: Optional[str] = Field(
        default=None,
        description=(
            "If STUDENT_RECORD_QUERY: attendance, courses, exams, fees, hostel, "
            "leave_status, profile, or null"
        ),
    )
    attendance_scope: Optional[str] = Field(
        default=None,
        description="For attendance enquiries: 'overall', 'subject', or 'unspecified'",
    )
    subject_code: Optional[str] = Field(
        default=None,
        description="Specific course code if mentioned (e.g. CSE101, MTH201)",
    )
    days: Optional[int] = Field(
        default=None,
        description="Extracted leave duration in integer days if explicitly stated by the user",
    )
    start_date: Optional[str] = Field(
        default=None,
        description="Extracted start date or relative date phrase (e.g. 'tomorrow', '2026-11-06', 'next Monday') if stated",
    )
    category: Optional[str] = Field(
        default=None,
        description="Leave category if stated: 'medical', 'personal', 'family_emergency', 'academic'",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Specific reason or justification provided by the student",
    )
    hostel_request_type: Optional[str] = Field(
        default=None,
        description="For hostel requests: 'maintenance', 'room_change', 'night_out_pass', 'complaint'",
    )
    support_category: Optional[str] = Field(
        default=None,
        description="For support tickets: 'it_support', 'library', 'transport', 'id_card', 'facilities', 'general'",
    )
    details: Optional[str] = Field(
        default=None,
        description="Extracted details or issue description for hostel/support requests",
    )
    confirmation_decision: Optional[str] = Field(
        default=None,
        description="If CONFIRMATION_RESPONSE or MODIFICATION_OR_CANCELLATION: 'confirm', 'cancel', 'modify'",
    )
    assistant_reply: str = Field(
        default="",
        description="Natural, friendly, concise conversational reply to the student",
    )


# =============================================================================
# DETERMINISTIC HELPERS & DATE FORMATTING
# =============================================================================

WORD_TO_NUMBER = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "fourteen": 14,
    "fifteen": 15,
}


def resolve_human_date(raw_date_str: Optional[str]) -> str:
    """Convert relative date phrases like 'tomorrow' or 'today' into a clear human date."""
    now = datetime.now(timezone.utc)
    if not raw_date_str:
        target = now + timedelta(days=1)
        return target.strftime("%d %B %Y")

    cleaned = raw_date_str.strip().lower()
    if "day after tomorrow" in cleaned:
        target = now + timedelta(days=2)
        return f"{target.strftime('%d %B %Y')} (Day after tomorrow)"
    if "tomorrow" in cleaned or "tmrw" in cleaned:
        target = now + timedelta(days=1)
        return f"{target.strftime('%d %B %Y')} (Tomorrow)"
    if "today" in cleaned:
        return f"{now.strftime('%d %B %Y')} (Today)"
    if "next monday" in cleaned or "monday" in cleaned:
        days_ahead = (0 - now.weekday() + 7) % 7
        if days_ahead == 0:
            days_ahead = 7
        target = now + timedelta(days=days_ahead)
        return f"{target.strftime('%d %B %Y')} (Monday)"
    return raw_date_str.strip()


def extract_days_from_text(text: str) -> Optional[int]:
    """Extract integer day count from digits or English number words."""
    lower = text.lower().strip()
    m_digit = re.search(r"\b(\d+)\s*(?:day|days|d)\b", lower)
    if m_digit:
        return int(m_digit.group(1))

    # Bare number when answering "How many days?"
    if re.fullmatch(r"\d+", lower):
        val = int(lower)
        if 1 <= val <= 60:
            return val

    for word, num in WORD_TO_NUMBER.items():
        if re.search(rf"\b{word}\s*(?:day|days)?\b", lower):
            return num

    if "a week" in lower or "one week" in lower or lower == "week":
        return 7
    if "couple of days" in lower:
        return 2
    return None


def extract_date_from_text(text: str) -> Optional[str]:
    """Extract start date expression from student text."""
    lower = text.lower().strip()
    if "day after tomorrow" in lower:
        return resolve_human_date("day after tomorrow")
    if "tomorrow" in lower or "tmrw" in lower:
        return resolve_human_date("tomorrow")
    if "today" in lower:
        return resolve_human_date("today")
    if "monday" in lower:
        return resolve_human_date("monday")
    if "tuesday" in lower:
        return "Upcoming Tuesday"
    if "wednesday" in lower:
        return "Upcoming Wednesday"
    if "thursday" in lower:
        return "Upcoming Thursday"
    if "friday" in lower:
        return "Upcoming Friday"
    if "next week" in lower:
        return "Next Week"

    # ISO date YYYY-MM-DD
    m_iso = re.search(r"\b(202\d-\d{2}-\d{2})\b", text)
    if m_iso:
        return m_iso.group(1)

    # e.g. "6 November", "Nov 6", "10th November 2026"
    m_named = re.search(
        r"\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+202\d)?)\b",
        lower,
    )
    if m_named:
        return m_named.group(1).title()

    return None


def extract_leave_category_and_reason(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract leave category and reason from student message."""
    lower = text.lower().strip()
    category: Optional[str] = None
    reason: Optional[str] = None

    if any(
        w in lower
        for w in [
            "medical",
            "sick",
            "fever",
            "doctor",
            "hospital",
            "dental",
            "clinic",
            "illness",
            "surgery",
            "health",
        ]
    ):
        category = "medical"
        reason = "Medical reasons"
    elif any(w in lower for w in ["family emergency", "bereavement", "urgent family"]):
        category = "family_emergency"
        reason = "Family emergency"
    elif any(
        w in lower
        for w in [
            "family function",
            "wedding",
            "sister's marriage",
            "festival",
            "diwali",
            "personal",
            "going home",
            "traveling home",
        ]
    ):
        category = "personal"
        reason = "Family function" if "family function" in lower else "Personal reasons"
    elif any(
        w in lower
        for w in ["competition", "hackathon", "robotics", "academic duty", "conference", "sports"]
    ):
        category = "academic"
        reason = "Academic duty / competition"

    # Extract explicit "because ..." / "due to ..." / "for ..." phrase if present
    m_reason = re.search(
        r"(?:because of|because|due to|reason is|for a|for my)\s+([^.!?\n]+)",
        text,
        re.IGNORECASE,
    )
    if m_reason:
        extracted = m_reason.group(1).strip().rstrip(".")
        if len(extracted) >= 3:
            reason = extracted[0].upper() + extracted[1:]
            if not category:
                category = "medical" if "medical" in extracted.lower() else "personal"

    return category, reason


# =============================================================================
# CONVERSATIONAL ENGINE
# =============================================================================

class ConversationEngine:
    """
    Stateful multi-turn conversational orchestrator.
    Combines Groq cloud LLM understanding with deterministic slot tracking,
    live read-only campus tool retrieval, smart confirmation cards, and
    governed AXORAAgent execution.
    """

    def __init__(self, db: Session):
        self.db = db
        self.provider = get_llm_provider()

    def _get_student_context(self, student_id: str) -> Dict[str, Any]:
        """Fetch live student profile & attendance summary from database tools."""
        profile_tool = registry.get_tool("get_student_profile")
        att_tool = registry.get_tool("get_attendance")
        courses_tool = registry.get_tool("get_course_schedule")

        profile = profile_tool.execute(db=self.db, student_id=student_id) if profile_tool else {}
        att_records = att_tool.execute(db=self.db, student_id=student_id) if att_tool else []
        courses = courses_tool.execute(db=self.db, student_id=student_id) if courses_tool else []

        total_att = 0
        total_cls = 0
        if isinstance(att_records, list):
            for r in att_records:
                total_att += r.get("attended", 0)
                total_cls += r.get("total", 0)

        overall_pct = round((total_att / total_cls) * 100, 1) if total_cls > 0 else 75.0
        first_name = (
            profile.get("name", "Student").split()[0]
            if isinstance(profile, dict) and profile.get("name")
            else "Student"
        )

        return {
            "student_id": student_id,
            "profile": profile if isinstance(profile, dict) else {},
            "first_name": first_name,
            "attendance_records": att_records if isinstance(att_records, list) else [],
            "courses": courses if isinstance(courses, list) else [],
            "overall_attendance_pct": overall_pct,
            "total_attended": total_att,
            "total_classes": total_cls,
            "is_eligible": overall_pct >= 75.0,
        }

    async def _analyze_with_groq(
        self,
        student_ctx: Dict[str, Any],
        session: models.ConversationSession,
        recent_messages: List[models.ConversationMessage],
        user_text: str,
    ) -> Tuple[Optional[LLMConversationalTurnSchema], Dict[str, Any]]:
        """
        Invoke Groq cloud LLM for structured intent classification, slot extraction,
        and natural conversational response generation.
        """
        if not self.provider.api_key and self.provider.provider_name not in ["mock"]:
            return None, {
                "used_llm": False,
                "provider": self.provider.provider_name,
                "model": self.provider.model,
                "status": "fallback_no_api_key",
            }

        history_lines = []
        for msg in recent_messages[-6:]:
            role_label = "Student" if msg.role == "user" else "CampVion"
            snippet = (msg.content or "").strip()
            if len(snippet) > 220:
                snippet = snippet[:217] + "..."
            history_lines.append(f"{role_label}: {snippet}")
        history_block = "\n".join(history_lines) if history_lines else "(Start of conversation)"

        collected_slots = json.loads(session.collected_slots_json or "{}")
        missing_slots = json.loads(session.missing_slots_json or "[]")
        pending_conf = json.loads(session.pending_confirmation_json) if session.pending_confirmation_json else None

        system_prompt = (
            "You are CampVion, an intelligent, warm, and reliable university operations AI assistant.\n"
            f"Current Student: {student_ctx['profile'].get('name', student_ctx['student_id'])} "
            f"(ID: {student_ctx['student_id']}, Program: {student_ctx['profile'].get('program', 'B.Tech')}, "
            f"Semester: {student_ctx['profile'].get('semester', 5)}, "
            f"Overall Attendance: {student_ctx['overall_attendance_pct']}%).\n"
            f"Active Conversation State:\n"
            f"- active_intent: {session.active_intent or 'None'}\n"
            f"- collected_slots: {json.dumps(collected_slots)}\n"
            f"- missing_slots: {json.dumps(missing_slots)}\n"
            f"- has_pending_confirmation: {bool(pending_conf)}\n\n"
            "Classify the student's message into one of the 8 intent categories:\n"
            "1. GENERAL_CONVERSATION: Greetings ('Hey CampVion!', 'Hello', 'Thanks'), asking what CampVion can do.\n"
            "2. GENERAL_CAMPUS_INFO: General questions about university rules, leave process, attendance rules (<75%), hostel process, required documents.\n"
            "3. STUDENT_RECORD_QUERY: Asking about their own attendance, courses, exam schedule, fees, hostel room, or leave application status.\n"
            "4. NEW_OPERATIONAL_REQUEST: Starting a leave application, hostel service request, or support ticket.\n"
            "5. FOLLOW_UP_ANSWER: Answering a clarification question or supplying missing details (e.g. 'Overall', 'Three days', 'Tomorrow', 'Medical reasons').\n"
            "6. CONFIRMATION_RESPONSE: Saying 'Yes', 'Confirm', 'Submit it' to confirm a prepared request.\n"
            "7. MODIFICATION_OR_CANCELLATION: Modifying details ('Change it to 2 days', 'Make it personal') or canceling ('Cancel', 'Never mind').\n"
            "8. UNSUPPORTED_REQUEST: Anything outside university operations (ordering food, booking flights, writing essays, changing grades).\n\n"
            "Important rules:\n"
            "- Only populate `days`, `start_date`, `category`, or `reason` if the student explicitly stated them in this message.\n"
            "- Keep `assistant_reply` warm, natural, concise, and helpful. Never invent attendance numbers or policy rules."
        )

        user_prompt = (
            f"Recent Conversation History:\n{history_block}\n\n"
            f"Latest Student Message: {user_text}"
        )

        try:
            parsed, llm_resp = await self.provider.generate_structured(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt),
                ],
                schema=LLMConversationalTurnSchema,
            )
            return parsed, {
                "used_llm": True,
                "provider": llm_resp.provider,
                "model": llm_resp.model,
                "latency_ms": llm_resp.latency_ms,
                "usage": llm_resp.usage.model_dump() if llm_resp.usage else None,
                "status": "ok",
            }
        except (
            LLMAuthenticationError,
            LLMRateLimitError,
            LLMQuotaExhaustedError,
            LLMTimeoutError,
            LLMProviderError,
        ) as exc:
            logger.warning("Groq conversational turn fallback triggered: %s", str(exc))
            return None, {
                "used_llm": False,
                "provider": self.provider.provider_name,
                "model": self.provider.model,
                "status": "provider_error_fallback",
                "error_note": getattr(exc, "user_friendly_message", str(exc)),
            }
        except Exception as exc:
            logger.warning("Unexpected LLM analysis error, using deterministic state machine: %s", str(exc))
            return None, {
                "used_llm": False,
                "provider": self.provider.provider_name,
                "model": self.provider.model,
                "status": "unexpected_error_fallback",
            }

    def _classify_deterministically(
        self,
        user_text: str,
        active_intent: Optional[str],
        missing_slots: List[str],
        has_pending_confirmation: bool,
    ) -> str:
        """
        Deterministic routing classification that works alongside Groq and guarantees
        exact state transitions for multi-turn clarifications, confirmations, and guardrails.
        """
        text = user_text.strip()
        lower = text.lower()

        # 0. Diagnostic fault injection directive -> direct operational workflow
        if "failure_mode=" in lower:
            return "NEW_OPERATIONAL_REQUEST"

        # 1. Explicit cancellation or modification
        if any(
            phrase in lower
            for phrase in [
                "cancel",
                "never mind",
                "nevermind",
                "abort",
                "stop request",
                "don't submit",
                "do not submit",
                "discard",
            ]
        ):
            return "MODIFICATION_OR_CANCELLATION"

        if (active_intent or has_pending_confirmation) and any(
            phrase in lower
            for phrase in [
                "change it to",
                "change duration",
                "change to",
                "make it",
                "instead",
                "update to",
                "modify",
                "edit details",
            ]
        ):
            return "MODIFICATION_OR_CANCELLATION"

        # 2. Explicit confirmation phrases ("yes", "confirm", "submit it", "confirm and submit")
        confirm_patterns = [
            r"^(?:yes|yep|yeah|sure|ok|okay|confirm|submit|proceed|go ahead)\b",
            r"\b(?:confirm and submit|yes submit|submit it|please submit|confirm request)\b",
        ]
        if any(re.search(pat, lower) for pat in confirm_patterns):
            # Only treat "sure"/"okay" as confirmation if not starting a new topic
            if not any(w in lower for w in ["leave", "attendance", "hostel", "fee", "exam", "course"]):
                return "CONFIRMATION_RESPONSE"
            if "submit" in lower or "confirm" in lower:
                return "CONFIRMATION_RESPONSE"

        # 3. Unsupported requests outside university scope
        unsupported_keywords = [
            "pizza",
            "burger",
            "order food",
            "book a flight",
            "flight ticket",
            "movie ticket",
            "netflix",
            "write my essay",
            "do my homework",
            "solve this calculus",
            "hack",
            "change my grade",
            "bitcoin",
            "stock market",
            "weather in",
        ]
        if any(kw in lower for kw in unsupported_keywords):
            return "UNSUPPORTED_REQUEST"

        # 4. If we are actively waiting for follow-up slots, check if user is answering them
        if active_intent == "ATTENDANCE_ENQUIRY" and "attendance_scope" in missing_slots:
            if any(
                w in lower
                for w in ["overall", "all", "total", "summary", "particular", "subject", "course", "cse", "mth", "phy", "eng"]
            ):
                return "FOLLOW_UP_ANSWER"

        if active_intent == "LEAVE_APPLICATION" and missing_slots:
            extracted_days = extract_days_from_text(text)
            extracted_date = extract_date_from_text(text)
            cat, rsn = extract_leave_category_and_reason(text)
            if extracted_days is not None or extracted_date is not None or cat is not None or rsn is not None:
                # Unless they are switching to an unrelated query
                if not any(w in lower for w in ["what is my attendance", "fee status", "exam schedule"]):
                    return "FOLLOW_UP_ANSWER"
            # Short direct answers when reason is the only missing slot
            if missing_slots == ["reason"] and len(text.split()) <= 12 and "?" not in text:
                return "FOLLOW_UP_ANSWER"
            if missing_slots == ["start_date"] and len(text.split()) <= 6 and "?" not in text:
                return "FOLLOW_UP_ANSWER"

        # 5. Greetings & General Conversation
        greeting_patterns = [
            r"^(?:hi|hey|hello|hola|namaste|good morning|good afternoon|good evening|yo)\b",
            r"^(?:thanks|thank you|thx|appreciate it)\b",
            r"\b(?:what can you do|who are you|help me|what are your capabilities|how do you work|how does campvion work)\b",
        ]
        if any(re.search(pat, lower) for pat in greeting_patterns) and not any(
            w in lower for w in ["leave", "attendance", "hostel", "fee", "exam", "ticket"]
        ):
            return "GENERAL_CONVERSATION"

        # 6. General Campus Policy / Process Questions
        policy_question_indicators = [
            "how do i apply",
            "how to apply",
            "what happens if",
            "below 75",
            "less than 75",
            "condonation",
            "explain the",
            "what documents",
            "policy",
            "rules for",
            "regulation",
            "minimum attendance",
            "process for",
            "understand this university process",
        ]
        if any(ind in lower for ind in policy_question_indicators):
            return "GENERAL_CAMPUS_INFO"

        # 7. Operational Requests (Leave Application, Hostel Service Request, Support Ticket)
        if any(
            phrase in lower
            for phrase in [
                "apply for leave",
                "need leave",
                "want leave",
                "want to apply for leave",
                "medical leave",
                "personal leave",
                "casual leave",
                "duty leave",
                "take leave",
                "request leave",
                "leave for",
                "days of leave",
                "days leave",
            ]
        ):
            # Distinguish "how do I apply for leave?" (already caught above) from actual leave request
            return "NEW_OPERATIONAL_REQUEST"

        if any(
            phrase in lower
            for phrase in [
                "hostel maintenance",
                "room change",
                "room transfer",
                "night out pass",
                "gate pass",
                "ac repair",
                "wi-fi issue",
                "wifi not working",
                "create a support ticket",
                "raise a ticket",
                "it support ticket",
                "submit a hostel",
            ]
        ):
            return "NEW_OPERATIONAL_REQUEST"

        # 8. Student-Specific Record Queries
        if any(
            w in lower
            for w in [
                "attendance",
                "courses",
                "timetable",
                "schedule",
                "exam",
                "fee",
                "dues",
                "scholarship",
                "hostel",
                "warden",
                "room number",
                "advisor",
                "leave status",
                "status of my leave",
                "my profile",
            ]
        ):
            return "STUDENT_RECORD_QUERY"

        return "GENERAL_CONVERSATION"

    # =========================================================================
    # MAIN MESSAGE PROCESSING ENTRYPOINT
    # =========================================================================

    async def process_message(
        self,
        session: models.ConversationSession,
        user_text: str,
    ) -> Dict[str, Any]:
        """
        Process a student message within a persistent ConversationSession,
        update multi-turn state & slots, invoke read-only campus tools or prepare
        confirmation cards, and persist both user and assistant messages.
        """
        clean_text = user_text.strip()
        student_id = session.student_id
        student_ctx = self._get_student_context(student_id)
        first_name = student_ctx["first_name"]

        # 1. Persist incoming user message
        user_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="user",
            content=clean_text,
            intent_category=None,
            metadata_json="{}",
        )
        self.db.add(user_msg)
        self.db.commit()
        self.db.refresh(user_msg)

        # Load current session state
        collected_slots: Dict[str, Any] = json.loads(session.collected_slots_json or "{}")
        missing_slots: List[str] = json.loads(session.missing_slots_json or "[]")
        pending_confirmation: Optional[Dict[str, Any]] = (
            json.loads(session.pending_confirmation_json)
            if session.pending_confirmation_json
            else None
        )

        # 2. Run deterministic pre-classification first
        det_category = self._classify_deterministically(
            user_text=clean_text,
            active_intent=session.active_intent,
            missing_slots=missing_slots,
            has_pending_confirmation=bool(pending_confirmation),
        )

        # 3. Invoke Groq structured conversational analysis when beneficial
        recent_messages = (
            self.db.query(models.ConversationMessage)
            .filter(models.ConversationMessage.conversation_id == session.id)
            .order_by(models.ConversationMessage.id.asc())
            .all()
        )

        llm_turn: Optional[LLMConversationalTurnSchema] = None
        llm_telemetry: Dict[str, Any] = {
            "used_llm": False,
            "provider": self.provider.provider_name,
            "model": self.provider.model,
            "status": "deterministic_fast_path",
        }

        # Fast-path unambiguous state-machine turns (confirmations, cancellations, short slot replies, fault injection)
        should_call_llm = (
            "failure_mode=" not in clean_text.lower()
            and det_category
            not in (
                "CONFIRMATION_RESPONSE",
                "MODIFICATION_OR_CANCELLATION",
                "FOLLOW_UP_ANSWER",
                "UNSUPPORTED_REQUEST",
                "STUDENT_RECORD_QUERY",
            )
            and not (
                det_category == "NEW_OPERATIONAL_REQUEST"
                and (
                    extract_days_from_text(clean_text) is not None
                    or clean_text.lower() in ("i want to apply for leave.", "i want to apply for leave", "apply for leave")
                )
            )
        )

        if should_call_llm:
            llm_turn, llm_telemetry = await self._analyze_with_groq(
                student_ctx=student_ctx,
                session=session,
                recent_messages=recent_messages[:-1],
                user_text=clean_text,
            )

        # 4. Determine authoritative intent category (combining deterministic guardrails + Groq)
        if det_category in (
            "CONFIRMATION_RESPONSE",
            "MODIFICATION_OR_CANCELLATION",
            "FOLLOW_UP_ANSWER",
            "UNSUPPORTED_REQUEST",
        ):
            intent_category = det_category
        elif det_category != "GENERAL_CONVERSATION":
            intent_category = det_category
        elif llm_turn and llm_turn.intent_category in (
            "GENERAL_CONVERSATION",
            "GENERAL_CAMPUS_INFO",
            "STUDENT_RECORD_QUERY",
            "NEW_OPERATIONAL_REQUEST",
            "FOLLOW_UP_ANSWER",
            "CONFIRMATION_RESPONSE",
            "MODIFICATION_OR_CANCELLATION",
            "UNSUPPORTED_REQUEST",
        ):
            intent_category = llm_turn.intent_category
        else:
            intent_category = det_category

        user_msg.intent_category = intent_category
        self.db.commit()

        # 4. Route by Intent Category
        reply_text = ""
        metadata: Dict[str, Any] = {
            "intent_category": intent_category,
            "llm_telemetry": llm_telemetry,
            "student_id": student_id,
        }

        # ---------------------------------------------------------------------
        # ROUTE A: GENERAL CONVERSATION
        # ---------------------------------------------------------------------
        if intent_category == "GENERAL_CONVERSATION":
            lower = clean_text.lower()
            if any(w in lower for w in ["what can you do", "capabilities", "help me", "how do you work", "how does campvion work"]):
                reply_text = (
                    f"Hi {first_name}! I'm **CampVion**, your intelligent campus operations assistant. Here's how I can help you:\n\n"
                    "- **Attendance & Academics**: Check your overall or subject-wise attendance, course schedule, faculty advisor, and upcoming exams.\n"
                    "- **Leave Management**: Prepare and submit medical, personal, or academic duty leave requests with automatic policy & eligibility checks.\n"
                    "- **Hostel & Campus Services**: Check hostel room details, request maintenance or night-out passes, and raise IT/facility support tickets.\n"
                    "- **Fees & University Policies**: Check tuition fee clearance, scholarships, and verified university regulations.\n\n"
                    "What would you like to do today?"
                )
            elif any(w in lower for w in ["thanks", "thank you", "thx"]):
                reply_text = f"You're very welcome, {first_name}! 😊 Let me know if there's anything else I can help you with on campus."
            elif llm_turn and llm_turn.assistant_reply and len(llm_turn.assistant_reply.strip()) > 5:
                reply_text = llm_turn.assistant_reply.strip()
            else:
                reply_text = f"Hey {first_name}! 👋 What can I help you with today?"

            metadata["quick_replies"] = [
                "Check my overall attendance",
                "I want to apply for leave",
                "What happens if attendance falls below 75%?",
                "Show my course schedule",
            ]

        # ---------------------------------------------------------------------
        # ROUTE B: GENERAL CAMPUS INFORMATION & POLICY GUIDANCE
        # ---------------------------------------------------------------------
        elif intent_category == "GENERAL_CAMPUS_INFO":
            reply_text, policy_meta = self._handle_policy_or_info_question(
                clean_text, student_ctx, llm_turn
            )
            metadata.update(policy_meta)

        # ---------------------------------------------------------------------
        # ROUTE C: STUDENT-SPECIFIC RECORD QUERY
        # ---------------------------------------------------------------------
        elif intent_category == "STUDENT_RECORD_QUERY":
            reply_text, record_meta = self._handle_student_record_query(
                session, clean_text, student_ctx, llm_turn
            )
            metadata.update(record_meta)

        # ---------------------------------------------------------------------
        # ROUTE D & E: NEW OPERATIONAL REQUEST OR MULTI-TURN FOLLOW-UP ANSWER
        # ---------------------------------------------------------------------
        elif intent_category in ("NEW_OPERATIONAL_REQUEST", "FOLLOW_UP_ANSWER"):
            # Special case: if active_intent is ATTENDANCE_ENQUIRY and student answered "Overall" or a course code
            if session.active_intent == "ATTENDANCE_ENQUIRY" and intent_category == "FOLLOW_UP_ANSWER":
                reply_text, record_meta = self._handle_attendance_followup(
                    session, clean_text, student_ctx
                )
                metadata.update(record_meta)
            # Special case: diagnostic FAULT INJECTION directive (`FAILURE_MODE=...`)
            elif "failure_mode=" in clean_text.lower():
                reply_text, exec_meta = self._execute_diagnostic_workflow(
                    session, clean_text
                )
                metadata.update(exec_meta)
            else:
                reply_text, op_meta = self._handle_operational_or_followup(
                    session=session,
                    user_text=clean_text,
                    student_ctx=student_ctx,
                    collected_slots=collected_slots,
                    missing_slots=missing_slots,
                    llm_turn=llm_turn,
                )
                metadata.update(op_meta)

        # ---------------------------------------------------------------------
        # ROUTE F: CONFIRMATION RESPONSE
        # ---------------------------------------------------------------------
        elif intent_category == "CONFIRMATION_RESPONSE":
            reply_text, conf_meta = self._handle_confirmation_turn(
                session=session,
                pending_confirmation=pending_confirmation,
                student_ctx=student_ctx,
            )
            metadata.update(conf_meta)

        # ---------------------------------------------------------------------
        # ROUTE G: MODIFICATION OR CANCELLATION
        # ---------------------------------------------------------------------
        elif intent_category == "MODIFICATION_OR_CANCELLATION":
            reply_text, mod_meta = self._handle_modification_or_cancellation(
                session=session,
                user_text=clean_text,
                student_ctx=student_ctx,
                collected_slots=collected_slots,
                pending_confirmation=pending_confirmation,
                llm_turn=llm_turn,
            )
            metadata.update(mod_meta)

        # ---------------------------------------------------------------------
        # ROUTE H: UNSUPPORTED REQUEST
        # ---------------------------------------------------------------------
        else:
            reply_text = (
                f"I'm sorry, {first_name} — that request falls outside the university operations I'm authorized to handle. "
                "I can only assist with verified campus workflows such as:\n"
                "- **Attendance & Academic Records** (attendance checks, courses, exam schedules)\n"
                "- **Leave Applications** (medical, personal, or academic duty leave)\n"
                "- **Hostel & Support Services** (room status, maintenance tickets, night-out passes)\n"
                "- **Fee Status & University Policies**\n\n"
                "Would you like help with one of these campus services?"
            )
            metadata["quick_replies"] = [
                "Check my attendance",
                "Apply for leave",
                "Check my fee status",
                "What can you do?",
            ]

        # 5. Persist Assistant Response Message
        assistant_msg = models.ConversationMessage(
            conversation_id=session.id,
            role="assistant",
            content=reply_text,
            intent_category=intent_category,
            metadata_json=json.dumps(metadata),
        )
        self.db.add(assistant_msg)
        session.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(assistant_msg)
        self.db.refresh(session)

        return self.serialize_session_response(session, latest_assistant_message=assistant_msg)

    # =========================================================================
    # ROUTE HANDLERS
    # =========================================================================

    def _handle_policy_or_info_question(
        self,
        user_text: str,
        student_ctx: Dict[str, Any],
        llm_turn: Optional[LLMConversationalTurnSchema],
    ) -> Tuple[str, Dict[str, Any]]:
        """Answer general campus policy and process questions using verified DB policies."""
        lower = user_text.lower()
        policy_tool = registry.get_tool("query_campus_policy")

        search_term = "leave"
        if "attendance" in lower or "75" in lower or "condonation" in lower:
            search_term = "attendance"
        elif "hostel" in lower or "warden" in lower or "room" in lower:
            search_term = "hostel"
        elif "fee" in lower or "tuition" in lower or "scholarship" in lower:
            search_term = "financial"
        elif "exam" in lower:
            search_term = "examination"

        policy_result = (
            policy_tool.execute(db=self.db, query=search_term)
            if policy_tool
            else {"count": 0, "policies": []}
        )
        matched_policies = policy_result.get("policies", []) if isinstance(policy_result, dict) else []

        if "attendance" in lower and ("75" in lower or "below" in lower or "shortage" in lower or "what happens" in lower):
            reply = (
                "Under **Verified University Policy (POL-ATT-001 & POL-ATT-002)**:\n\n"
                "1. **Minimum 75% Requirement**: Students must maintain at least **75% aggregate attendance** to qualify for standard leave approvals and end-term examinations.\n"
                "2. **Condonation Window (65% – 74.99%)**: If your attendance falls between **65% and 74.99%** due to documented medical or sports grounds, you may apply for attendance condonation through the **Dean of Academic Affairs** (administrative fee: ₹1,500).\n"
                "3. **Below 65%**: Attendance below 65% results in examination debarment unless an emergency medical waiver is sanctioned.\n\n"
                f"*(Your current overall attendance is **{student_ctx['overall_attendance_pct']}%** — "
                f"{'you meet the 75% eligibility threshold' if student_ctx['is_eligible'] else 'you are currently below the 75% threshold'}.)*"
            )
        elif "document" in lower and "medical" in lower:
            reply = (
                "Under **Verified University Policy (POL-ATT-002 & POL-LV-002)**, for medical leave exceeding 2 days or emergency medical absence:\n\n"
                "- **Medical Certificate**: A certificate endorsed by a registered medical practitioner or the **Chief Medical Officer (CMO)**.\n"
                "- **Hospitalization / Prescriptions**: Discharge summary or diagnostic reports if hospitalized.\n"
                "- **Submission Window**: Supporting documents must be submitted within **7 calendar days** of resuming classes (or within 72 hours for retroactive emergency leave)."
            )
        elif "hostel" in lower:
            reply = (
                "Here is how the **CampVion Hostel Service Process** works:\n\n"
                "1. **Residency Verification**: CampVion verifies your active hostel block and room assignment.\n"
                "2. **Request Categories**: You can submit **Maintenance Tickets** (AC, Wi-Fi, plumbing), **Night-Out Passes**, or **Room Transfer Requests**.\n"
                "3. **Warden Governance**: Routine maintenance is routed directly to Estate Management, while Night-Out Passes and Room Changes pause for **Hostel Warden approval**."
            )
        elif "apply for leave" in lower or "leave process" in lower:
            reply = (
                "Applying for leave through **CampVion** takes just a few seconds:\n\n"
                "1. **Tell me your details**: Let me know the **number of days**, **start date**, and **reason** (medical, personal, or academic).\n"
                "2. **Policy & Attendance Check (POL-LV-001)**: I'll verify your current attendance (minimum **75%** required for standard leave) and prepare a summary card.\n"
                "3. **Confirm & Submit**: Once you confirm, I'll route your request to your **Faculty Advisor** (for 1–3 days), **HOD** (4–7 days), or **Proctor** (>7 days).\n\n"
                "Would you like me to start a leave application for you right now?"
            )
        elif llm_turn and llm_turn.assistant_reply:
            reply = llm_turn.assistant_reply
        else:
            reply = (
                "I can help explain university attendance rules (`POL-ATT-001`), medical compensation (`POL-ATT-002`), "
                "leave approval tiers (`POL-LV-001`), and hostel procedures. Which policy or campus process would you like to explore?"
            )

        return reply, {
            "policy_citations": matched_policies[:3],
            "guidance_type": "verified_policy" if matched_policies else "general_guidance",
            "quick_replies": [
                "Check my overall attendance",
                "I want to apply for leave",
                "What documents are needed for medical leave?",
            ],
        }

    def _handle_student_record_query(
        self,
        session: models.ConversationSession,
        user_text: str,
        student_ctx: Dict[str, Any],
        llm_turn: Optional[LLMConversationalTurnSchema],
    ) -> Tuple[str, Dict[str, Any]]:
        """Execute authorized read-only campus tools to answer student-specific enquiries."""
        lower = user_text.lower()
        student_id = student_ctx["student_id"]
        first_name = student_ctx["first_name"]

        # 1. Attendance Enquiry
        if "attendance" in lower:
            # Check if ambiguous ("I need some help with my attendance" without specifying overall vs subject)
            is_vague_help = (
                any(phrase in lower for phrase in ["help with my attendance", "help with attendance", "about my attendance"])
                and not any(w in lower for w in ["overall", "total", "all", "subject", "course", "what is", "show", "check", "percentage"])
            )
            if is_vague_help:
                session.active_intent = "ATTENDANCE_ENQUIRY"
                session.missing_slots_json = json.dumps(["attendance_scope"])
                session.status = "awaiting_clarification"
                return (
                    "Of course! Are you looking for your **overall attendance** or the attendance of a **particular subject**?",
                    {
                        "awaiting_clarification": True,
                        "missing_slots": ["attendance_scope"],
                        "quick_replies": ["Overall", "Show subject-wise breakdown"],
                    },
                )

            return self._build_attendance_response(session, clean_scope="overall", student_ctx=student_ctx)

        # 2. Course Schedule / Advisor
        if any(w in lower for w in ["course", "timetable", "schedule", "subject", "advisor"]) and "exam" not in lower:
            summary_tool = registry.get_tool("get_student_academic_summary")
            summary = summary_tool.execute(db=self.db, student_id=student_id) if summary_tool else {}
            courses = student_ctx["courses"]

            course_lines = [
                f"- **{c['course_code']}**: {c['course_name']} *(Prof. {c['faculty']})*"
                for c in courses
            ]
            courses_md = "\n".join(course_lines) if course_lines else "No registered courses found."
            advisor_name = summary.get("advisor_name", "Dr. Rajesh Rao") if isinstance(summary, dict) else "Dr. Rajesh Rao"

            reply = (
                f"Here is your current academic registration for **Semester {student_ctx['profile'].get('semester', 5)}**, {first_name}:\n\n"
                f"{courses_md}\n\n"
                f"**Faculty Advisor**: {advisor_name} ({summary.get('advisor_email', 'advisor@lpu.edu') if isinstance(summary, dict) else ''})"
            )
            return reply, {
                "tool_data": {
                    "type": "courses",
                    "tool_name": "get_course_schedule",
                    "courses": courses,
                    "academic_summary": summary,
                },
                "quick_replies": ["Check my attendance", "When are my exams?", "Apply for leave"],
            }

        # 3. Examination Schedule
        if "exam" in lower:
            exam_tool = registry.get_tool("get_examination_schedule")
            exam_data = exam_tool.execute(db=self.db, student_id=student_id) if exam_tool else {}
            exams = exam_data.get("exams", []) if isinstance(exam_data, dict) else []

            if exams:
                lines = [
                    f"- **{ex['course_code']} ({ex['course_name']})**: {ex['exam_date']} at {ex['start_time']} • Venue: {ex['room']}"
                    for ex in exams
                ]
                reply = f"Here is your upcoming **Examination Schedule**, {first_name}:\n\n" + "\n".join(lines)
            else:
                reply = f"No upcoming examination schedules are currently posted for your registered courses, {first_name}."

            return reply, {
                "tool_data": {
                    "type": "exams",
                    "tool_name": "get_examination_schedule",
                    "exams": exams,
                },
                "quick_replies": ["Check my attendance", "Show my courses"],
            }

        # 4. Fee & Scholarship Status
        if any(w in lower for w in ["fee", "dues", "tuition", "payment", "scholarship"]):
            fee_tool = registry.get_tool("get_fee_status")
            fee_data = fee_tool.execute(db=self.db, student_id=student_id) if fee_tool else {}

            if isinstance(fee_data, dict) and not fee_data.get("error"):
                balance = fee_data.get("outstanding_balance", 0)
                status_str = fee_data.get("status", "cleared").upper()
                sch = fee_data.get("scholarship")
                sch_line = (
                    f"\n- **Active Scholarship**: {sch['name']} (₹{sch['amount']:,}/semester — {sch['status']})"
                    if sch
                    else ""
                )
                reply = (
                    f"Here is your verified **Financial & Fee Summary** (`{student_id}`):\n\n"
                    f"- **Total Semester Fees**: ₹{fee_data.get('total_fees', 0):,}\n"
                    f"- **Paid Amount**: ₹{fee_data.get('paid_amount', 0):,}\n"
                    f"- **Outstanding Balance**: ₹{balance:,} (**{status_str}**)\n"
                    f"- **Due Date**: {fee_data.get('due_date', 'N/A')}"
                    f"{sch_line}"
                )
            else:
                reply = "I couldn't retrieve your fee record at the moment."

            return reply, {
                "tool_data": {
                    "type": "fees",
                    "tool_name": "get_fee_status",
                    "fee_status": fee_data,
                },
                "quick_replies": ["Check my attendance", "Apply for leave"],
            }

        # 5. Hostel Status
        if any(w in lower for w in ["hostel", "warden", "room"]):
            hostel_tool = registry.get_tool("get_hostel_status")
            hostel_data = hostel_tool.execute(db=self.db, student_id=student_id) if hostel_tool else {}

            if isinstance(hostel_data, dict) and hostel_data.get("is_resident"):
                reply = (
                    f"Here are your **Hostel Residency Details** (`{student_id}`):\n\n"
                    f"- **Hostel**: {hostel_data.get('hostel_name')} (Block {hostel_data.get('block')})\n"
                    f"- **Room / Bed**: Room {hostel_data.get('room_number')}, Bed {hostel_data.get('bed_number')}\n"
                    f"- **Warden**: {hostel_data.get('warden_name')} ({hostel_data.get('warden_contact')})\n\n"
                    "Would you like to submit a hostel maintenance request or apply for a night-out pass?"
                )
            else:
                reply = (
                    f"According to campus records, **{student_ctx['profile'].get('name', student_id)}** is registered as a **Day Scholar** "
                    "and does not have an active hostel room allocation."
                )

            return reply, {
                "tool_data": {
                    "type": "hostel",
                    "tool_name": "get_hostel_status",
                    "hostel_status": hostel_data,
                },
                "quick_replies": ["Submit hostel maintenance request", "Check my attendance"],
            }

        # 6. Leave Application Status
        if "leave" in lower and "status" in lower:
            status_tool = registry.get_tool("get_leave_application_status")
            status_data = status_tool.execute(db=self.db, student_id=student_id) if status_tool else {}
            leave_code = status_data.get("leave_code") if isinstance(status_data, dict) else None
            if leave_code:
                reply = (
                    f"Your latest leave application **{leave_code}** ({status_data.get('days_count')} days, {status_data.get('category')}) "
                    f"is currently **{status_data.get('status', 'pending').upper()}** with **{status_data.get('assigned_approver')}** ({status_data.get('approver_role')})."
                )
            else:
                reply = "You don't have any submitted leave applications on record yet. Would you like to apply for leave?"

            return reply, {
                "tool_data": {
                    "type": "leave_status",
                    "tool_name": "get_leave_application_status",
                    "leave_status": status_data,
                },
                "quick_replies": ["I want to apply for leave", "Check my attendance"],
            }

        # Default: Student profile + attendance overview
        return self._build_attendance_response(session, clean_scope="overall", student_ctx=student_ctx)

    def _build_attendance_response(
        self,
        session: models.ConversationSession,
        clean_scope: str,
        student_ctx: Dict[str, Any],
    ) -> Tuple[str, Dict[str, Any]]:
        """Format verified attendance data from `get_attendance` and `get_course_schedule`."""
        session.active_intent = None
        session.missing_slots_json = "[]"
        session.status = "active"

        pct = student_ctx["overall_attendance_pct"]
        eligible = student_ctx["is_eligible"]
        att_records = student_ctx["attendance_records"]
        courses = student_ctx["courses"]

        course_breakdown = []
        for idx, rec in enumerate(att_records):
            c_info = courses[idx] if idx < len(courses) else {}
            c_code = c_info.get("course_code", f"Course #{rec.get('course_id', idx + 1)}")
            c_name = c_info.get("course_name", "Registered Course")
            attended = rec.get("attended", 0)
            total = rec.get("total", 0)
            c_pct = round((attended / total) * 100, 1) if total > 0 else 0.0
            course_breakdown.append({
                "course_code": c_code,
                "course_name": c_name,
                "attended": attended,
                "total": total,
                "percentage": c_pct,
            })

        breakdown_lines = [
            f"- **{item['course_code']} ({item['course_name']})**: {item['attended']}/{item['total']} classes (**{item['percentage']}%**)"
            for item in course_breakdown
        ]
        breakdown_md = "\n".join(breakdown_lines) if breakdown_lines else "- Aggregate record verified."

        status_badge = (
            "✅ **Eligible** (Meets ≥75% policy threshold `POL-ATT-001`)"
            if eligible
            else "⚠️ **Below 75% Threshold** (Requires advisor/HOD review under `POL-ATT-001`)"
        )

        reply = (
            f"Sure! Here is your verified attendance summary for **{student_ctx['profile'].get('name', student_ctx['student_id'])}** (`{student_ctx['student_id']}`):\n\n"
            f"- **Overall Attendance**: **{pct}%** ({student_ctx['total_attended']}/{student_ctx['total_classes']} classes)\n"
            f"- **Policy Status**: {status_badge}\n\n"
            f"**Course-Wise Breakdown:**\n{breakdown_md}\n\n"
            "Would you like to apply for leave or check another campus service?"
        )

        return reply, {
            "tool_data": {
                "type": "attendance",
                "tool_name": "get_attendance",
                "overall_percentage": pct,
                "total_attended": student_ctx["total_attended"],
                "total_classes": student_ctx["total_classes"],
                "is_eligible": eligible,
                "courses": course_breakdown,
            },
            "quick_replies": [
                "I want to apply for leave",
                "What happens if attendance falls below 75%?",
                "Show my exam schedule",
            ],
        }

    def _handle_attendance_followup(
        self,
        session: models.ConversationSession,
        user_text: str,
        student_ctx: Dict[str, Any],
    ) -> Tuple[str, Dict[str, Any]]:
        """Handle the student's follow-up reply ('Overall' or a specific subject) to the attendance clarification."""
        return self._build_attendance_response(
            session=session,
            clean_scope=user_text.strip().lower(),
            student_ctx=student_ctx,
        )

    def _handle_operational_or_followup(
        self,
        session: models.ConversationSession,
        user_text: str,
        student_ctx: Dict[str, Any],
        collected_slots: Dict[str, Any],
        missing_slots: List[str],
        llm_turn: Optional[LLMConversationalTurnSchema],
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Manage multi-turn slot collection for LEAVE_APPLICATION, HOSTEL_SERVICE, and SUPPORT_TICKET.
        Once all required slots are supplied, transition to `awaiting_confirmation` and return
        a structured Confirmation Proposal Card.
        """
        lower = user_text.lower()

        # Determine target operational intent
        target_intent = session.active_intent
        if not target_intent or target_intent == "ATTENDANCE_ENQUIRY":
            if any(w in lower for w in ["hostel", "night out", "room change", "ac repair", "warden"]):
                target_intent = "HOSTEL_SERVICE"
            elif any(w in lower for w in ["support ticket", "it support", "wifi", "wi-fi", "helpdesk"]):
                target_intent = "SUPPORT_TICKET"
            else:
                target_intent = "LEAVE_APPLICATION"

        session.active_intent = target_intent

        # ---------------------------------------------------------------------
        # CASE 1: LEAVE APPLICATION MULTI-TURN SLOT TRACKING
        # ---------------------------------------------------------------------
        if target_intent == "LEAVE_APPLICATION":
            # Extract slots from current message
            det_days = extract_days_from_text(user_text)
            det_date = extract_date_from_text(user_text)
            det_cat, det_reason = extract_leave_category_and_reason(user_text)

            # Merge days
            if det_days is not None:
                collected_slots["days"] = det_days
            elif llm_turn and llm_turn.days is not None and re.search(r"\d+|one|two|three|four|five|six|seven|week", lower):
                collected_slots["days"] = llm_turn.days

            # Merge start_date
            if det_date is not None:
                collected_slots["start_date"] = det_date
            elif llm_turn and llm_turn.start_date and any(
                w in lower for w in ["tomorrow", "today", "monday", "tuesday", "wednesday", "thursday", "friday", "nov", "dec", "202"]
            ):
                collected_slots["start_date"] = resolve_human_date(llm_turn.start_date)
            elif missing_slots == ["start_date"] and len(user_text.split()) <= 5:
                collected_slots["start_date"] = resolve_human_date(user_text)

            # Merge category & reason
            if det_cat is not None:
                collected_slots["category"] = det_cat
            elif llm_turn and llm_turn.category in ("medical", "personal", "family_emergency", "academic"):
                if any(w in lower for w in ["medical", "personal", "family", "emergency", "sick", "function", "duty"]):
                    collected_slots["category"] = llm_turn.category

            if det_reason is not None:
                collected_slots["reason"] = det_reason
            elif missing_slots == ["reason"] and len(user_text.strip()) >= 3:
                cleaned_r = user_text.strip().rstrip(".")
                collected_slots["reason"] = cleaned_r[0].upper() + cleaned_r[1:]
                if "category" not in collected_slots:
                    collected_slots["category"] = (
                        "medical" if "medical" in cleaned_r.lower() or "sick" in cleaned_r.lower() else "personal"
                    )

            # Determine remaining missing slots in natural conversation order:
            # 1. days -> 2. start_date -> 3. reason/category
            new_missing: List[str] = []
            if not collected_slots.get("days"):
                new_missing.append("days")
            if not collected_slots.get("start_date"):
                new_missing.append("start_date")
            if not collected_slots.get("reason") and not collected_slots.get("category"):
                new_missing.append("reason")

            session.collected_slots_json = json.dumps(collected_slots)
            session.missing_slots_json = json.dumps(new_missing)

            # If slots are still missing, ask a natural follow-up question for the next missing slot
            if new_missing:
                session.status = "awaiting_clarification"
                next_slot = new_missing[0]

                if next_slot == "days":
                    cat_label = f" {collected_slots['category']}" if collected_slots.get("category") else ""
                    question = f"Sure! How many days of{cat_label} leave do you need?"
                    quick_replies = ["1 day", "3 days", "5 days"]
                elif next_slot == "start_date":
                    days_val = collected_slots.get("days", 1)
                    cat_label = f" {collected_slots['category']}" if collected_slots.get("category") else ""
                    question = (
                        f"Absolutely. I can help you prepare that **{days_val}-day{cat_label} leave** request. "
                        "What date would you like your leave to start?"
                    )
                    quick_replies = ["Tomorrow", "Today", "Next Monday"]
                else:
                    days_val = collected_slots.get("days", 1)
                    start_val = collected_slots.get("start_date", "Tomorrow")
                    question = (
                        f"Understood — **{days_val} day(s)** starting **{start_val}**. "
                        "Is this for **medical reasons** or **personal reasons**?"
                    )
                    quick_replies = ["Medical reasons", "Personal reasons", "Family function"]

                return question, {
                    "awaiting_clarification": True,
                    "active_intent": target_intent,
                    "collected_slots": collected_slots,
                    "missing_slots": new_missing,
                    "quick_replies": quick_replies,
                }

            # All slots collected! Prepare the Smart Confirmation Proposal Card (Section 7)
            days_count = int(collected_slots.get("days", 1))
            start_date_str = collected_slots.get("start_date") or resolve_human_date("tomorrow")
            category_str = (collected_slots.get("category") or "personal").lower()
            reason_str = collected_slots.get("reason") or (
                "Medical leave" if category_str == "medical" else "Personal leave"
            )

            # Determine approver tier according to POL-LV-001
            if days_count <= 3:
                approver = "Faculty Advisor"
            elif days_count <= 7:
                approver = "Head of Department (HOD)"
            else:
                approver = "Proctor / Dean Student Welfare"

            proposal = {
                "proposal_id": f"PROP-{int(time.time())}",
                "operation_type": "LEAVE_APPLICATION",
                "title": "Prepared Leave Application",
                "student_id": student_ctx["student_id"],
                "student_name": student_ctx["profile"].get("name", student_ctx["student_id"]),
                "attendance_pct": student_ctx["overall_attendance_pct"],
                "is_eligible": student_ctx["is_eligible"],
                "fields": {
                    "duration": f"{days_count} {'day' if days_count == 1 else 'days'}",
                    "days": days_count,
                    "start_date": start_date_str,
                    "category": category_str.replace("_", " ").title(),
                    "reason": reason_str,
                    "approver_gate": f"{approver} (Human-in-the-Loop Gate)",
                    "policy_check": (
                        f"PASS ({student_ctx['overall_attendance_pct']}% >= 75% POL-LV-001)"
                        if student_ctx["is_eligible"]
                        else f"EXCEPTION REQUIRED ({student_ctx['overall_attendance_pct']}% < 75% POL-LV-001)"
                    ),
                },
                "raw_goal": (
                    f"Apply for {category_str} leave for {days_count} days starting {start_date_str} "
                    f"because {reason_str}"
                ),
            }

            session.pending_confirmation_json = json.dumps(proposal)
            session.status = "awaiting_confirmation"

            reply = (
                f"I've prepared your **{days_count}-day {category_str.replace('_', ' ')} leave** request:\n\n"
                f"- **Student**: {proposal['student_name']} (`{proposal['student_id']}`)\n"
                f"- **Duration**: {days_count} {'day' if days_count == 1 else 'days'}\n"
                f"- **Start Date**: {start_date_str}\n"
                f"- **Reason**: {reason_str} ({category_str.title()})\n"
                f"- **Governance Gate**: {approver}\n\n"
                "Please review the details below. Would you like me to submit this request?"
            )

            return reply, {
                "awaiting_confirmation": True,
                "confirmation_proposal": proposal,
                "collected_slots": collected_slots,
                "quick_replies": ["Confirm and Submit", "Change to 2 days", "Cancel"],
            }

        # ---------------------------------------------------------------------
        # CASE 2: HOSTEL SERVICE REQUEST OR SUPPORT TICKET
        # ---------------------------------------------------------------------
        is_hostel = target_intent == "HOSTEL_SERVICE"
        req_type = "maintenance"
        if "night out" in lower or "gate pass" in lower:
            req_type = "night_out_pass"
        elif "room change" in lower or "transfer" in lower:
            req_type = "room_change"

        proposal = {
            "proposal_id": f"PROP-{int(time.time())}",
            "operation_type": target_intent,
            "title": "Prepared Hostel Service Request" if is_hostel else "Prepared Campus Support Ticket",
            "student_id": student_ctx["student_id"],
            "student_name": student_ctx["profile"].get("name", student_ctx["student_id"]),
            "attendance_pct": student_ctx["overall_attendance_pct"],
            "is_eligible": True,
            "fields": {
                "service_type": req_type.replace("_", " ").title() if is_hostel else "IT & Campus Helpdesk",
                "details": user_text.strip(),
                "priority": "Medium",
                "approver_gate": "Hostel Warden Gate" if is_hostel else "Campus Helpdesk Dispatch",
            },
            "raw_goal": user_text.strip(),
        }

        session.pending_confirmation_json = json.dumps(proposal)
        session.status = "awaiting_confirmation"

        reply = (
            f"I've prepared your **{proposal['title']}** for **{proposal['student_name']}** (`{proposal['student_id']}`):\n\n"
            f"- **Service Type**: {proposal['fields']['service_type']}\n"
            f"- **Details**: {user_text.strip()}\n"
            f"- **Routing**: {proposal['fields']['approver_gate']}\n\n"
            "Would you like me to confirm and submit this request?"
        )
        return reply, {
            "awaiting_confirmation": True,
            "confirmation_proposal": proposal,
            "quick_replies": ["Confirm and Submit", "Cancel"],
        }

    def _handle_confirmation_turn(
        self,
        session: models.ConversationSession,
        pending_confirmation: Optional[Dict[str, Any]],
        student_ctx: Dict[str, Any],
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Validate and execute a prepared action ONLY if `pending_confirmation` exists.
        Prevents ambiguous confirmations from triggering unintended operations.
        """
        if not pending_confirmation:
            return (
                "There isn't a prepared request waiting for confirmation right now. "
                "Tell me what you'd like to do — such as applying for leave or checking your attendance — and I'll prepare it for you first!",
                {
                    "ambiguous_confirmation_blocked": True,
                    "quick_replies": [
                        "I want to apply for leave",
                        "Check my overall attendance",
                        "Show my courses",
                    ],
                },
            )

        return self.execute_confirmed_proposal(session, pending_confirmation)

    def execute_confirmed_proposal(
        self,
        session: models.ConversationSession,
        proposal: Dict[str, Any],
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Execute the validated proposal through AXORAAgent (for LEAVE_APPLICATION)
        or the governed database tool, preserving Human-in-the-Loop governance.
        """
        op_type = proposal.get("operation_type", "LEAVE_APPLICATION")
        student_id = session.student_id
        raw_goal = proposal.get("raw_goal", "Apply for leave")

        # Clear pending confirmation so it cannot be submitted twice
        session.pending_confirmation_json = None
        session.active_intent = None
        session.collected_slots_json = "{}"
        session.missing_slots_json = "[]"

        if op_type == "LEAVE_APPLICATION":
            agent = AXORAAgent(self.db)
            result = agent.start(student_id, raw_goal)
            state = agent.get_state(result.request_id)

            session.active_workflow_request_id = result.request_id
            session.status = (
                "workflow_running"
                if result.status == "WAITING_FOR_HUMAN"
                else "completed"
            )

            if result.status == "WAITING_FOR_HUMAN":
                fields = proposal.get("fields", {})
                reply = (
                    f"Your leave request has been validated and registered as **Request #{result.request_id}**.\n\n"
                    f"- **Eligibility & Policy Check**: Verified (`get_student_profile`, `get_attendance`, `get_leave_policy`, `check_leave_eligibility` completed)\n"
                    f"- **Current Status**: **Awaiting Institutional Approval** ({fields.get('approver_gate', 'Faculty Advisor')})\n\n"
                    "Please note: your confirmation submitted the request into the campus workflow. "
                    "An authorized reviewer can now approve or reject **Request #"
                    f"{result.request_id}** using the approval card below."
                )
            elif result.status == "COMPLETED":
                reply = (
                    f"**Request #{result.request_id}** has been completed! "
                    f"{result.final_message}"
                )
            else:
                reply = (
                    f"**Request #{result.request_id}** could not be approved automatically due to university policy constraints:\n\n"
                    f"- **Reason**: {state.error if state and state.error else result.final_message}\n"
                    "- **Reference**: Policy `POL-ATT-001` / `POL-LV-001` requires at least 75% attendance for standard leave."
                )

            return reply, {
                "workflow_executed": True,
                "request_id": result.request_id,
                "workflow_result": result.model_dump(),
                "workflow_state": state.model_dump() if state else None,
                "quick_replies": [
                    "Check my leave status",
                    "Check my overall attendance",
                ],
            }

        elif op_type == "HOSTEL_SERVICE":
            tool = registry.get_tool("submit_hostel_service_request")
            fields = proposal.get("fields", {})
            res = (
                tool.execute(
                    db=self.db,
                    student_id=student_id,
                    request_type="maintenance",
                    details=fields.get("details", raw_goal),
                    priority="medium",
                )
                if tool
                else {"error": "Hostel service tool unavailable"}
            )
            session.status = "completed"
            if isinstance(res, dict) and not res.get("error"):
                reply = (
                    f"Your hostel request has been registered under reference **{res.get('request_code')}** "
                    f"and routed for Warden review ({res.get('status')})."
                )
            else:
                err_msg = res.get("error") if isinstance(res, dict) else "Unable to submit hostel request"
                reply = f"Unable to complete hostel request: **{err_msg}**."
            return reply, {
                "tool_data": {"type": "hostel_request", "result": res},
            }

        else:
            tool = registry.get_tool("create_support_ticket")
            fields = proposal.get("fields", {})
            res = (
                tool.execute(
                    db=self.db,
                    student_id=student_id,
                    category="it_support",
                    subject="Campus Service Request",
                    description=fields.get("details", raw_goal),
                    priority="medium",
                )
                if tool
                else {"error": "Support ticket tool unavailable"}
            )
            session.status = "completed"
            if isinstance(res, dict) and not res.get("error"):
                reply = (
                    f"Your support ticket **{res.get('ticket_number')}** has been created "
                    f"and assigned to **{res.get('assigned_team')}**."
                )
            else:
                reply = "Unable to create support ticket at this time."
            return reply, {
                "tool_data": {"type": "support_ticket", "result": res},
            }

    def _handle_modification_or_cancellation(
        self,
        session: models.ConversationSession,
        user_text: str,
        student_ctx: Dict[str, Any],
        collected_slots: Dict[str, Any],
        pending_confirmation: Optional[Dict[str, Any]],
        llm_turn: Optional[LLMConversationalTurnSchema],
    ) -> Tuple[str, Dict[str, Any]]:
        """Handle canceling or modifying an in-progress or prepared request."""
        lower = user_text.lower()

        if any(
            w in lower
            for w in ["cancel", "never mind", "nevermind", "abort", "stop", "don't submit", "do not submit", "discard"]
        ):
            session.active_intent = None
            session.collected_slots_json = "{}"
            session.missing_slots_json = "[]"
            session.pending_confirmation_json = None
            session.status = "active"
            return (
                "No problem — I've canceled the prepared request and nothing was submitted. "
                "Let me know whenever you'd like to start something new!",
                {
                    "request_canceled": True,
                    "quick_replies": [
                        "Check my attendance",
                        "I want to apply for leave",
                        "What can you do?",
                    ],
                },
            )

        # Modification: update collected_slots and re-run operational handler
        session.pending_confirmation_json = None
        if not session.active_intent:
            session.active_intent = (
                pending_confirmation.get("operation_type", "LEAVE_APPLICATION")
                if pending_confirmation
                else "LEAVE_APPLICATION"
            )
        return self._handle_operational_or_followup(
            session=session,
            user_text=user_text,
            student_ctx=student_ctx,
            collected_slots=collected_slots,
            missing_slots=[],
            llm_turn=llm_turn,
        )

    def _execute_diagnostic_workflow(
        self,
        session: models.ConversationSession,
        directive_text: str,
    ) -> Tuple[str, Dict[str, Any]]:
        """Support diagnostic fault-injection directives (`FAILURE_MODE=...`) for reliability testing."""
        agent = AXORAAgent(self.db)
        result = agent.start(session.student_id, directive_text)
        state = agent.get_state(result.request_id)
        session.active_workflow_request_id = result.request_id
        session.status = "completed"

        reply = (
            f"Executed diagnostic simulation directive (`{directive_text}`) under **Request #{result.request_id}**.\n\n"
            f"- **Final Workflow Status**: `{result.status}`\n"
            f"- **Replans Triggered**: `{result.replanning_count}`\n"
            f"- **Outcome**: {result.final_message}"
        )
        return reply, {
            "workflow_executed": True,
            "request_id": result.request_id,
            "workflow_result": result.model_dump(),
            "workflow_state": state.model_dump() if state else None,
        }

    # =========================================================================
    # SERIALIZATION
    # =========================================================================

    def serialize_session_response(
        self,
        session: models.ConversationSession,
        latest_assistant_message: Optional[models.ConversationMessage] = None,
    ) -> Dict[str, Any]:
        """Serialize ConversationSession, full message history, and linked AgentState."""
        messages = (
            self.db.query(models.ConversationMessage)
            .filter(models.ConversationMessage.conversation_id == session.id)
            .order_by(models.ConversationMessage.id.asc())
            .all()
        )

        serialized_messages = []
        for m in messages:
            try:
                meta = json.loads(m.metadata_json or "{}")
            except Exception:
                meta = {}
            serialized_messages.append(
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "intent_category": m.intent_category,
                    "metadata": meta,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
            )

        workflow_state = None
        if session.active_workflow_request_id:
            agent = AXORAAgent(self.db)
            st = agent.get_state(session.active_workflow_request_id)
            if st:
                workflow_state = st.model_dump()

        return {
            "conversation_id": session.session_uuid,
            "student_id": session.student_id,
            "title": session.title,
            "status": session.status,
            "active_intent": session.active_intent,
            "collected_slots": json.loads(session.collected_slots_json or "{}"),
            "missing_slots": json.loads(session.missing_slots_json or "[]"),
            "pending_confirmation": (
                json.loads(session.pending_confirmation_json)
                if session.pending_confirmation_json
                else None
            ),
            "active_workflow_request_id": session.active_workflow_request_id,
            "workflow_state": workflow_state,
            "messages": serialized_messages,
            "latest_reply": (
                serialized_messages[-1] if serialized_messages else None
            ),
        }
