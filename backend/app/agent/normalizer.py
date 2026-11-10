import re
from typing import Optional
from app.agent.goal import Goal

class GoalNormalizer:
    def normalize(self, student_id: str, goal_text: str) -> Goal:
        text = goal_text.strip()
        text_lower = text.lower()
        
        # 1. Goal type detection (Campus services)
        if any(kw in text_lower for kw in ["leave", "absence", "sick", "vacation", "holiday", "permission", "won't be coming", "not coming", "traveling home"]) or "failure_mode" in text_lower:
            goal_type = "LEAVE_APPLICATION"
        else:
            goal_type = "LEAVE_APPLICATION"  # Default workflow in Phase 3
            
        parameters = {}
        
        # 2. Failure simulation detection
        failure_match = re.search(r"failure_mode=([a-zA-Z0-9_]+)", text, re.IGNORECASE)
        if failure_match:
            parameters["failure_mode"] = failure_match.group(1).lower()
        elif "invalid parameters" in text_lower or "schema validation" in text_lower:
            parameters["failure_mode"] = "schema_validation_error"
        
        # Cross-domain hostel service coordination
        if "hostel" in text_lower and ("night out" in text_lower or "pass" in text_lower or "room" in text_lower):
            parameters["includes_hostel"] = True
            
        # Conflict / duplicate active request detection
        if ("previous" in text_lower or "another" in text_lower) and "pending" in text_lower:
            parameters["check_concurrent_conflict"] = True
        
        # 3. Days extraction (supporting negative numbers for validation checks)
        days_match = re.search(r"(-?\d+)\s*(?:day|days)", text_lower)
        if days_match:
            parameters["days"] = int(days_match.group(1))
        elif "week" in text_lower:
            parameters["days"] = 5
        else:
            parameters["days"] = 1
            
        # 4. Reason extraction
        if parameters.get("check_concurrent_conflict"):
            parameters["reason"] = "concurrent active request pending"
            parameters["category"] = "personal"
        elif "family function" in text_lower or "diwali" in text_lower or "traveling home" in text_lower:
            parameters["reason"] = "family function"
            parameters["category"] = "family_emergency" if "emergency" in text_lower else "personal"
        elif "medical" in text_lower or "fever" in text_lower or "sick" in text_lower:
            parameters["reason"] = "medical reasons"
            parameters["category"] = "medical"
        else:
            reason_match = re.search(r"(?:because|due to|reason\s*[:=]|for reason)\s+([^.,;]+)", text_lower)
            if reason_match:
                extracted = reason_match.group(1).strip()
                extracted = re.sub(r"^(?:i\s+have\s+a|i\s+have|a)\s+", "", extracted).strip()
                parameters["reason"] = extracted
                parameters["category"] = "medical" if any(w in extracted.lower() for w in ["sick", "fever", "illness", "hospital"]) else "personal"
            elif "failure_mode" in text_lower:
                parameters["reason"] = "simulated diagnostic test"
                parameters["category"] = "personal"
            else:
                parameters["reason"] = "personal leave"
                parameters["category"] = "personal"
                
        return Goal(
            goal_type=goal_type,
            student_id=student_id,
            parameters=parameters,
            constraints=[]
        )
