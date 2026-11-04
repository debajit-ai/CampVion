"""
CampVion LLM Management API Routes
Provides endpoints for inspecting LLM provider health, telemetry,
and testing natural language interpretation without exposing API credentials.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from app.core.config import settings
from app.llm.factory import get_llm_provider
from app.llm.intent_interpreter import NaturalLanguageIntentInterpreter

router = APIRouter()

class InterpretRequest(BaseModel):
    student_id: str = Field(..., description="University Student ID (e.g. S001)")
    request_text: str = Field(..., description="Student natural language request", max_length=2000)

@router.get("/status")
async def get_llm_status():
    """
    Retrieve LLM provider configuration, health status, and aggregated telemetry.
    Secrets and API keys are strictly masked.
    """
    provider = get_llm_provider()
    health = await provider.check_health()
    metrics = provider.get_metrics()

    return {
        "provider": provider.provider_name,
        "model": provider.model,
        "masked_api_key": provider.mask_api_key(),
        "is_cloud_provider": provider.provider_name in ["gemini", "openai", "groq", "openrouter"],
        "is_configured": provider.api_key is not None or provider.provider_name in ["mock", "ollama"],
        "health": health.model_dump(),
        "telemetry": metrics,
        "limits": {
            "max_input_length": provider.max_input_length,
            "max_output_tokens": provider.max_output_tokens,
            "timeout_seconds": provider.timeout_seconds,
            "temperature": provider.temperature
        },
        "supported_providers": ["groq (primary)", "gemini", "openai", "mock", "ollama (optional adapter)"]
    }

@router.post("/test-connection")
async def test_llm_connection():
    """
    Execute a lightweight connectivity probe against the active LLM provider.
    """
    provider = get_llm_provider()
    health = await provider.check_health()
    return {
        "provider": provider.provider_name,
        "model": provider.model,
        "health": health.model_dump()
    }

@router.post("/interpret")
async def interpret_natural_language(req: InterpretRequest):
    """
    Parse a student natural language message into a structured Campus Goal.
    Uses cost-conscious fast-path for deterministic diagnostic queries.
    Detects ambiguity and generates clarification questions when necessary.
    """
    interpreter = NaturalLanguageIntentInterpreter()
    result = await interpreter.interpret(student_id=req.student_id, raw_text=req.request_text)
    
    if not result.success:
        return {
            "success": False,
            "student_id": req.student_id,
            "original_text": req.request_text,
            "error_message": result.error_message,
            "user_friendly_message": result.user_friendly_message,
            "provider_name": result.provider_name,
            "latency_ms": result.latency_ms
        }

    return {
        "success": True,
        "student_id": req.student_id,
        "goal": result.goal.model_dump() if result.goal else None,
        "needs_clarification": result.needs_clarification,
        "clarification_question": result.clarification_question,
        "missing_information": result.missing_information,
        "used_llm": result.used_llm,
        "provider_name": result.provider_name,
        "latency_ms": result.latency_ms,
        "usage": result.usage.model_dump() if result.usage else None
    }

