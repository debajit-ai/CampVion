"""
Services v2 Library Discussion Room Booking Integration Tests.
"""

from datetime import timedelta
import io

from pypdf import PdfReader

from app.core import timezone_utils


def test_discussion_room_rules_booking_approve_pdf_and_cancel_frees_slot(
    client, admin_client, db
):
    # 1. Seeded 6 rooms returned
    res_rooms = client.get("/api/rooms/available")
    assert res_rooms.status_code == 200
    rooms = res_rooms.json()["items"]
    assert len(rooms) >= 6
    target_room = rooms[0]  # 4-seat DR-101

    target_date = (timezone_utils.campus_now().date() + timedelta(days=5)).isoformat()
    second_date = (timezone_utils.campus_now().date() + timedelta(days=6)).isoformat()

    # 2. Outside open hours (21:00 -> 22:00) -> 422
    res_late = client.post(
        "/api/requests/submit",
        json={
            "request_type": "library_room",
            "room_id": target_room["id"],
            "people": 2,
            "from_date": target_date,
            "from_time": "21:00",
            "to_date": target_date,
            "to_time": "22:00",
            "reason": "Late evening study",
        },
    )
    assert res_late.status_code == 422

    # 3. Duration > 2 hours -> 422
    res_long = client.post(
        "/api/requests/submit",
        json={
            "request_type": "library_room",
            "room_id": target_room["id"],
            "people": 2,
            "from_date": target_date,
            "from_time": "10:00",
            "to_date": target_date,
            "to_time": "13:00",
            "reason": "Three hour marathon session",
        },
    )
    assert res_long.status_code == 422

    # 4. Capacity exceeded -> 422
    res_cap = client.post(
        "/api/requests/submit",
        json={
            "request_type": "library_room",
            "room_id": target_room["id"],
            "people": target_room["capacity"] + 2,
            "from_date": target_date,
            "from_time": "10:00",
            "to_date": target_date,
            "to_time": "12:00",
            "reason": "Large group meeting",
        },
    )
    assert res_cap.status_code == 422

    # 5. Valid booking -> PENDING_APPROVAL
    res_ok = client.post(
        "/api/requests/submit",
        json={
            "request_type": "library_room",
            "room_id": target_room["id"],
            "people": 3,
            "from_date": target_date,
            "from_time": "14:00",
            "to_date": target_date,
            "to_time": "16:00",
            "reason": "System design group review",
        },
    )
    assert res_ok.status_code == 201, res_ok.text
    booking = res_ok.json()["request"]
    assert booking["request_type"] == "library_room"
    assert booking["status"] == "PENDING_APPROVAL"

    # Room now marked unavailable during that slot
    res_avail_during = client.get(
        f"/api/rooms/available?date={target_date}&start_time=14:30&end_time=15:30&people=2"
    )
    assert res_avail_during.status_code == 200
    matched = [r for r in res_avail_during.json()["items"] if r["id"] == target_room["id"]][0]
    assert matched["available"] is False

    # Same student second booking same day -> 409
    res_second_same_day = client.post(
        "/api/requests/submit",
        json={
            "request_type": "library_room",
            "room_id": rooms[2]["id"],
            "people": 2,
            "from_date": target_date,
            "from_time": "17:00",
            "to_date": target_date,
            "to_time": "18:00",
            "reason": "Another booking same day",
        },
    )
    assert res_second_same_day.status_code == 409

    # 6. Admin approves -> APPROVED + confirmation PDF available
    res_app = admin_client.post(
        f"/api/requests/{booking['id']}/approve",
        json={"version": booking["version"], "comment": "Room confirmed"},
    )
    assert res_app.status_code == 200
    approved = res_app.json()["request"]
    assert approved["status"] == "APPROVED"
    assert approved["has_slip"] is True

    res_pdf = client.get(f"/api/requests/{booking['id']}/slip.pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(res_pdf.content))
    txt = "\n".join(p.extract_text() or "" for p in reader.pages)
    assert target_room["name"] in txt

    # 7. Cancel before start frees up the slot immediately
    res_cancel = client.post(
        f"/api/requests/{booking['id']}/cancel",
        json={"version": approved["version"]},
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["request"]["status"] == "CANCELLED"

    res_avail_after = client.get(
        f"/api/rooms/available?date={target_date}&start_time=14:30&end_time=15:30&people=2"
    )
    matched_after = [r for r in res_avail_after.json()["items"] if r["id"] == target_room["id"]][0]
    assert matched_after["available"] is True

    # 8. Guided chat without time opens room_booking card
    r_chat = client.post(
        "/api/conversations/message",
        json={"student_id": "S001", "message": "Book a discussion room"},
    )
    assert r_chat.status_code == 200
    assert r_chat.json()["latest_reply"]["metadata"]["guided_card"]["type"] == "room_booking"
    # Second-date sanity check doesn't throw
    assert second_date > target_date
