"""
CampVion Cloud-First LLM Architecture & Provider Tests
Validates modular provider abstraction, cloud API integrations (Gemini, OpenAI),
Ollama optional adapter safety, token limits, rate limit handling, input validation,
telemetry, and failure recovery.
"""

import pytest
import json
import httpx
from unittest.mock import patch, MagicMock, AsyncMock
from pydantic import BaseModel

from app.llm import (
    BaseLLMProvider,
    LLMMessage,
    LLMResponse,
    UsageMetrics,
    ProviderHealthStatus,
    GroqCloudProvider,
    GeminiCloudProvider,
    OpenAICloudProvider,
    OllamaProvider,
    MockLLMProvider,
    get_llm_provider,
    NaturalLanguageIntentInterpreter,
    InterpretedGoalSchema,
    InterpretationResult,
    LLMProviderError,
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMQuotaExhaustedError,
    LLMTimeoutError,
    LLMNetworkError,
    LLMValidationError,
    LLMInputLengthExceededError
)

# =============================================================================
# 1. BASE PROVIDER & TELEMETRY TESTS
# =============================================================================
def test_provider_key_masking():
    """Verify that sensitive API keys are masked and never exposed in telemetry."""
    provider = GeminiCloudProvider(api_key="AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz", model="gemini-1.5-flash")
    masked = provider.mask_api_key()
    assert masked == "AIza...WxYz"
    assert "SyAbCdEfGhIjKlMnOpQrStUv" not in masked

    unconfigured = GeminiCloudProvider(api_key=None)
    assert unconfigured.mask_api_key() == "NOT_CONFIGURED"

def test_provider_input_length_guardrail():
    """Verify that inputs exceeding max_input_length are blocked prior to network call."""
    provider = MockLLMProvider(max_input_length=100)
    huge_message = [LLMMessage(role="user", content="A" * 150)]

    with pytest.raises(LLMInputLengthExceededError) as exc_info:
        provider.validate_input(huge_message)

    assert exc_info.value.char_count == 150
    assert exc_info.value.max_chars == 100
    assert "exceeds limit" in exc_info.value.message

def test_provider_telemetry_metrics():
    """Verify runtime metric tracking (requests, tokens, latency)."""
    provider = MockLLMProvider()
    metrics_initial = provider.get_metrics()
    assert metrics_initial["total_requests"] == 0

    provider.record_metrics(success=True, latency_ms=45.0, usage=UsageMetrics(prompt_tokens=10, completion_tokens=5, total_tokens=15))
    provider.record_metrics(success=False, latency_ms=10.0)

    metrics = provider.get_metrics()
    assert metrics["total_requests"] == 2
    assert metrics["successful_requests"] == 1
    assert metrics["failed_requests"] == 1
    assert metrics["total_tokens"] == 15
    assert metrics["average_latency_ms"] == 27.5

# =============================================================================
# 1B. GROQ CLOUD PROVIDER TESTS (PRIMARY PROVIDER)
# =============================================================================
def test_groq_key_masking():
    """Verify Groq key prefix masking (gsk_...)."""
    provider = GroqCloudProvider(api_key="gsk_1234567890abcdefghijklmnopqrstuv", model="llama-3.3-70b-versatile")
    masked = provider.mask_api_key()
    assert masked.startswith("gsk_")
    assert "abcdefghijkl" not in masked
    assert masked.endswith("stuv")

    unconfigured = GroqCloudProvider(api_key=None)
    assert unconfigured.mask_api_key() == "NOT_CONFIGURED"

@pytest.mark.anyio
async def test_groq_unconfigured_initialization_and_health_check():
    """Verify unconfigured Groq provider reports unconfigured without crashing."""
    provider = GroqCloudProvider(api_key=None)
    health = await provider.check_health()
    assert health.status == "unconfigured"
    assert health.is_available is False
    assert "GROQ_API_KEY is not configured" in health.error_message

