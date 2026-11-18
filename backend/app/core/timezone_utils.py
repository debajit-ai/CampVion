"""
Campus Timezone & Date/Time Parsing/Formatting Utilities.
All datetimes are stored in UTC in SQLite/Postgres and converted to settings.CAMPUS_TZ
(default: Asia/Kolkata) for natural-language parsing ("today", "tomorrow", weekday names),
policy validation, and UI/PDF 12-hour human formatting ("Friday, 21 Nov 2026, 4:30 PM").
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
import re
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from fastapi import Request

from app.core.config import settings

WEEKDAY_INDEX = {
    "monday": 0,
    "mon": 0,
    "tuesday": 1,
    "tue": 1,
    "tues": 1,
    "wednesday": 2,
    "wed": 2,
    "thursday": 3,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "friday": 4,
    "fri": 4,
    "saturday": 5,
    "sat": 5,
    "sunday": 6,
    "sun": 6,
}

_TIME_REGEX = re.compile(
    r"\b(?:(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)|([01]?\d|2[0-3]):([0-5]\d))\b",
    re.IGNORECASE,
)

_ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
_DMY_SLASH_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b")
_MONTH_DATE_RE = re.compile(
    r"\b(\d{1,2})(?:st|nd|rd|th)?\s+"
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"(?:\s+(\d{4}))?\b",
    re.IGNORECASE,
)


def get_campus_tz() -> ZoneInfo | timezone:
    tz_name = (settings.CAMPUS_TZ or "Asia/Kolkata").strip() or "Asia/Kolkata"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        try:
            return ZoneInfo("Asia/Kolkata")
        except Exception:
            return timezone.utc


def campus_now() -> datetime:
    return datetime.now(get_campus_tz())


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure naive DB datetimes are treated as UTC and converted cleanly."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_campus(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert any aware or naive-UTC datetime into settings.CAMPUS_TZ."""
    utc_dt = ensure_utc(dt)
    if utc_dt is None:
        return None
    return utc_dt.astimezone(get_campus_tz())


def utc_iso(dt: Optional[datetime]) -> Optional[str]:
    utc_dt = ensure_utc(dt)
    if utc_dt is None:
        return None
    return utc_dt.isoformat()


def campus_iso(dt: Optional[datetime]) -> Optional[str]:
    cdt = to_campus(dt)
    if cdt is None:
        return None
    return cdt.isoformat()


def format_day_name(dt_or_date: Optional[datetime | date | str]) -> str:
    if dt_or_date is None:
        return ""
    if isinstance(dt_or_date, datetime):
        cdt = to_campus(dt_or_date)
        return cdt.strftime("%A") if cdt else ""
    if isinstance(dt_or_date, date):
        return dt_or_date.strftime("%A")
    parsed = parse_campus_date(str(dt_or_date))
    return parsed.strftime("%A") if parsed else ""


def format_campus_time_12h(dt: Optional[datetime]) -> str:
    cdt = to_campus(dt)
    if cdt is None:
        return ""
    hour = cdt.hour % 12 or 12
    ampm = "AM" if cdt.hour < 12 else "PM"
    return f"{hour}:{cdt.minute:02d} {ampm}"


def format_campus_dt(dt: Optional[datetime]) -> str:
    """Format UTC/aware datetime in CAMPUS_TZ as e.g. 'Friday, 21 Nov 2026, 4:30 PM'."""
    cdt = to_campus(dt)
    if cdt is None:
        return ""
    return f"{cdt.strftime('%A')}, {cdt.day} {cdt.strftime('%b %Y')}, {format_campus_time_12h(cdt)}"


def format_campus_short(dt: Optional[datetime]) -> str:
    """Format UTC/aware datetime in CAMPUS_TZ as e.g. '21 Nov 2026, 4:30 PM'."""
    cdt = to_campus(dt)
    if cdt is None:
        return ""
    return f"{cdt.day} {cdt.strftime('%b %Y')}, {format_campus_time_12h(cdt)}"


def parse_campus_time(raw_time: Optional[str]) -> Optional[time]:
    if not raw_time:
        return None
    val = str(raw_time).strip().lower()
    if not val:
        return None
    if val in {"noon", "12 noon"}:
        return time(12, 0)
    if val in {"midnight", "12 midnight"}:
        return time(0, 0)

    m = _TIME_REGEX.search(val)
    if not m:
        return None
    if m.group(1) is not None:
        h = int(m.group(1))
        mins = int(m.group(2) or 0)
        ampm = m.group(3).lower()
        if ampm == "pm" and h != 12:
            h += 12
        elif ampm == "am" and h == 12:
            h = 0
        return time(h, mins)
    h24 = int(m.group(4))
    mins24 = int(m.group(5))
    return time(h24, mins24)


def _next_weekday(ref_date: date, weekday_idx: int, *, min_days_ahead: int = 0) -> date:
    delta = (weekday_idx - ref_date.weekday()) % 7
    if delta < min_days_ahead:
        delta += 7
    return ref_date + timedelta(days=delta)


