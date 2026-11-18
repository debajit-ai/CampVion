"""
End-to-End Backend Tests for Leave Workflow Pause/Resume, Optimistic Concurrency,
Role-Based Access Control, Admin Signup Invite Code, Notifications, Audit Log & SSE Pub/Sub.
"""

import json
import pytest
from app.core.config import settings
from app.core.security import auth_rate_limiter
from app.db import models
from app.services import events_service


def test_full_leave_lifecycle_pause_approve_and_concurrency(client, admin_client, db):
    # 1. Student submits leave via /api/requests/leave (distinct future dates to avoid test interference)
    res_sub = client.post(
        "/api/requests/leave",
        json={
            "days": 2,
            "start_date": "2027-03-10",
            "category": "personal",
            "reason": "Attending sister graduation ceremony out of town",
        },
    )
    assert res_sub.status_code == 201, res_sub.text
    payload = res_sub.json()
    leave = payload["request"]
    wf = payload["workflow"]

    assert wf["status"] == "WAITING_FOR_HUMAN"
    assert leave["status"] == "PENDING_APPROVAL"
    assert leave["assigned_approver"] == "Dr. Rajesh Rao"
    assert leave["routed_to_role"] == "Warden"
    assert leave["attendance_snapshot"] >= 75.0
    assert leave["version"] == 1
    leave_id = leave["id"]

    # 2. Overlapping pending dates must be blocked with 409 Conflict
    res_dup = client.post(
        "/api/requests/leave",
        json={
            "days": 1,
            "start_date": "2027-03-11",
            "category": "personal",
            "reason": "Overlapping date test",
        },
    )
    assert res_dup.status_code == 409

    # 3. Admin sees it in queue, Student cannot approve (403)
    res_queue = admin_client.get("/api/requests/?status=PENDING_APPROVAL")
    assert res_queue.status_code == 200
    ids_in_queue = [item["id"] for item in res_queue.json()["items"]]
    assert leave_id in ids_in_queue

    res_student_approve = client.post(f"/api/requests/{leave_id}/approve", json={"version": 1})
    assert res_student_approve.status_code == 403

    # 4. Admin approves with comment & matching version
    res_approve = admin_client.post(
        f"/api/requests/{leave_id}/approve",
        json={"comment": "Approved, safe travels", "version": 1},
    )
    assert res_approve.status_code == 200, res_approve.text
    approved_req = res_approve.json()["request"]
    approved_wf = res_approve.json()["workflow_result"]

    assert approved_req["status"] == "APPROVED"
    assert approved_req["version"] == 2
    assert approved_req["decision_comment"] == "Approved, safe travels"
    assert approved_wf["status"] == "COMPLETED"
    assert len(approved_wf["completed_tasks"]) == 6

    # 5. Duplicate approve / stale version -> 409 Conflict
    res_second = admin_client.post(f"/api/requests/{leave_id}/approve", json={"version": 1})
    assert res_second.status_code == 409

    # 6. Notifications & Audit Log recorded atomically
    notif_res = client.get("/api/notifications")
    assert notif_res.status_code == 200
    assert any(n["leave_request_id"] == leave_id and "Approved" in n["title"] for n in notif_res.json()["items"])

    audit_entries = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.target_type == "leave_request", models.AuditLog.target_id == str(leave_id))
        .all()
    )
    actions = {a.action for a in audit_entries}
    assert {"submit", "approve"}.issubset(actions)