@pytest.mark.anyio
async def test_groq_missing_api_key_generate_error():
    """Verify attempt to generate without API key raises LLMAuthenticationError."""
    provider = GroqCloudProvider(api_key=None)
    with pytest.raises(LLMAuthenticationError) as exc_info:
        await provider.generate([LLMMessage(role="user", content="hello")])
    assert "GROQ_API_KEY is not configured" in exc_info.value.message

@pytest.mark.anyio
async def test_groq_mocked_structured_generation():
    """Verify Groq structured intent extraction with mocked chat completion."""
    provider = GroqCloudProvider(api_key="gsk_mock_test_key", model="llama-3.3-70b-versatile")

    mock_chat_completion = MagicMock()
    mock_chat_completion.id = "chatcmpl_groq_123"
    choice = MagicMock()
    choice.finish_reason = "stop"
    choice.message.content = json.dumps({
        "goal_type": "LEAVE_APPLICATION",
        "days": 3,
        "category": "medical",
        "reason": "Severe migraine and fever",
        "is_ambiguous": False,
        "missing_information": [],
        "clarification_question": None,
        "confidence": 0.99
    })
    mock_chat_completion.choices = [choice]
    mock_chat_completion.usage.prompt_tokens = 45
    mock_chat_completion.usage.completion_tokens = 30
    mock_chat_completion.usage.total_tokens = 75

    mock_async_client = MagicMock()
    mock_async_client.chat.completions.create = AsyncMock(return_value=mock_chat_completion)

    with patch.object(provider, "_get_client", return_value=mock_async_client):
        messages = [LLMMessage(role="user", content="I need 3 days sick leave for severe migraine and fever.")]
        goal_data, raw_resp = await provider.generate_structured(messages, schema=InterpretedGoalSchema)

        assert isinstance(goal_data, InterpretedGoalSchema)
        assert goal_data.goal_type == "LEAVE_APPLICATION"
        assert goal_data.days == 3
        assert goal_data.category == "medical"
        assert "migraine" in goal_data.reason
        assert goal_data.is_ambiguous is False
        assert raw_resp.usage.prompt_tokens == 45
        assert raw_resp.usage.completion_tokens == 30
        assert raw_resp.usage.total_tokens == 75

@pytest.mark.anyio
async def test_groq_rate_limit_backoff_handling():
    """Verify Groq rate limit retry backoff and eventual exhaustion error."""
    import groq
    provider = GroqCloudProvider(api_key="gsk_mock_test_key", max_retries=1)

    mock_async_client = MagicMock()
    # Simulate persistent RateLimitError
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 429
    mock_response.headers = {}
    mock_async_client.chat.completions.create = AsyncMock(
        side_effect=groq.RateLimitError(
            message="Rate limit reached",
            response=mock_response,
            body={"error": {"message": "Rate limit reached"}}
        )
    )

    with patch.object(provider, "_get_client", return_value=mock_async_client):
        with pytest.raises(LLMRateLimitError) as exc_info:
            await provider.generate([LLMMessage(role="user", content="ping")])
        assert "rate limit exceeded" in exc_info.value.message.lower()

@pytest.mark.anyio
async def test_groq_ambiguity_and_clarification_generation():
    """Verify missing information detection and clarification question generation."""
    provider = GroqCloudProvider(api_key="gsk_mock_test_key", model="llama-3.3-70b-versatile")

    mock_chat_completion = MagicMock()
    mock_chat_completion.id = "chatcmpl_groq_456"
    choice = MagicMock()
    choice.finish_reason = "stop"
    choice.message.content = json.dumps({
        "goal_type": "LEAVE_APPLICATION",
        "days": 1,
        "category": "personal",
        "reason": "unspecified",
        "is_ambiguous": True,
        "missing_information": ["days", "reason"],
        "clarification_question": "How many days of leave would you like to apply for, and what is the reason for your leave?",
        "confidence": 0.50
    })
    mock_chat_completion.choices = [choice]
    mock_chat_completion.usage.prompt_tokens = 30
    mock_chat_completion.usage.completion_tokens = 25
    mock_chat_completion.usage.total_tokens = 55

    mock_async_client = MagicMock()
    mock_async_client.chat.completions.create = AsyncMock(return_value=mock_chat_completion)

    with patch.object(provider, "_get_client", return_value=mock_async_client):
        interpreter = NaturalLanguageIntentInterpreter(provider=provider)
        res = await interpreter.interpret("S001", "I need to take leave.")

        assert res.success is True
        assert res.needs_clarification is True
        assert "How many days" in res.clarification_question
        assert "days" in res.missing_information

