"""
CampVion LLM Subsystem - Provider Factory
Configures and yields the active LLM provider based on server-side environment variables.
Supports Groq (Primary), Gemini, OpenAI, Ollama, and Mock providers.
"""

import logging
from typing import Optional, Dict

from app.core.config import settings
from app.llm.base import BaseLLMProvider
from app.llm.groq_provider import GroqCloudProvider
from app.llm.gemini_provider import GeminiCloudProvider
from app.llm.openai_provider import OpenAICloudProvider
from app.llm.ollama_provider import OllamaProvider
from app.llm.mock_provider import MockLLMProvider

logger = logging.getLogger("campvion.llm.factory")

_PROVIDER_INSTANCES: Dict[str, BaseLLMProvider] = {}

def get_llm_provider(
    provider_name: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> BaseLLMProvider:
    """
    Retrieve or initialize the configured LLM provider.
    Defaults to settings.LLM_PROVIDER (e.g. 'groq').
    """
    target_provider = (provider_name or getattr(settings, "LLM_PROVIDER", "groq")).lower()
    target_key = api_key or getattr(settings, "effective_llm_api_key", None) or getattr(settings, "LLM_API_KEY", None)
    target_model = model or getattr(settings, "effective_llm_model", None) or getattr(settings, "LLM_MODEL", None)

    cache_key = f"{target_provider}:{target_model}:{bool(target_key)}"
    if cache_key in _PROVIDER_INSTANCES:
        return _PROVIDER_INSTANCES[cache_key]

    timeout = getattr(settings, "LLM_TIMEOUT_SECONDS", 30.0)
    max_retries = getattr(settings, "LLM_MAX_RETRIES", 2)
    max_input_length = getattr(settings, "LLM_MAX_INPUT_LENGTH", 2000)
    max_output_tokens = getattr(settings, "LLM_MAX_OUTPUT_TOKENS", 1024)
    temperature = getattr(settings, "LLM_TEMPERATURE", 0.1)
    base_url = getattr(settings, "LLM_BASE_URL", None)

    if target_provider == "groq":
        model_name = target_model or "qwen/qwen3.8-27b"
        provider = GroqCloudProvider(
            api_key=target_key,
            model=model_name,
            base_url=base_url,
            timeout_seconds=timeout,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
    elif target_provider == "gemini":
        model_name = target_model or "gemini-1.5-flash"
        provider = GeminiCloudProvider(
            api_key=target_key,
            model=model_name,
            base_url=base_url,
            timeout_seconds=timeout,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
    elif target_provider in ["openai", "openrouter"]:
        model_name = target_model or "gpt-4o-mini"
        provider = OpenAICloudProvider(
            api_key=target_key,
            model=model_name,
            base_url=base_url,
            timeout_seconds=timeout,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
    elif target_provider == "ollama":
        model_name = target_model or getattr(settings, "OLLAMA_MODEL", "llama3")
        ollama_url = base_url or getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        provider = OllamaProvider(
            model=model_name,
            base_url=ollama_url,
            timeout_seconds=timeout,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
    elif target_provider in ["mock", "deterministic", "test"]:
        provider = MockLLMProvider(
            model=target_model or "mock-cloud-v1",
            timeout_seconds=timeout,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
    else:
        logger.warning(
            "Unknown LLM provider '%s'. Defaulting to GroqCloudProvider.",
            target_provider
        )
        provider = GroqCloudProvider(
            api_key=target_key,
            model="llama-3.3-70b-versatile",
            base_url=base_url,
            timeout_seconds=timeout,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )

    _PROVIDER_INSTANCES[cache_key] = provider
    return provider
