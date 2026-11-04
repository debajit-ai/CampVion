import json
from typing import List, Dict, Any

# =============================================================================
# CAMPVION UNIVERSITY KNOWLEDGE BASE & POLICY SPECIFICATIONS
# Note: In accordance with project instructions, all demo policies are clearly
# labeled with provenance_type="illustrative_demo" and can be replaced with
# verified institutional policies via administrative updates.
# =============================================================================

POLICIES_DATA: List[Dict[str, Any]] = [
    {
        "policy_id": "POL-ATT-001",
        "title": "Minimum Academic Attendance and Eligibility Regulation",
        "category": "attendance",
        "description": "Establishes mandatory 75% attendance threshold across all registered courses for examination eligibility and automated service approvals.",
        "rule_conditions": {
            "min_percentage_for_exam": 75.0,
            "min_percentage_for_leave": 75.0,
            "condonation_threshold": 65.0,
            "condonation_authority": "Dean of Academic Affairs",
            "condonation_fee_inr": 1500,
            "debarment_threshold": 65.0
        },
        "applicable_groups": ["undergraduate", "postgraduate", "diploma"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Academic Handbook 2025-26, Section 4.2 (Attendance & Condonation)",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.2",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Attendance Requirement Overview",
                "content_text": "Every registered student must maintain a minimum attendance of 75% in each course to be eligible to appear for the end-term university examinations and to qualify for standard student leave requests.",
                "metadata": {"section": "4.2.1", "scope": "mandatory"}
            },
            {
                "chunk_index": 1,
                "title": "Attendance Shortage & Condonation",
                "content_text": "Students with attendance between 65% and 74.99% may apply for attendance condonation on verified medical or sports participation grounds through the Dean of Academic Affairs upon payment of the prescribed administrative fee.",
                "metadata": {"section": "4.2.2", "scope": "condonation"}
            }
        ]
    },
    {
        "policy_id": "POL-ATT-002",
        "title": "Medical Attendance Compensation and Hospitalization Policy",
        "category": "attendance",
        "description": "Regulates academic attendance credits granted during periods of documented illness or hospitalization.",
        "rule_conditions": {
            "max_attendance_credit_percent": 10.0,
            "min_hospitalization_days": 2,
            "document_required": "Chief Medical Officer (CMO) Endorsed Certificate",
            "submission_deadline_days": 7
        },
        "applicable_groups": ["undergraduate", "postgraduate", "hostel_residents", "day_scholars"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Student Welfare Regulations 2025-26, Clause 8.1",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.1",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Medical Leave Credit Guidelines",
                "content_text": "Attendance credit up to a maximum of 10% may be granted for prolonged illness or hospitalization, provided original certificates are submitted to the university medical officer within 7 calendar days of resuming classes.",
                "metadata": {"section": "8.1.1", "max_compensation": "10%"}
            }
        ]
    },
    {
        "policy_id": "POL-LV-001",
        "title": "Student Casual and Personal Leave Approval Hierarchy",
        "category": "leave",
        "description": "Defines approval delegation levels and documentary requirements based on leave duration and justification.",
        "rule_conditions": {
            "tier_1_max_days": 3,
            "tier_1_approver": "Faculty Advisor",
            "tier_2_min_days": 4,
            "tier_2_approver": "Head of Department (HOD)",
            "tier_3_exceeding_days": 7,
            "tier_3_approver": "Proctor / Dean Student Welfare",
            "min_attendance_threshold": 75.0,
            "advance_notice_days": 1
        },
        "applicable_groups": ["undergraduate", "postgraduate"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Campus Operations Manual 2025, Chapter 3 (Leave Protocols)",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "2.0",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Personal Leave Delegation Tier 1",
                "content_text": "Short-term personal leaves of up to three (3) consecutive working days require approval solely from the designated Faculty Advisor, subject to meeting the 75% attendance threshold.",
                "metadata": {"tier": 1, "duration": "<=3 days", "approver": "Advisor"}
            },
            {
                "chunk_index": 1,
                "title": "Personal Leave Delegation Tier 2",
                "content_text": "Leaves spanning more than three (3) working days require formal endorsement from the Head of Department (HOD). Leaves exceeding seven (7) days must be approved by the Proctor.",
                "metadata": {"tier": 2, "duration": ">3 days", "approver": "HOD"}
            }
        ]
    },
    {
        "policy_id": "POL-LV-002",
        "title": "Emergency Medical and Bereavement Leave Protocol",
        "category": "leave",
        "description": "Procedures for sanctioning unscheduled emergency absence due to acute illness or family emergencies.",
        "rule_conditions": {
            "retroactive_application_allowed": True,
            "filing_window_hours": 72,
            "supporting_doc_mandatory": True,
            "approver_role": "Proctor & Dean Student Welfare"
        },
        "applicable_groups": ["all_students"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Student Emergency Guidelines 2025-26",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.0",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Emergency Leave Filing Window",
                "content_text": "In emergency circumstances, leave applications can be lodged retroactively within 72 hours of the occurrence. A valid medical prescription, hospital admission slip, or family notification must accompany the application.",
                "metadata": {"category": "emergency", "window": "72 hours"}
            }
        ]
    },
    {
        "policy_id": "POL-HST-001",
        "title": "Hostel Residency, Gate Pass and Night Curfew Regulations",
        "category": "hostel",
        "description": "Governs entry/exit timings, night-out leave passes, and biometric verification for residential students.",
        "rule_conditions": {
            "curfew_time_weekday": "21:30",
            "curfew_time_weekend": "22:00",
            "night_pass_cutoff_time": "18:00",
            "parent_consent_required": True,
            "warden_approval_required": True,
            "fine_for_late_entry_inr": 500
        },
        "applicable_groups": ["hostel_residents"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Hostel Code of Conduct 2025, Rule 11",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.3",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Night Out Pass Authorization",
                "content_text": "Hostel residents desiring overnight leave must submit an electronic Night Pass application before 6:00 PM on the day of departure. Approval is granted by the Chief Warden following automated parental SMS confirmation.",
                "metadata": {"service": "night_pass", "cutoff": "18:00"}
            }
        ]
    },
    {
        "policy_id": "POL-HST-002",
        "title": "Hostel Room Allocation, Transfer & Maintenance SLA",
        "category": "hostel",
        "description": "Service level agreements for hostel room complaints, electrical/plumbing repairs, and room change windows.",
        "rule_conditions": {
            "maintenance_sla_hours_emergency": 4,
            "maintenance_sla_hours_routine": 24,
            "room_change_window": "First 15 days of academic semester",
            "room_transfer_fee_inr": 2000
        },
        "applicable_groups": ["hostel_residents"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Hostel Administration & Facilities Standard Operating Procedures 2025",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.0",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Hostel Maintenance SLAs",
                "content_text": "Hostel maintenance requests are resolved under strict SLAs: electrical or water outages within 4 hours, and routine carpentry or painting within 24 hours.",
                "metadata": {"emergency_sla": "4h", "routine_sla": "24h"}
            }
        ]
    },
    {
        "policy_id": "POL-FEE-001",
        "title": "Semester Tuition Fee Payment, Installment & Clearance Policy",
        "category": "financial",
        "description": "Details billing deadlines, late fee escalation schedules, and exam clearance no-dues requirements.",
        "rule_conditions": {
            "late_fine_tier_1_days": 7,
            "late_fine_tier_1_inr": 1000,
            "late_fine_tier_2_days": 15,
            "late_fine_tier_2_inr": 2500,
            "debarment_deadline_days": 30,
            "no_dues_required_for_exam": True
        },
        "applicable_groups": ["all_students"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Finance Office Circular FN/2025/03",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.1",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Fee Payment Deadlines & No-Dues",
                "content_text": "All semester fees must be paid on or before the published due date. An outstanding balance exceeding zero at the end of the 30-day grace period blocks examination hall ticket download and official transcript issuance.",
                "metadata": {"grace_period": "30 days", "penalty": "hall_ticket_block"}
            }
        ]
    },
    {
        "policy_id": "POL-FEE-002",
        "title": "Merit and Need-Based Scholarship Continuation Criteria",
        "category": "financial",
        "description": "Academic benchmarks required to maintain tuition fee waivers and scholarship disbursements.",
        "rule_conditions": {
            "min_cgpa_maintenance": 8.0,
            "min_attendance_maintenance": 75.0,
            "disciplinary_clearance_required": True,
            "annual_renewal_month": "July"
        },
        "applicable_groups": ["scholarship_recipients"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Scholarship Guidelines 2025-26, Annexure A",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.0",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Scholarship Eligibility Continuation",
                "content_text": "Students holding merit scholarships must maintain a minimum CGPA of 8.0 without any active backlogs and attend at least 75% of scheduled lectures to retain tuition concessions for the subsequent academic year.",
                "metadata": {"min_cgpa": 8.0, "min_attendance": 75.0}
            }
        ]
    },
    {
        "policy_id": "POL-ACAD-001",
        "title": "Course Registration, Credit Limits and Drop-Add Window",
        "category": "academic",
        "description": "Rules governing minimum/maximum semester credit loads and subject registration changes.",
        "rule_conditions": {
            "min_credits_per_semester": 18,
            "max_credits_per_semester": 28,
            "drop_add_window_days": 10,
            "withdrawal_penalty_after_days": 30
        },
        "applicable_groups": ["undergraduate", "postgraduate"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Academic Regulations Ordinance 2025",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "2.1",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Credit Load Limits",
                "content_text": "Students are required to register for a minimum of 18 credits and a maximum of 28 credits per semester. Overloading beyond 28 credits requires prior written consent from the Dean.",
                "metadata": {"min_credits": 18, "max_credits": 28}
            }
        ]
    },
    {
        "policy_id": "POL-SUP-001",
        "title": "Campus Support Services, IT Helpdesk & Grievance Redressal SLA",
        "category": "support",
        "description": "Service level agreements and escalation mechanisms for IT issues, library queries, transport, and student grievances.",
        "rule_conditions": {
            "p1_critical_sla_hours": 4,
            "p2_medium_sla_hours": 24,
            "p3_low_sla_hours": 72,
            "escalation_level_1": "Helpdesk Officer",
            "escalation_level_2": "Campus Operations Manager",
            "escalation_level_3": "Registrar"
        },
        "applicable_groups": ["all_students", "faculty", "staff"],
        "effective_date": "2025-08-01",
        "expiry_date": None,
        "source_document": "Service Quality Charter 2025",
        "provenance_type": "illustrative_demo",
        "verification_status": "verified",
        "version": "1.0",
        "chunks": [
            {
                "chunk_index": 0,
                "title": "Service Request Turnaround Time",
                "content_text": "Critical issues (e.g., student portal login failure on exam day) are resolved within 4 hours. General queries (e.g., ID card replacement, bus route inquiries) are processed within 24 to 72 business hours.",
                "metadata": {"p1": "4h", "p2": "24h", "p3": "72h"}
            }
        ]
    }
]

