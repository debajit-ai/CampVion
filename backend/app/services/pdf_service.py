"""
Print-Ready A4 Official Slip PDF Generator for CampVion Services v2.
Uses ReportLab + qrcode[pil] + bundled Unicode TTF fonts (DejaVuSans).
Supports Leave Gate Pass slips (`request_type == 'leave'`) and booking confirmation slips.
"""

from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Any, Dict, Optional

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.core.timezone_utils import format_campus_dt

BACKEND_DIR = Path(__file__).resolve().parents[2]
FONT_SANS_PATH = BACKEND_DIR / "assets" / "fonts" / "DejaVuSans.ttf"
FONT_MONO_PATH = BACKEND_DIR / "assets" / "fonts" / "DejaVuSansMono.ttf"
BRAND_LOCKUP_PATH = BACKEND_DIR / "assets" / "brand" / "campvion-lockup-dark.png"

_FONTS_REGISTERED = False


def _ensure_fonts() -> tuple[str, str]:
    global _FONTS_REGISTERED
    sans_name = "Helvetica"
    mono_name = "Courier"
    if not _FONTS_REGISTERED:
        try:
            if FONT_SANS_PATH.exists():
                pdfmetrics.registerFont(TTFont("CampVionSans", str(FONT_SANS_PATH)))
                sans_name = "CampVionSans"
            if FONT_MONO_PATH.exists():
                pdfmetrics.registerFont(TTFont("CampVionMono", str(FONT_MONO_PATH)))
                mono_name = "CampVionMono"
            _FONTS_REGISTERED = True
        except Exception:
            sans_name = "Helvetica"
            mono_name = "Courier"
    else:
        if "CampVionSans" in pdfmetrics.getRegisteredFontNames():
            sans_name = "CampVionSans"
        if "CampVionMono" in pdfmetrics.getRegisteredFontNames():
            mono_name = "CampVionMono"
    return sans_name, mono_name


