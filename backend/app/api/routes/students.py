from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.db.database import get_db
from app.services import student_service
from app.schemas import student as schemas
from app.db import models

router = APIRouter()

@router.get("/", response_model=List[schemas.StudentResponse])
def get_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return student_service.get_students(db, skip=skip, limit=limit)

@router.get("/{student_id}", response_model=schemas.StudentResponse)
def get_student(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    return student

@router.get("/{student_id}/attendance", response_model=List[schemas.AttendanceRecordResponse])
def get_student_attendance(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    return student_service.get_student_attendance(db, student_id=student_id)

@router.get("/{student_id}/courses", response_model=List[schemas.CourseResponse])
def get_student_courses(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    return student_service.get_student_courses(db, student_id=student_id)

@router.get("/{student_id}/academic-summary")
def get_student_academic_summary(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    
    # Calculate attendance summary
    attendance_records = student_service.get_student_attendance(db, student_id)
    total_att = sum(r.attended_classes for r in attendance_records)
    total_cls = sum(r.total_classes for r in attendance_records)
    overall_att_pct = round((total_att / total_cls * 100), 2) if total_cls > 0 else 100.0

    return {
        "student_id": student.student_id,
        "name": student.name,
        "email": student.email,
        "program": student.program,
        "semester": student.semester,
        "department": getattr(student, "department", "School of Computer Science & Engineering"),
        "academic_year": getattr(student, "academic_year", (student.semester + 1) // 2),
        "section": getattr(student, "section", "K21CS"),
        "enrollment_status": getattr(student, "enrollment_status", "active"),
        "advisor_name": getattr(student, "advisor_name", "Dr. Rajesh Rao"),
        "advisor_email": getattr(student, "advisor_email", "rajesh.rao@lpu.edu"),
        "residence_type": getattr(student, "residence_type", "hostel"),
        "overall_attendance_percentage": overall_att_pct,
        "enrolled_courses_count": len(attendance_records)
    }

@router.get("/{student_id}/hostel")
def get_student_hostel_info(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    
    alloc = db.query(models.HostelAllocation).filter(models.HostelAllocation.student_id == student_id).first()
    if not alloc:
        return {
            "student_id": student_id,
            "is_resident": False,
            "residence_type": getattr(student, "residence_type", "day_scholar")
        }
    
    recent_requests = db.query(models.HostelRequest).filter(models.HostelRequest.student_id == student_id).all()
    return {
        "student_id": student_id,
        "is_resident": True,
        "hostel_name": alloc.hostel_name,
        "block": alloc.block,
        "room_number": alloc.room_number,
        "bed_number": alloc.bed_number,
        "warden_name": alloc.warden_name,
        "warden_contact": alloc.warden_contact,
        "status": alloc.status,
        "recent_requests_count": len(recent_requests)
    }

@router.get("/{student_id}/fees")
def get_student_fees_info(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    
    fee_acc = db.query(models.FeeAccount).filter(models.FeeAccount.student_id == student_id).first()
    scholarship = db.query(models.ScholarshipRecord).filter(models.ScholarshipRecord.student_id == student_id).first()
    txns = db.query(models.FeeTransaction).filter(models.FeeTransaction.student_id == student_id).all()
    
    total = fee_acc.total_fees if fee_acc else 120000
    paid = fee_acc.paid_amount if fee_acc else 120000
    balance = fee_acc.outstanding_balance if fee_acc else 0
    status = fee_acc.status if fee_acc else "cleared"
    due_date = fee_acc.due_date if fee_acc else "2026-11-30"

    return {
        "student_id": student_id,
        "total_fees": total,
        "paid_amount": paid,
        "outstanding_balance": balance,
        "status": status,
        "due_date": due_date,
        "scholarship": {
            "name": scholarship.scholarship_name,
            "amount_per_semester": scholarship.amount_per_semester,
            "criteria": scholarship.eligibility_criteria
        } if scholarship else None,
        "transactions_count": len(txns)
    }

@router.get("/{student_id}/tickets")
def get_student_support_tickets(student_id: str, db: Session = Depends(get_db)):
    student = student_service.get_student_by_id(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student was not found"})
    
    tickets = db.query(models.SupportTicket).filter(models.SupportTicket.student_id == student_id).all()
    return [
        {
            "ticket_number": t.ticket_number,
            "category": t.category,
            "subject": t.subject,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "assigned_team": t.assigned_team,
            "created_at": t.created_at.isoformat() if t.created_at else None
        }
        for t in tickets
    ]
