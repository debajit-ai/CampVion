"""
CampVion — Live Groq Cloud API End-to-End Test Suite
Executes real authenticated requests to Groq Cloud API using GROQ_API_KEY from backend/.env.
Distinguished from hermetic/mocked tests.
"""

import pytest
import groq
from app.core.config import settings
from app.llm.groq_provider import GroqCloudProvider
from app.llm.intent_interpreter import NaturalLanguageIntentInterpreter, InterpretedGoalSchema
from app.agent.agent import AXORAAgent

# Skip all tests in this file if GROQ_API_KEY is not configured
pytestmark = pytest.mark.skipif(
    not settings.effective_llm_api_key,
    reason="Live Groq tests require GROQ_API_KEY in backend/.env"
)

def test_live_groq_model_catalog_and_availability():
    """Live API Test: Query Groq models.list() and confirm active model status."""
    client = groq.Groq(api_key=settings.effective_llm_api_key)
    models = client.models.list()
    model_ids = [m.id for m in models.data]

    assert len(model_ids) > 0
    assert settings.effective_llm_model in model_ids

    active_model = next(m for m in models.data if m.id == settings.effective_llm_model)
    assert getattr(active_model, "active", True) is True

@pytest.mark.anyio
async def test_live_groq_health_and_authentication():
    """Live API Test: Authenticated health probe against Groq LPU."""
    provider = GroqCloudProvider(
        api_key=settings.effective_llm_api_key,
        model=settings.effective_llm_model
    )
    health = await provider.check_health()
    assert health.status == "healthy"
    assert health.is_available is True
    assert health.latency_ms is not None
    assert health.latency_ms > 0

@pytest.mark.anyio
async def test_live_groq_structured_intent_extraction():
    """Live API Test: Extract structured intent from standard student request."""
    provider = GroqCloudProvider(
        api_key=settings.effective_llm_api_key,
        model=settings.effective_llm_model
    )
    interpreter = NaturalLanguageIntentInterpreter(provider=provider)

    result = await interpreter.interpret("S001", "I want to apply for medical leave for five days.")
    assert result.success is True
    assert result.used_llm is True
    assert result.provider_name == "groq"
    assert result.goal is not None
    assert result.goal.goal_type == "LEAVE_APPLICATION"
    assert result.goal.parameters.get("days") == 5
    assert result.goal.parameters.get("category") == "medical"
    assert result.needs_clarification is False
    assert result.usage is not None
    assert result.usage.total_tokens > 0

@pytest.mark.anyio
async def test_live_groq_ambiguity_and_clarification_question():
    """Live API Test: Detect missing information on incomplete prompt and generate clarification."""
    provider = GroqCloudProvider(
        api_key=settings.effective_llm_api_key,
        model=settings.effective_llm_model
    )
    interpreter = NaturalLanguageIntentInterpreter(provider=provider)

    result = await interpreter.interpret("S001", "I need medical leave.")
    assert result.success is True
    assert result.used_llm is True
    assert result.needs_clarification is True
    assert result.clarification_question is not None
    assert len(result.clarification_question) > 10
    assert len(result.missing_information) > 0

def test_live_groq_deterministic_agent_handshake(db):
    """Live API Test: Feed live Groq intent into deterministic Kahn topological DAG."""
    agent = AXORAAgent(db)
    
    # S001 is eligible (75% attendance) -> must pause at approval gate
    res_s1 = agent.start("S001", "I want to apply for medical leave for five days.")
    assert res_s1.status == "WAITING_FOR_HUMAN"
    
    # S002 is ineligible (50% attendance) -> must be rejected by deterministic policy
    res_s2 = agent.start("S002", "I want to apply for medical leave for five days.")
    assert res_s2.status == "FAILED"
    assert "75%" in res_s2.final_message