def test_factory_groq_provider_resolution():
    """Verify that factory yields GroqCloudProvider when provider is groq."""
    provider = get_llm_provider("groq", api_key="gsk_factory_test", model="llama-3.3-70b-versatile")
    assert isinstance(provider, GroqCloudProvider)
    assert provider.model == "llama-3.3-70b-versatile"
    assert provider.provider_name == "groq"

# =============================================================================
# 2. GEMINI CLOUD PROVIDER TESTS
# =============================================================================
@pytest.mark.anyio
async def test_gemini_unconfigured_health_check():
    """Verify unconfigured Gemini provider reports unconfigured status safely."""
    provider = GeminiCloudProvider(api_key=None)
    health = await provider.check_health()
    assert health.status == "unconfigured"
    assert health.is_available is False
    assert "No API key configured" in health.error_message

@pytest.mark.anyio
async def test_gemini_successful_structured_generation():
    """Verify Gemini structured JSON generation and Pydantic validation."""
    provider = GeminiCloudProvider(api_key="mock-gemini-key", model="gemini-1.5-flash")

    mock_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "goal_type": "LEAVE_APPLICATION",
                                "days": 3,
                                "category": "medical",
                                "reason": "Severe viral fever",
                                "confidence": 0.98
                            })
                        }
                    ],
                    "role": "model"
                },
                "finishReason": "STOP"
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 85,
            "candidatesTokenCount": 35,
            "totalTokenCount": 120
        }
    }

    with patch.object(provider, "_post_with_retry", new=AsyncMock(return_value=mock_gemini_response)):
        messages = [LLMMessage(role="user", content="I need 3 days sick leave due to severe viral fever.")]
        goal_data, raw_resp = await provider.generate_structured(messages, schema=InterpretedGoalSchema)

        assert isinstance(goal_data, InterpretedGoalSchema)
        assert goal_data.goal_type == "LEAVE_APPLICATION"
        assert goal_data.days == 3
        assert goal_data.category == "medical"
        assert "viral fever" in goal_data.reason
        assert raw_resp.usage.prompt_tokens == 85
        assert raw_resp.usage.completion_tokens == 35
        assert raw_resp.usage.total_tokens == 120
        assert raw_resp.usage.estimated_cost_usd > 0

@pytest.mark.anyio
async def test_gemini_quota_exhausted_handling():
    """Verify RESOURCE_EXHAUSTED error translates to clean LLMQuotaExhaustedError."""
    provider = GeminiCloudProvider(api_key="mock-gemini-key")

    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 403
    mock_resp.text = json.dumps({"error": {"status": "RESOURCE_EXHAUSTED", "message": "Quota exceeded"}})

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)):
        with pytest.raises(LLMQuotaExhaustedError) as exc_info:
            await provider._post_with_retry({"test": "payload"})

        assert exc_info.value.status_code == 403
        assert "quota" in exc_info.value.user_friendly_message.lower()