def _wrap_text(text_val: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    clean = " ".join((text_val or "").split())
    if not clean:
        return ["—"]
    words = clean.split(" ")
    lines: list[str] = []
    current = ""
    for w in words:
        cand = f"{current} {w}".strip() if current else w
        if pdfmetrics.stringWidth(cand, font_name, font_size) <= max_width:
            current = cand
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines or ["—"]


def _build_qr_reader(url: str) -> ImageReader:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F172A", back_color="#FFFFFF").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def generate_leave_slip_pdf(
    *,
    leave_data: Dict[str, Any],
    verify_url: str,
) -> bytes:
    """
    Generate an official, crisp A4 white-paper CampVion Leave Pass / Booking Slip PDF.
    """
    sans_font, mono_font = _ensure_fonts()
    buf = io.BytesIO()
    page_w, page_h = A4
    c = canvas.Canvas(buf, pagesize=A4)

    slip_no = str(leave_data.get("slip_no") or leave_data.get("leave_code") or "LS-ISSUED")
    req_code = str(leave_data.get("leave_code") or "")
    verify_code = str(leave_data.get("verify_code") or "")
    req_type = str(leave_data.get("request_type") or "leave").lower()
    college = str(leave_data.get("college") or leave_data.get("student_college") or "Lovely Professional University")
    student_name = str(leave_data.get("student_name") or leave_data.get("student_id") or "Student")
    student_id = str(leave_data.get("student_id") or "")
    program = str(leave_data.get("student_program") or "Academic Program")
    semester = leave_data.get("student_semester")
    course_label = f"{program} (Sem {semester})" if semester else program
    hostel_label = str(leave_data.get("student_residence_label") or "Registered Student")

    status_label = str(leave_data.get("status") or "APPROVED").upper()
    from_display = str(leave_data.get("from_display") or leave_data.get("start_date") or "—")
    to_display = str(leave_data.get("to_display") or leave_data.get("end_date") or "—")
    exit_gate = str(leave_data.get("exit_gate") or "Gate 1 - Main Gate")
    entry_gate = str(leave_data.get("entry_gate") or exit_gate)
    destination = str(leave_data.get("destination") or "Not specified")
    category_label = str(leave_data.get("category") or "personal").replace("_", " ").title()
    reason = str(leave_data.get("reason") or "Approved campus leave")
    days_count = leave_data.get("days_count") or 1

    approved_by = str(leave_data.get("decided_by_name") or leave_data.get("assigned_approver") or "Dr. Rajesh Rao")
    approver_role = str(leave_data.get("approver_role") or leave_data.get("routed_to_role") or "Warden")
    approved_at_display = str(
        leave_data.get("approved_at_display")
        or (format_campus_dt(leave_data.get("decided_at")) if leave_data.get("decided_at") else None)
        or "Verified Official Approval"
    )
    decision_comment = str(leave_data.get("decision_comment") or "Approved at Institutional Governance Gate.")

    # Colors (print-friendly palette)
    ink = colors.HexColor("#0F172A")
    slate = colors.HexColor("#475569")
    muted = colors.HexColor("#64748B")
    border = colors.HexColor("#CBD5E1")
    panel_bg = colors.HexColor("#F8FAFC")
    accent = colors.HexColor("#0B5ED7")
    emerald = colors.HexColor("#065F46")
    emerald_bg = colors.HexColor("#ECFDF5")
    emerald_border = colors.HexColor("#6EE7B7")

    c.setTitle(f"CampVion Slip {slip_no}")
    c.setAuthor("CampVion Campus Operations")

    margin = 40
    content_w = page_w - 2 * margin
    y = page_h - 42

    # Top accent stripe
    c.setFillColor(ink)
    c.rect(margin, page_h - 24, content_w, 4, stroke=0, fill=1)

    # Brand lockup + College header
    header_h = 54
    if BRAND_LOCKUP_PATH.exists():
        try:
            lockup_reader = ImageReader(str(BRAND_LOCKUP_PATH))
            c.drawImage(lockup_reader, margin, y - 42, width=108, height=38, mask="auto", preserveAspectRatio=True)
        except Exception:
            c.setFont(sans_font, 16)
            c.setFillColor(ink)
            c.drawString(margin, y - 22, "CampVion")
    else:
        c.setFont(sans_font, 16)
        c.setFillColor(ink)
        c.drawString(margin, y - 22, "CampVion")

    # Right aligned status pill & slip identifier
    pill_w = 96
    pill_h = 22
    pill_x = page_w - margin - pill_w
    pill_y = y - 22
    c.setFillColor(emerald_bg)
    c.setStrokeColor(emerald_border)
    c.setLineWidth(1)
    c.roundRect(pill_x, pill_y, pill_w, pill_h, 5, stroke=1, fill=1)
    c.setFillColor(emerald)
    c.setFont(sans_font, 9.5)
    c.drawCentredString(pill_x + pill_w / 2, pill_y + 7, status_label)

    c.setFillColor(slate)
    c.setFont(mono_font, 9.5)
    c.drawRightString(page_w - margin, y - 38, f"SLIP: {slip_no}")

    # Title banner
    y -= header_h + 4
    c.setFillColor(ink)
    c.setFont(sans_font, 15.5)
    doc_title = "OFFICIAL CAMPUS LEAVE PASS & GATE SLIP" if req_type == "leave" else "OFFICIAL CAMPUS BOOKING CONFIRMATION"
    c.drawString(margin, y, doc_title)

    y -= 16
    c.setFillColor(slate)
    c.setFont(sans_font, 9.5)
    c.drawString(margin, y, f"Institution: {college}   •   Request Code: {req_code}")

    y -= 10
    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.line(margin, y, page_w - margin, y)

    # Section 1: Student Details Box
    y -= 14
    box1_h = 104
    c.setFillColor(panel_bg)
    c.setStrokeColor(border)
    c.roundRect(margin, y - box1_h, content_w, box1_h, 6, stroke=1, fill=1)

    c.setFillColor(accent)
    c.setFont(sans_font, 8.5)
    c.drawString(margin + 14, y - 18, "STUDENT CREDENTIALS")

    col1_x = margin + 14
    col2_x = margin + content_w * 0.52

    def _kv(x_pos: float, y_pos: float, k: str, v: str, val_size: float = 10.0) -> None:
        c.setFillColor(muted)
        c.setFont(sans_font, 8)
        c.drawString(x_pos, y_pos, k.upper())
        c.setFillColor(ink)
        c.setFont(sans_font, val_size)
        c.drawString(x_pos, y_pos - 13, v[:58])

    _kv(col1_x, y - 36, "Full Name", student_name, 10.5)
    _kv(col2_x, y - 36, "Student ID", student_id, 10.5)
    _kv(col1_x, y - 68, "College / University", college, 9.5)
    _kv(col2_x, y - 68, "Program / Residence", f"{course_label} • {hostel_label}"[:48], 9.2)

    y -= box1_h + 14

    # Section 2: Authorized Schedule / Window Box
    box2_h = 152 if req_type == "leave" else 132
    c.setFillColor(colors.white)
    c.setStrokeColor(border)
    c.roundRect(margin, y - box2_h, content_w, box2_h, 6, stroke=1, fill=1)

    c.setFillColor(accent)
    c.setFont(sans_font, 8.5)
    c.drawString(margin + 14, y - 18, "AUTHORIZED SCHEDULE & LEAVE DETAILS" if req_type == "leave" else "RESERVATION WINDOW & DETAILS")

    _kv(col1_x, y - 38, "From Date & Time (IST)", from_display, 10.0)
    _kv(col2_x, y - 38, "To Date & Time (IST)", to_display, 10.0)

    if req_type == "leave":
        _kv(col1_x, y - 72, "Leave Category & Duration", f"{category_label} ({days_count} day{'s' if days_count != 1 else ''})", 9.8)
        _kv(col2_x, y - 72, "Destination", destination, 9.8)
        reason_y = y - 106
    else:
        _kv(col1_x, y - 72, "Service Type", str(leave_data.get("request_type_label") or req_type.title()), 9.8)
        _kv(col2_x, y - 72, "Booking Reference", str(leave_data.get("title") or req_code), 9.8)
        reason_y = y - 106

    c.setFillColor(muted)
    c.setFont(sans_font, 8)
    c.drawString(col1_x, reason_y, "PURPOSE / REASON")
    c.setFillColor(ink)
    c.setFont(sans_font, 9.5)
    for idx, line_txt in enumerate(_wrap_text(reason, sans_font, 9.5, content_w - 28)[:2]):
        c.drawString(col1_x, reason_y - 13 - idx * 12, line_txt)

    y -= box2_h + 14

    # Section 3: Gate Clearance Box (Leave) or Venue Box
    if req_type == "leave":
        box3_h = 74
        c.setFillColor(emerald_bg)
        c.setStrokeColor(emerald_border)
        c.roundRect(margin, y - box3_h, content_w, box3_h, 6, stroke=1, fill=1)

        c.setFillColor(emerald)
        c.setFont(sans_font, 8.5)
        c.drawString(margin + 14, y - 18, "SECURITY GATE CLEARANCE")
        _kv(col1_x, y - 36, "Authorized Exit Gate", exit_gate, 10.5)
        _kv(col2_x, y - 36, "Authorized Entry Gate", entry_gate, 10.5)
        y -= box3_h + 14

    # Section 4: Institutional Authorization + QR Code Verification Block
    box4_h = 156
    c.setFillColor(panel_bg)
    c.setStrokeColor(border)
    c.roundRect(margin, y - box4_h, content_w, box4_h, 6, stroke=1, fill=1)

    c.setFillColor(accent)
    c.setFont(sans_font, 8.5)
    c.drawString(margin + 14, y - 18, "INSTITUTIONAL AUTHORIZATION & QR VERIFICATION")

    # Left column: approval stamp & notes
    _kv(col1_x, y - 38, "Approved By", f"{approved_by} ({approver_role})", 10.0)
    _kv(col1_x, y - 72, "Approved Timestamp (IST)", approved_at_display, 9.5)

    c.setFillColor(muted)
    c.setFont(sans_font, 8)
    c.drawString(col1_x, y - 104, "APPROVER REMARKS")
    c.setFillColor(ink)
    c.setFont(sans_font, 9.0)
    for idx, line_txt in enumerate(_wrap_text(decision_comment, sans_font, 9.0, content_w - 165)[:2]):
        c.drawString(col1_x, y - 117 - idx * 11, line_txt)

    # Right column: QR Code + code caption
    qr_size = 104
    qr_x = page_w - margin - qr_size - 16
    qr_y = y - 122
    try:
        qr_reader = _build_qr_reader(verify_url)
        c.setFillColor(colors.white)
        c.setStrokeColor(border)
        c.rect(qr_x - 4, qr_y - 4, qr_size + 8, qr_size + 8, stroke=1, fill=1)
        c.drawImage(qr_reader, qr_x, qr_y, width=qr_size, height=qr_size)
    except Exception:
        pass

    c.setFillColor(slate)
    c.setFont(mono_font, 7.8)
    c.drawCentredString(qr_x + qr_size / 2, qr_y - 16, f"CODE: {verify_code}")

    y -= box4_h + 16

    # Footer verification instructions
    c.setFillColor(slate)
    c.setFont(sans_font, 8.2)
    c.drawString(margin, y, "Gate Security Verification Link:")
    c.setFillColor(accent)
    c.setFont(mono_font, 8.0)
    c.drawString(margin, y - 13, verify_url[:95])

    c.setFillColor(muted)
    c.setFont(sans_font, 7.8)
    c.drawString(
        margin,
        42,
        "Issued electronically by CampVion Institutional Governance. Valid only when verification status reads VALID.",
    )
    c.drawRightString(page_w - margin, 42, f"Timezone: {leave_data.get('campus_tz') or 'Asia/Kolkata'}")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()