def parse_campus_date(raw_date: Optional[str], *, ref_dt: Optional[datetime] = None) -> Optional[date]:
    if not raw_date:
        return None
    raw = str(raw_date).strip()
    if not raw:
        return None
    now_c = to_campus(ref_dt) if ref_dt else campus_now()
    today = now_c.date()
    low = raw.lower()

    iso_m = _ISO_DATE_RE.search(raw)
    if iso_m:
        try:
            return date(int(iso_m.group(1)), int(iso_m.group(2)), int(iso_m.group(3)))
        except ValueError:
            pass

    if "day after tomorrow" in low:
        return today + timedelta(days=2)
    if "tomorrow" in low:
        return today + timedelta(days=1)
    if "today" in low:
        return today

    month_m = _MONTH_DATE_RE.search(raw)
    if month_m:
        day_num = int(month_m.group(1))
        mon_str = month_m.group(2)[:3].title()
        yr_num = int(month_m.group(3)) if month_m.group(3) else today.year
        try:
            parsed = datetime.strptime(f"{day_num} {mon_str} {yr_num}", "%d %b %Y").date()
            if not month_m.group(3) and parsed < today - timedelta(days=30):
                parsed = parsed.replace(year=today.year + 1)
            return parsed
        except ValueError:
            pass

    slash_m = _DMY_SLASH_RE.search(raw)
    if slash_m:
        d_num = int(slash_m.group(1))
        m_num = int(slash_m.group(2))
        y_raw = slash_m.group(3)
        y_num = int(y_raw) + 2000 if (y_raw and len(y_raw) == 2) else (int(y_raw) if y_raw else today.year)
        try:
            return date(y_num, m_num, d_num)
        except ValueError:
            pass

    for token, idx in WEEKDAY_INDEX.items():
        if re.search(rf"\b{token}\b", low):
            min_ahead = 1 if "next" in low else 0
            return _next_weekday(today, idx, min_days_ahead=min_ahead)

    return None


def combine_campus_to_utc(date_str: str, time_str: Optional[str] = None, *, default_hour: int = 9, default_minute: int = 0) -> Optional[datetime]:
    """Parse date + time in CAMPUS_TZ and convert to aware UTC datetime."""
    d = parse_campus_date(date_str)
    if d is None:
        return None
    t = parse_campus_time(time_str) if time_str else time(default_hour, default_minute)
    if t is None:
        return None
    local_dt = datetime(d.year, d.month, d.day, t.hour, t.minute, tzinfo=get_campus_tz())
    return local_dt.astimezone(timezone.utc)


def parse_iso_or_parts_to_utc(
    *,
    iso_value: Optional[str] = None,
    date_value: Optional[str] = None,
    time_value: Optional[str] = None,
    default_hour: int = 9,
    default_minute: int = 0,
) -> Optional[datetime]:
    """
    Accept either an ISO datetime string (aware or naive in CAMPUS_TZ) or separate date/time strings.
    Returns an aware UTC datetime.
    """
    if iso_value and str(iso_value).strip():
        raw = str(iso_value).strip()
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=get_campus_tz())
            return dt.astimezone(timezone.utc)
        except ValueError:
            pass
    if date_value:
        return combine_campus_to_utc(
            date_value,
            time_value,
            default_hour=default_hour,
            default_minute=default_minute,
        )
    return None


def _extract_date_from_fragment(fragment: str, ref_date: date) -> Optional[date]:
    low = fragment.lower()
    if "day after tomorrow" in low:
        return ref_date + timedelta(days=2)
    if "tomorrow" in low:
        return ref_date + timedelta(days=1)
    if "today" in low:
        return ref_date

    iso_m = _ISO_DATE_RE.search(fragment)
    if iso_m:
        try:
            return date(int(iso_m.group(1)), int(iso_m.group(2)), int(iso_m.group(3)))
        except ValueError:
            pass

    month_m = _MONTH_DATE_RE.search(fragment)
    if month_m:
        day_num = int(month_m.group(1))
        mon_str = month_m.group(2)[:3].title()
        yr_num = int(month_m.group(3)) if month_m.group(3) else ref_date.year
        try:
            return datetime.strptime(f"{day_num} {mon_str} {yr_num}", "%d %b %Y").date()
        except ValueError:
            pass

    slash_m = _DMY_SLASH_RE.search(fragment)
    if slash_m:
        d_num = int(slash_m.group(1))
        m_num = int(slash_m.group(2))
        y_raw = slash_m.group(3)
        y_num = int(y_raw) + 2000 if (y_raw and len(y_raw) == 2) else (int(y_raw) if y_raw else ref_date.year)
        try:
            return date(y_num, m_num, d_num)
        except ValueError:
            pass

    for token, idx in WEEKDAY_INDEX.items():
        if re.search(rf"\b{token}\b", low):
            return _next_weekday(ref_date, idx, min_days_ahead=0)

    return None