def test_rejection_min_reason_ended_rejected_and_zero_leave_consumed(client, admin_client, db):
    res_sub = client.post(
        "/api/requests/leave",
        json={
            "days": 2,
            "start_date": "2027-04-05",
            "category": "personal",
            "reason": "Vacation trip during midterms",
        },
    )
    assert res_sub.status_code == 201
    leave_id = res_sub.json()["request"]["id"]
    wf_id = res_sub.json()["workflow"]["request_id"]

    # Too short rejection reason -> 422
    res_short = admin_client.post(f"/api/requests/{leave_id}/reject", json={"reason": "No"})
    assert res_short.status_code == 422

    # Valid rejection reason (>= 10 chars)
    approved_before = db.query(models.LeaveRequest).filter(models.LeaveRequest.status == "APPROVED").count()
    res_rej = admin_client.post(
        f"/api/requests/{leave_id}/reject",
        json={"reason": "Midterm examinations are scheduled on these dates.", "version": 1},
    )
    assert res_rej.status_code == 200
    rej_req = res_rej.json()["request"]
    rej_wf = res_rej.json()["workflow_result"]

    assert rej_req["status"] == "REJECTED"
    assert "Midterm examinations" in rej_req["rejection_reason"]
    assert rej_req["authority_contact"]["email"] is not None
    assert rej_wf["status"] == "ENDED_REJECTED"
    assert db.query(models.LeaveRequest).filter(models.LeaveRequest.status == "APPROVED").count() == approved_before

    # Check workflow state stored in DB
    st_res = admin_client.get(f"/api/agent/{wf_id}")
    assert st_res.status_code == 200
    assert st_res.json()["current_status"] == "ENDED_REJECTED"


def test_student_cancel_and_post_decision_lock(client, admin_client):
    res_sub = client.post(
        "/api/requests/leave",
        json={
            "days": 1,
            "start_date": "2027-05-01",
            "category": "medical",
            "reason": "Routine dental consultation appointment",
        },
    )
    assert res_sub.status_code == 201
    leave_id = res_sub.json()["request"]["id"]

    res_cancel = client.post(f"/api/requests/{leave_id}/cancel", json={"version": 1})
    assert res_cancel.status_code == 200
    assert res_cancel.json()["request"]["status"] == "CANCELLED"

    # Admin cannot approve already cancelled request -> 409
    assert admin_client.post(f"/api/requests/{leave_id}/approve").status_code == 409


def test_admin_signup_invite_code_and_rbac_idor_isolation(unauthenticated_client, client, db):
    auth_rate_limiter.clear()

    # Unauthenticated SSE rejected with 401
    assert unauthenticated_client.get("/api/events").status_code == 401

    # Admin signup with wrong invite code -> 403
    bad_admin = unauthenticated_client.post(
        "/api/auth/signup",
        json={
            "full_name": "Unauthorized Person",
            "email": "bad.admin@campvion.edu",
            "password": "StrongPassword2026!",
            "confirm_password": "StrongPassword2026!",
            "accept_terms": True,
            "role": "administrator",
            "invite_code": "WRONG-CODE",
            "authority_title": "Warden",
        },
    )
    assert bad_admin.status_code == 403

    # Admin signup with valid invite code -> 201
    good_admin = unauthenticated_client.post(
        "/api/auth/signup",
        json={
            "full_name": "Dr. Meera Iyer",
            "email": "meera.dean@campvion.edu",
            "password": "StrongPassword2026!",
            "confirm_password": "StrongPassword2026!",
            "accept_terms": True,
            "role": "administrator",
            "invite_code": settings.ADMIN_INVITE_CODE,
            "authority_title": "Dean",
            "phone": "+91 98111 22334",
        },
    )
    assert good_admin.status_code == 201
    assert good_admin.json()["user"]["role"] == "administrator"
    assert good_admin.json()["user"]["authority_title"] == "Dean"
    assert good_admin.json()["user"]["student_id"] is None

    # Student IDOR checks: student cannot list S002's leaves or approve anything
    assert client.get("/api/requests/?student_id=S002").status_code == 403
    assert client.get("/api/agent/pending-approvals").status_code == 403


def test_sse_broker_sync_to_async_dispatch():
    import asyncio

    async def _run():
        events_received = []

        async def _consume():
            async for evt in events_service.event_broker.subscribe(user_id=9991, role="student"):
                events_received.append(evt)
                break

        task = asyncio.create_task(_consume())
        await asyncio.sleep(0.02)
        events_service.event_broker.publish(
            event_type="request.updated",
            payload={"leave_code": "LV-2027-9999", "status": "APPROVED"},
            target_user_ids=[9991],
            event_id="999",
        )
        await asyncio.wait_for(task, timeout=2.0)
        assert len(events_received) == 1
        assert events_received[0].event_type == "request.updated"
        assert events_received[0].payload["status"] == "APPROVED"

    asyncio.run(_run())


