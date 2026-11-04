"""
CampVion Phase 4 — Conversational Agentic AI Assistant Test Suite
Tests all 13 conversational scenarios, multi-turn slot retention, smart confirmation
enforcement, ambiguous confirmation blocking, student authorization & isolation,
and Human-in-the-Loop governance integration.
"""

import pytest
from app.db import models


def test_1_greeting_and_2_general_question(client):
    """Test 1 (Greeting) & Test 2 (General question) do not trigger DAG workflows."""
    res1 = client.post(
        "/api/conversations/message",
        json={"student_id": "S001", "message": "Hey CampVion!"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    conv_id = data1["conversation_id"]
    assert data1["latest_reply"]["intent_category"] == "GENERAL_CONVERSATION"
    assert "Alice" in data1["latest_reply"]["content"] or "help" in data1["latest_reply"]["content"].lower()
    assert data1["active_workflow_request_id"] is None

    res2 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "What can you do?"},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["latest_reply"]["intent_category"] == "GENERAL_CONVERSATION"
    assert "Attendance" in data2["latest_reply"]["content"]
    assert len(data2["messages"]) == 4  # 2 user + 2 assistant


def test_3_campus_policy_question(client):
    """Test 3: Campus policy question retrieves verified policy citations from database."""
    res = client.post(
        "/api/conversations/message",
        json={
            "student_id": "S001",
            "message": "What happens if my attendance falls below 75%?",
        },
    )
    assert res.status_code == 200
    data = res.json()
    reply = data["latest_reply"]
    assert reply["intent_category"] == "GENERAL_CAMPUS_INFO"
    assert "POL-ATT-001" in reply["content"]
    assert "75%" in reply["content"]
    assert len(reply["metadata"].get("policy_citations", [])) >= 1


def test_4_attendance_enquiry_and_followup(client):
    """
    Test 4: Attendance enquiry with clarification follow-up:
    'I need some help with my attendance.' -> asks overall vs subject -> 'Overall.' -> retrieves real DB attendance.
    """
    res1 = client.post(
        "/api/conversations/message",
        json={"student_id": "S001", "message": "I need some help with my attendance."},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    conv_id = data1["conversation_id"]
    assert data1["status"] == "awaiting_clarification"
    assert "overall" in data1["latest_reply"]["content"].lower()

    res2 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "Overall."},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    reply2 = data2["latest_reply"]
    assert reply2["metadata"]["tool_data"]["type"] == "attendance"
    assert reply2["metadata"]["tool_data"]["overall_percentage"] >= 75.0
    assert "75" in reply2["content"] or "%" in reply2["content"]


def test_5_to_11_multiturn_leave_context_modify_cancel_and_confirm(client):
    """
    Tests 5, 6, 7, 8, 9, 10, 11:
    - Multi-turn leave slot filling ('I want to apply for leave' -> 'Three days' -> 'Tomorrow' -> 'Medical reasons')
    - Context retention across turns
    - Request modification ('Change it to 2 days')
    - Confirmation ('Confirm and Submit') -> triggers AXORAAgent and pauses at WAITING_FOR_HUMAN
    - Request cancellation on a second prepared request
    """
    # Turn 1: Initiate leave without details (Tests 5 & 6: Missing information)
    r1 = client.post(
        "/api/conversations/message",
        json={"student_id": "S001", "message": "I want to apply for leave."},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert d1["status"] == "awaiting_clarification"
    assert "days" in d1["missing_slots"]
    assert "how many days" in d1["latest_reply"]["content"].lower()

    # Turn 2: Supply duration (Tests 7 & 8: Follow-up answer & context retention)
    r2 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "Three days."},
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["collected_slots"]["days"] == 3
    assert "start_date" in d2["missing_slots"]
    assert "date" in d2["latest_reply"]["content"].lower() or "start" in d2["latest_reply"]["content"].lower()

    # Turn 3: Supply start date
    r3 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "Tomorrow."},
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["collected_slots"]["days"] == 3
    assert "Tomorrow" in d3["collected_slots"]["start_date"]
    assert "reason" in d3["missing_slots"]
    assert "medical" in d3["latest_reply"]["content"].lower() or "personal" in d3["latest_reply"]["content"].lower()

    # Turn 4: Supply reason -> All slots complete -> Awaiting Confirmation Card!
    r4 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "Medical reasons."},
    )
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["status"] == "awaiting_confirmation"
    assert d4["pending_confirmation"] is not None
    assert d4["pending_confirmation"]["fields"]["days"] == 3
    assert d4["pending_confirmation"]["fields"]["category"] == "Medical"
    assert d4["active_workflow_request_id"] is None  # Not yet submitted!

    # Turn 5: Modify prepared request (Test 9: Request modification)
    r5 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "Change it to 2 days"},
    )
    assert r5.status_code == 200
    d5 = r5.json()
    assert d5["status"] == "awaiting_confirmation"
    assert d5["pending_confirmation"]["fields"]["days"] == 2

    # Turn 6: Confirm prepared request (Test 11: Confirmation -> Governed Execution)
    r6 = client.post(
        f"/api/conversations/{conv_id}/confirm",
        json={"action": "confirm"},
    )
    assert r6.status_code == 200
    d6 = r6.json()
    assert d6["pending_confirmation"] is None
    assert d6["active_workflow_request_id"] is not None
    assert d6["workflow_state"]["current_status"] == "WAITING_FOR_HUMAN"
    assert d6["workflow_state"]["human_approval_status"] == "PENDING"
    assert f"Request #{d6['active_workflow_request_id']}" in d6["latest_reply"]["content"]

    # Turn 7: Start another request and Cancel it (Test 10: Request cancellation)
    r7 = client.post(
        "/api/conversations/message",
        json={
            "conversation_id": conv_id,
            "student_id": "S001",
            "message": "Apply for personal leave for 2 days starting tomorrow because of family function",
        },
    )
    assert r7.status_code == 200
    assert r7.json()["status"] == "awaiting_confirmation"

    r8 = client.post(
        "/api/conversations/message",
        json={"conversation_id": conv_id, "student_id": "S001", "message": "Cancel"},
    )
    assert r8.status_code == 200
    d8 = r8.json()
    assert d8["pending_confirmation"] is None
    assert d8["latest_reply"]["metadata"].get("request_canceled") is True


def test_12_ambiguous_confirmation_blocked(client):
    """
    Test 12: Sending 'Yes, submit it' when no prepared action exists must NOT
    trigger any workflow or database modification.
    """
    res = client.post(
        "/api/conversations/message",
        json={"student_id": "S001", "message": "Yes, submit it"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["active_workflow_request_id"] is None
    assert data["latest_reply"]["metadata"].get("ambiguous_confirmation_blocked") is True


def test_13_unsupported_request(client):
    """Test 13: Requests outside university operations are politely declined."""
    res = client.post(
        "/api/conversations/message",
        json={"student_id": "S001", "message": "Can you order me a pepperoni pizza?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["latest_reply"]["intent_category"] == "UNSUPPORTED_REQUEST"
    assert data["active_workflow_request_id"] is None


def test_14_student_authorization_and_strict_isolation(client):
    """
    Verify that in strict student isolation mode (X-Strict-Student-Isolation: true),
    a student account (Alice, S001) cannot impersonate another student (S002).
    """
    res = client.post(
        "/api/conversations/message",
        headers={"X-Strict-Student-Isolation": "true"},
        json={"student_id": "S002", "message": "What is my attendance?"},
    )
    assert res.status_code == 403
    assert "not authorized" in res.json()["detail"].lower()