def parse_free_text_leave_window(text: str, *, ref_dt: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Parse natural-language leave descriptions such as:
    'I need leave tomorrow 4pm to Sunday 8pm for a family function'
    Returns prefill fields for guided form / slot filling.
    """
    now_c = to_campus(ref_dt) if ref_dt else campus_now()
    today = now_c.date()
    raw = (text or "").strip()
    low = raw.lower()

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    from_time: Optional[str] = None
    to_time: Optional[str] = None

    # Split on explicit range markers like " to ", " till ", " until ", " - "
    range_parts = re.split(r"\b(?:to|till|until)\b|\s+-\s+", raw, maxsplit=1, flags=re.IGNORECASE)
    if len(range_parts) == 2:
        left, right = range_parts[0], range_parts[1]
        from_date = _extract_date_from_fragment(left, today)
        anchor = from_date or today
        to_date = _extract_date_from_fragment(right, anchor)
        if from_date and to_date and to_date < from_date:
            to_date = to_date + timedelta(days=7)
        t_left = parse_campus_time(left)
        if t_left:
            from_time = f"{t_left.hour:02d}:{t_left.minute:02d}"
        t_right = parse_campus_time(right)
        if t_right:
            to_time = f"{t_right.hour:02d}:{t_right.minute:02d}"
    else:
        if "this weekend" in low or re.search(r"\bweekend\b", low):
            sat = _next_weekday(today, 5, min_days_ahead=0)
            from_date = sat
            to_date = sat + timedelta(days=1)
        else:
            from_date = _extract_date_from_fragment(raw, today)
            dur_m = re.search(r"\bfor\s+(\d+)\s*days?\b", low)
            if from_date and dur_m:
                d_count = max(1, min(30, int(dur_m.group(1))))
                to_date = from_date + timedelta(days=d_count - 1)
            times = list(_TIME_REGEX.finditer(raw))
            if len(times) >= 1:
                t0 = parse_campus_time(times[0].group(0))
                if t0:
                    from_time = f"{t0.hour:02d}:{t0.minute:02d}"
            if len(times) >= 2:
                t1 = parse_campus_time(times[1].group(0))
                if t1:
                    to_time = f"{t1.hour:02d}:{t1.minute:02d}"
                if from_date and not to_date:
                    to_date = from_date

    # Extract category hints
    category: Optional[str] = None
    if any(w in low for w in ("medical", "sick", "fever", "hospital", "doctor", "health", "unwell")):
        category = "medical"
    elif any(w in low for w in ("emergency", "urgent", "accident", "bereavement", "death")):
        category = "family_emergency"
    elif any(w in low for w in ("exam", "conference", "hackathon", "workshop", "academic", "seminar", "symposium")):
        category = "academic_event"
    elif any(w in low for w in ("placement", "interview", "internship", "drive")):
        category = "placement"
    elif any(w in low for w in ("family", "wedding", "function", "home", "personal", "visit")):
        category = "personal"

    # Extract reason phrase ("for <reason>" / "because <reason>"), ignoring generic words like "for leave"
    reason: Optional[str] = None
    reason_m = re.search(
        r"\b(?:for|because(?:\s+of)?|due\s+to|reason\s*(?:is|:))\s+(?!\d+\s*days?\b)(.+)$",
        raw,
        flags=re.IGNORECASE,
    )
    if reason_m:
        cand = reason_m.group(1).strip(" .,:;-")
        cand = re.sub(r"^(?:a|an|my|the)\s+", "", cand, flags=re.IGNORECASE).strip()
        cand_low = cand.lower()
        generic_nouns = {"leave", "a leave", "leave application", "leave request", "outpass", "outing"}
        if cand and len(cand) >= 3 and cand_low not in generic_nouns and not re.fullmatch(r"(?:today|tomorrow|yesterday|leave\b.*)", cand_low):
            reason = cand[0].upper() + cand[1:] if len(cand) > 1 else cand.upper()

    return {
        "from_date": from_date.isoformat() if from_date else None,
        "from_time": from_time,
        "to_date": to_date.isoformat() if to_date else None,
        "to_time": to_time,
        "from_day": from_date.strftime("%A") if from_date else None,
        "to_day": to_date.strftime("%A") if to_date else None,
        "category": category,
        "reason": reason,
    }


def resolve_public_base_url(request: Optional[Request] = None) -> str:
    """Resolve frontend origin for leave verification QR URLs."""
    configured = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    if configured:
        return configured
    if request is not None:
        origin = (request.headers.get("origin") or "").strip().rstrip("/")
        if origin and origin.startswith(("http://", "https://")):
            return origin
        referer = (request.headers.get("referer") or "").strip()
        if referer.startswith(("http://", "https://")):
            parts = referer.split("/")
            if len(parts) >= 3:
                return f"{parts[0]}//{parts[2]}"
        forwarded_host = (request.headers.get("x-forwarded-host") or "").strip()
        forwarded_proto = (request.headers.get("x-forwarded-proto") or "https").strip()
        if forwarded_host and ":8000" not in forwarded_host:
            return f"{forwarded_proto}://{forwarded_host}".rstrip("/")
    return (settings.FRONTEND_BASE_URL or "http://localhost:3000").strip().rstrip("/")