# =============================================================================
# 3. OPENAI CLOUD PROVIDER TESTS
# =============================================================================
@pytest.mark.anyio
async def test_openai_structured_generation():
    """Verify OpenAI-compatible cloud provider parses JSON chat completion."""
    provider = OpenAICloudProvider(api_key="mock-openai-key", model="gpt-4o-mini")

    mock_openai_response = {
        "id": "chatcmpl-123",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "goal_type": "LEAVE_APPLICATION",
                        "days": 2,
                        "category": "personal",
                        "reason": "Family wedding",
                        "confidence": 0.95
                    })
                }
            }
        ],
        "usage": {
            "prompt_tokens": 50,
            "completion_tokens": 25,
            "total_tokens": 75
        }
    }

    with patch.object(provider, "_post_with_retry", new=AsyncMock(return_value=mock_openai_response)):
        messages = [LLMMessage(role="user", content="I want 2 days off for a family wedding.")]
        goal_data, raw_resp = await provider.generate_structured(messages, schema=InterpretedGoalSchema)

        assert goal_data.days == 2
        assert goal_data.category == "personal"
        assert raw_resp.usage.total_tokens == 75

# =============================================================================
# 4. OPTIONAL OLLAMA ADAPTER TESTS
# =============================================================================
@pytest.mark.anyio
async def test_ollama_unreachable_safe_handling():
    """Verify that absent local Ollama does NOT crash backend and reports unavailable status."""
    provider = OllamaProvider(base_url="http://127.0.0.1:11434")

    # Probe check
    health = await provider.check_health()
    assert health.status == "unavailable"
    assert health.is_available is False
    assert "Cloud providers recommended" in health.error_message

# =============================================================================
# 5. NATURAL LANGUAGE INTENT INTERPRETER & COST OPTIMIZATION TESTS
# =============================================================================
@pytest.mark.anyio
async def test_interpreter_deterministic_fast_path():
    """Verify deterministic diagnostic requests bypass cloud LLM to save token costs."""
    interpreter = NaturalLanguageIntentInterpreter()

    # Diagnostic failure mode request
    res = await interpreter.interpret("S001", "FAILURE_MODE=attendance_timeout Apply for 1 day leave.")
    assert res.success is True
    assert res.used_llm is False
    assert res.provider_name == "deterministic_fast_path"
    assert res.goal is not None
    assert res.goal.parameters.get("failure_mode") == "attendance_timeout"

@pytest.mark.anyio
async def test_interpreter_input_length_rejection():
    """Verify requests exceeding character limits fail safely with student-friendly message."""
    mock_provider = MockLLMProvider(max_input_length=50)
    interpreter = NaturalLanguageIntentInterpreter(provider=mock_provider)

    long_prompt = "I need urgent leave for " + ("very long text " * 10)
    res = await interpreter.interpret("S001", long_prompt)

    assert res.success is False
    assert "exceeds the limit" in res.user_friendly_message
    assert res.goal is None

@pytest.mark.anyio
async def test_interpreter_mock_provider_execution():
    """Verify structured interpretation with mock provider."""
    mock_provider = MockLLMProvider()
    interpreter = NaturalLanguageIntentInterpreter(provider=mock_provider)

    res = await interpreter.interpret("S001", "I have a high fever and need 4 days sick leave.")
    assert res.success is True
    assert res.goal is not None
    assert res.goal.parameters["days"] == 4
    assert res.goal.parameters["category"] == "medical"

# =============================================================================
# 6. FASTAPI ENDPOINT TESTS
# =============================================================================
def test_llm_status_api_endpoint(client):
    """Verify GET /api/llm/status returns masked configuration and health."""
    res = client.get("/api/llm/status")
    assert res.status_code == 200
    data = res.json()

    assert "provider" in data
    assert "model" in data
    assert "masked_api_key" in data
    # Ensure sensitive credentials are never leaked in API response
    assert not data["masked_api_key"].startswith("AIzaSy")
    assert "limits" in data
    assert data["limits"]["max_input_length"] == 2000
    assert "telemetry" in data

def test_llm_interpret_api_endpoint(client):
    """Verify POST /api/llm/interpret endpoint returns structured goal."""
    res = client.post("/api/llm/interpret", json={
        "student_id": "S001",
        "request_text": "I want to apply for 2 days leave for a family function."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["student_id"] == "S001"
    assert data["goal"]["parameters"]["days"] == 2

