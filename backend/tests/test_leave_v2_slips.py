"""
Services v2 Leave Flow, Exact DateTime Validation, Campus Gates, Official Slip PDF & Public Verification Tests.
"""

from datetime import datetime, timedelta, timezone
import io

from pypdf import PdfReader

from app.core import timezone_utils
from app.db import models


def test_leave_v2_gates_validation_slip_pdf_verify_and_cancel_approved(client, admin_client, unauthenticated_client, db):
    # 1. Seeded Campus Gates endpoint
    res_gates = client.get("/api/gates")
    assert res_gates.status_code == 200
    gates = res_gates.json()["items"]
    assert any("Hostel Gate" in g["name"] for g in gates)
    assert any("Main Gate" in g["name"] for g in gates)

    now_c = timezone_utils.campus_now()
    past_date = (now_c.date() - timedelta(days=2)).isoformat()
    f_date = (now_c.date() + timedelta(days=6)).isoformat()
    t_date = (now_c.date() + timedelta(days=8)).isoformat()

    # 2. Past date rejected cleanly with 422
    res_past = client.post(
        "/api/requests/leave",
        json={
            "category": "personal",
            "reason": "Past departure check",
            "from_date": past_date,
            "from_time": "10:00",
            "to_date": f_date,
            "to_time": "18:00",
        },
    )
    assert res_past.status_code == 422

    # 3. End before start rejected cleanly with 422
    res_order = client.post(
        "/api/requests/leave",
        json={
            "category": "personal",
            "reason": "Invalid end before start check",
            "from_date": t_date,
            "from_time": "18:00",
            "to_date": f_date,
            "to_time": "10:00",
        },
    )
    assert res_order.status_code == 422

    # 4. Valid Leave v2 submit -> PENDING_APPROVAL with from_at/to_at + college snapshot
    res_ok = client.post(
        "/api/requests/leave",
        json={
            "category": "personal",
            "reason": "Attending sister engagement function",
            "destination": "Chandigarh",
            "from_date": f_date,
            "from_time": "16:30",
            "to_date": t_date,
            "to_time": "20:00",
        },
    )
    assert res_ok.status_code == 201, res_ok.text
    leave = res_ok.json()["request"]
    leave_id = leave["id"]
    assert leave["status"] == "PENDING_APPROVAL"
    assert leave["from_at"] is not None
    assert leave["to_at"] is not None
    assert leave["from_display"] is not None
    assert leave["college"]
    assert leave["destination"] == "Chandigarh"
    assert leave["has_slip"] is False

    # Unapproved request cannot download slip yet (409)
    res_pdf_early = client.get(f"/api/requests/{leave_id}/slip.pdf")
    assert res_pdf_early.status_code == 409

    # 5. Approve with explicit exit_gate & entry_gate -> slip_no + verify_code issued
    res_app = admin_client.post(
        f"/api/requests/{leave_id}/approve",
        json={
            "version": leave["version"],
            "exit_gate": "Gate 2 - Hostel Gate",
            "entry_gate": "Gate 1 - Main Gate",
            "comment": "Approved with parent intimation",
        },
    )
    assert res_app.status_code == 200, res_app.text
    approved = res_app.json()["request"]
    assert approved["status"] == "APPROVED"
    assert approved["exit_gate"] == "Gate 2 - Hostel Gate"
    assert approved["entry_gate"] == "Gate 1 - Main Gate"
    assert approved["slip_no"].startswith("LS-")
    assert len(approved["verify_code"]) >= 12
    assert approved["has_slip"] is True
    assert approved["can_cancel"] is True

    # 6. Download real PDF slip and assert extracted text contents
    res_pdf = client.get(f"/api/requests/{leave_id}/slip.pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(res_pdf.content))
    pdf_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert approved["slip_no"] in pdf_text
    assert approved["student_name"] in pdf_text
    assert approved["student_id"] in pdf_text
    assert approved["college"] in pdf_text
    assert "Gate 2 - Hostel Gate" in pdf_text
    assert "Gate 1 - Main Gate" in pdf_text
    assert approved["verify_code"] in pdf_text

    # 7. Public verification returns VALID and excludes phone/email/reason
    res_ver = unauthenticated_client.get(f"/api/verify/{approved['verify_code']}")
    assert res_ver.status_code == 200
    ver = res_ver.json()
    assert ver["status"] == "VALID"
    assert ver["valid"] is True
    assert ver["slip_no"] == approved["slip_no"]
    assert ver["exit_gate"] == "Gate 2 - Hostel Gate"
    assert "reason" not in ver
    assert "student_email" not in ver
    assert "phone" not in ver

    # Tampered verify code -> NOT_FOUND
    res_bad = unauthenticated_client.get("/api/verify/TAMPERED-INVALID-CODE-XYZ")
    assert res_bad.status_code == 200
    assert res_bad.json()["status"] == "NOT_FOUND"
    assert res_bad.json()["valid"] is False

    # 8. Student cancels APPROVED leave BEFORE from_at -> CANCELLED -> verify returns REVOKED
    res_cancel = client.post(f"/api/requests/{leave_id}/cancel", json={"version": approved["version"]})
    assert res_cancel.status_code == 200, res_cancel.text
    assert res_cancel.json()["request"]["status"] == "CANCELLED"

    res_ver_revoked = unauthenticated_client.get(f"/api/verify/{approved['verify_code']}")
    assert res_ver_revoked.status_code == 200
    assert res_ver_revoked.json()["status"] == "REVOKED"
    assert res_ver_revoked.json()["valid"] is False


def test_legacy_leave_without_times_returns_friendly_slip_error_and_cant_cancel_after_start(client, admin_client, db):
    # Legacy submit without from_at/to_at
    f_date = (timezone_utils.campus_now().date() + timedelta(days=20)).isoformat()
    res_leg = client.post(
        "/api/requests/leave",
        json={
            "days": 1,
            "start_date": f_date,
            "category": "medical",
            "reason": "Dental appointment checkup",
        },
    )
    assert res_leg.status_code == 201
    leg_id = res_leg.json()["request"]["id"]
    app_leg = admin_client.post(f"/api/requests/{leg_id}/approve", json={"version": 1})
    assert app_leg.status_code == 200
    assert app_leg.json()["request"]["has_slip"] is False

    res_pdf = client.get(f"/api/requests/{leg_id}/slip.pdf")
    assert res_pdf.status_code == 409
    assert "Slip not available for older requests" in res_pdf.json()["detail"]

    # Approved v2 leave whose start time already passed cannot be cancelled (409)
    row = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leg_id).first()
    row.from_at = datetime.now(timezone.utc) - timedelta(hours=2)
    row.to_at = datetime.now(timezone.utc) + timedelta(hours=10)
    db.commit()

    res_too_late = client.post(f"/api/requests/{leg_id}/cancel", json={"version": row.version})
    assert res_too_late.status_code == 409


def test_chat_freetext_leave_extraction_and_guided_card(client):
    # 1. Ambiguous prompt triggers guided_card without creating a leave row
    r1 = client.post("/api/conversations/message", json={"student_id": "S001", "message": "I need leave"})
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["status"] == "awaiting_clarification"
    meta1 = d1["latest_reply"]["metadata"]
    assert meta1["guided_card"]["type"] == "leave_details"

    # 2. Natural-language full window extracts slots and prepares confirmation without creating row until confirmed
    r2 = client.post(
        "/api/conversations/message",
        json={
            "student_id": "S001",
            "message": "I need leave tomorrow 4pm to Sunday 8pm for a family function",
        },
    )
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["status"] == "awaiting_confirmation"
    prop = d2["pending_confirmation"]
    assert prop is not None
    assert prop["fields"]["from_display"] is not None
    assert prop["fields"]["to_display"] is not None
    assert "family function" in prop["fields"]["reason"].lower()
    assert d2["active_workflow_request_id"] is None