def test_multi_type_requests_admin_readonly_and_status_pending(client, admin_client, db):
    from app.services import leave_service

    # 1. Admin cannot submit leave or generic requests via API (403)
    res_adm_leave = admin_client.post(
        "/api/requests/leave",
        json={"days": 1, "start_date": "2027-08-01", "category": "personal", "reason": "Should be blocked"},
    )
    assert res_adm_leave.status_code == 403

    res_adm_sub = admin_client.post(
        "/api/requests/submit",
        json={"request_type": "certificate", "reason": "Admin should not submit"},
    )
    assert res_adm_sub.status_code == 403

    # 2. Admin Ask CampVion chat stays read-only & blocks leave creation
    before_count = db.query(models.LeaveRequest).count()
    adm_chat = admin_client.post(
        "/api/conversations/message",
        json={"message": "I want to apply for leave for 2 days tomorrow"},
    )
    assert adm_chat.status_code == 200, adm_chat.text
    adm_reply = adm_chat.json()["latest_reply"]
    assert adm_reply["intent_category"] == "ADMIN_READONLY_GUARD"
    assert db.query(models.LeaveRequest).count() == before_count

    # 3. Seed sample non-leave requests idempotently & verify ?status=pending works for Admin
    seeded = leave_service.seed_sample_multi_type_requests(db)
    assert seeded == 3
    assert leave_service.seed_sample_multi_type_requests(db) == 0  # idempotent

    pending_res = admin_client.get("/api/requests?status=pending")
    assert pending_res.status_code == 200
    types_in_queue = {item["request_type"] for item in pending_res.json()["items"]}
    assert {"library_room", "hostel_allocation", "certificate"}.issubset(types_in_queue)

    # 4. Student submits a library_room booking through conversational chat -> PENDING_APPROVAL -> Admin approves
    chat_lib = client.post(
        "/api/conversations/message",
        json={"message": "Book a library room tomorrow 14:00 to 16:00 for capstone group study"},
    )
    assert chat_lib.status_code == 200, chat_lib.text
    conv_id = chat_lib.json()["conversation_id"]
    assert chat_lib.json()["status"] == "awaiting_confirmation"

    conf_lib = client.post(f"/api/conversations/{conv_id}/confirm", json={"action": "confirm"})
    assert conf_lib.status_code == 200, conf_lib.text
    lib_req = conf_lib.json()["latest_reply"]["metadata"]["leave_request"]
    assert lib_req["request_type"] == "library_room"
    assert lib_req["status"] == "PENDING_APPROVAL"
    assert lib_req["leave_code"].startswith("LIB-")

    lib_queue = admin_client.get("/api/requests?status=pending&request_type=library_room")
    assert lib_queue.status_code == 200
    assert any(item["id"] == lib_req["id"] for item in lib_queue.json()["items"])

    app_lib = admin_client.post(
        f"/api/requests/{lib_req['id']}/approve",
        json={"comment": "Seminar Room B-204 reserved", "version": lib_req["version"]},
    )
    assert app_lib.status_code == 200
    assert app_lib.json()["request"]["status"] == "APPROVED"

    # 5. Independent stats endpoint & `?type=certificate` / `?type=all` aliases + tolerant null-date sorting
    stats_res = admin_client.get("/api/requests/stats")
    assert stats_res.status_code == 200
    assert "pending_count" in stats_res.json()

    cert_res = admin_client.get("/api/requests?status=pending&type=certificate")
    assert cert_res.status_code == 200
    assert all(i["request_type"] == "certificate" for i in cert_res.json()["items"])

    all_type_res = admin_client.get("/api/requests?status=pending&type=all")
    assert all_type_res.status_code == 200
