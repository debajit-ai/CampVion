import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.db.database import get_db
from app.db import models

router = APIRouter()

@router.get("/")
def list_policies(category: Optional[str] = None, db: Session = Depends(get_db)):
    """
    List all university policies with category, provenance type, and version.
    """
    query = db.query(models.CampusPolicy)
    if category:
        query = query.filter(models.CampusPolicy.category == category)
    policies = query.all()
    
    return [
        {
            "policy_id": p.policy_id,
            "title": p.title,
            "category": p.category,
            "description": p.description,
            "rule_conditions": json.loads(p.rule_conditions),
            "applicable_groups": json.loads(p.applicable_groups),
            "effective_date": p.effective_date,
            "expiry_date": p.expiry_date,
            "source_document": p.source_document,
            "provenance_type": p.provenance_type,
            "verification_status": p.verification_status,
            "version": p.version,
            "chunk_count": len(p.chunks)
        }
        for p in policies
    ]

@router.get("/{policy_id}")
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    """
    Retrieve full policy detail including RAG-ready knowledge chunks.
    """
    policy = db.query(models.CampusPolicy).filter(models.CampusPolicy.policy_id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail={"code": "POLICY_NOT_FOUND", "message": f"Policy {policy_id} was not found"})
    
    return {
        "policy_id": policy.policy_id,
        "title": policy.title,
        "category": policy.category,
        "description": policy.description,
        "rule_conditions": json.loads(policy.rule_conditions),
        "applicable_groups": json.loads(policy.applicable_groups),
        "effective_date": policy.effective_date,
        "expiry_date": policy.expiry_date,
        "source_document": policy.source_document,
        "provenance_type": policy.provenance_type,
        "verification_status": policy.verification_status,
        "version": policy.version,
        "chunks": [
            {
                "chunk_index": c.chunk_index,
                "title": c.title,
                "content_text": c.content_text,
                "metadata": json.loads(c.metadata_json),
                "source_reference": c.source_reference,
                "token_count": c.token_count
            }
            for c in policy.chunks
        ]
    }

