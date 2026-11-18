"""
Public Colleges Directory & Input Sanitization Helpers.
Loads backend/app/data/colleges.json once (cached in memory) with Lovely Professional University (LPU)
featured first, plus fast case-insensitive search by name, acronym, city, or state.
"""

from functools import lru_cache
import html
import json
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Response

router = APIRouter()

DEFAULT_COLLEGE = "Lovely Professional University"
OTHER_OPTION_LABEL = "Other (type your college name)"
_DATA_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "colleges.json")
)


def sanitize_college_name(raw_college: Optional[str], fallback: Optional[str] = DEFAULT_COLLEGE) -> Optional[str]:
    """Sanitize free-text or selected college name (strip tags/controls, max 120 chars)."""
    if raw_college is None:
        return fallback
    text = html.unescape(str(raw_college))
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[\r\n\t\x00-\x1f\x7f]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    if not text or text.lower() == OTHER_OPTION_LABEL.lower():
        return fallback
    return text[:120]


@lru_cache(maxsize=1)
def load_colleges() -> List[Dict[str, Any]]:
    with open(_DATA_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    # Guarantee LPU stays first as featured default
    featured = [c for c in data if c.get("featured")]
    others = [c for c in data if not c.get("featured")]
    return featured + others


@router.get("")
@router.get("/", include_in_schema=False)
def search_colleges(
    response: Response,
    q: Optional[str] = Query(default=None, max_length=100, description="Filter by college name, short code, city, or state"),
    limit: int = Query(default=150, ge=1, le=200),
) -> Dict[str, Any]:
    """Public cached list/search of Indian colleges & universities (LPU featured at top)."""
    response.headers["Cache-Control"] = "public, max-age=3600"
    colleges = load_colleges()

    needle = (q or "").strip().lower()
    if needle:
        prefix_matches: List[Dict[str, Any]] = []
        substring_matches: List[Dict[str, Any]] = []
        for item in colleges:
            name = item.get("name", "")
            short = item.get("short", "")
            city = item.get("city", "")
            state = item.get("state", "")
            combined = f"{name} {short} {city} {state}".lower()
            if needle in combined:
                if name.lower().startswith(needle) or short.lower().startswith(needle):
                    prefix_matches.append(item)
                else:
                    substring_matches.append(item)
        matched = prefix_matches + substring_matches
    else:
        matched = colleges

    return {
        "items": matched[:limit],
        "total": len(matched),
        "default_college": DEFAULT_COLLEGE,
        "other_option": OTHER_OPTION_LABEL,
    }
