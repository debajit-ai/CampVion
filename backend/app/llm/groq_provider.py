"""
CampVion LLM Subsystem - Groq Cloud API Provider
Implements ultra-fast cloud LPU inference using the official Groq SDK.
Provides structured JSON generation, rate-limit backoff, token usage tracking,
and resilient error handling.
"""

import asyncio
import json
import time
import logging
from typing import List, Dict, Any, Optional, Type, Tuple
from pydantic import BaseModel
import groq
from groq import AsyncGroq

from app.llm.base import (
    BaseLLMProvider,
    LLMMessage,
    LLMResponse,
    UsageMetrics,
    ProviderHealthStatus,
    T
)
from app.llm.exceptions import (
    LLMProviderError,
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMQuotaExhaustedError,
    LLMTimeoutError,
    LLMNetworkError,
    LLMValidationError
)

logger = logging.getLogger("campvion.llm.groq")

class GroqCloudProvider(BaseLLMProvider):
    """
    Primary Cloud Provider powered by Groq LPU inference.
    Default Model: qwen/qwen3.8-27b
    """

    DEFAULT_BASE_URL = "https://api.groq.com"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "qwen/qwen3.8-27b",
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        max_input_length: int = 2000,
        max_output_tokens: int = 1024,
        temperature: float = 0.1
    ):
        super().__init__(
            provider_name="groq",
            model=model,
            api_key=api_key,
            base_url=base_url or self.DEFAULT_BASE_URL,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
        self._client: Optional[AsyncGroq] = None

    def _get_client(self) -> AsyncGroq:
        """Initialize or return AsyncGroq client bound to the current running event loop."""
        if not self.api_key:
            raise LLMAuthenticationError(
                "GROQ_API_KEY is not configured. Please paste your key into backend/.env.",
                provider=self.provider_name
            )
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if self._client is None or getattr(self, "_client_loop", None) is not current_loop:
            clean_base_url = self.base_url.rstrip("/").removesuffix("/openai/v1") if self.base_url else None
            self._client = AsyncGroq(
                api_key=self.api_key,
                base_url=clean_base_url,
                timeout=self.timeout_seconds
            )
            self._client_loop = current_loop
        return self._client

    def mask_api_key(self) -> str:
        """Return masked Groq key (e.g. gsk_...****)."""
        if not self.api_key:
            return "NOT_CONFIGURED"
        if len(self.api_key) <= 8:
            return "***"
        prefix = self.api_key[:6] if self.api_key.startswith("gsk_") else self.api_key[:4]
        return f"{prefix}...{self.api_key[-4:]}"

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> LLMResponse:
        self.validate_input(messages)
        client = self._get_client()
        t0 = time.perf_counter()

        chat_messages = [{"role": m.role, "content": m.content} for m in messages]
        retries = 0
        backoff_delay = 1.0

        while True:
            try:
                completion = await client.chat.completions.create(
                    model=self.model,
                    messages=chat_messages,
                    temperature=temperature if temperature is not None else self.temperature,
                    max_tokens=max_tokens or self.max_output_tokens
                )
                dur_ms = (time.perf_counter() - t0) * 1000

                choice = completion.choices[0]
                text = choice.message.content or ""

                # Token metrics
                p_tokens = completion.usage.prompt_tokens if completion.usage else 0
                c_tokens = completion.usage.completion_tokens if completion.usage else 0
                t_tokens = completion.usage.total_tokens if completion.usage else (p_tokens + c_tokens)

                # Estimated cost: Llama 3.3 70B on Groq (~$0.59/1M in, $0.79/1M out)
                cost_usd = (p_tokens * 0.00000059) + (c_tokens * 0.00000079)

                usage = UsageMetrics(
                    prompt_tokens=p_tokens,
                    completion_tokens=c_tokens,
                    total_tokens=t_tokens,
                    estimated_cost_usd=round(cost_usd, 6)
                )

                self.record_metrics(success=True, latency_ms=dur_ms, usage=usage)

                return LLMResponse(
                    text=text,
                    model=self.model,
                    provider=self.provider_name,
                    latency_ms=round(dur_ms, 2),
                    usage=usage,
                    raw_response={"id": completion.id, "finish_reason": choice.finish_reason}
                )

            except groq.AuthenticationError as auth_err:
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                raise LLMAuthenticationError(
                    f"Groq API authentication failed. Verify GROQ_API_KEY: {str(auth_err)}",
                    provider=self.provider_name
                )
            except groq.RateLimitError as rate_err:
                if retries < self.max_retries:
                    retries += 1
                    logger.warning(
                        "Groq rate limit encountered. Retrying attempt %d/%d in %.1fs...",
                        retries, self.max_retries, backoff_delay
                    )
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2.0
                    continue
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                raise LLMRateLimitError(
                    "Groq rate limit exceeded after maximum retries. Please try again in a few moments.",
                    provider=self.provider_name
                )
            except groq.APIStatusError as status_err:
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                if status_err.status_code == 403 or "quota" in str(status_err).lower():
                    raise LLMQuotaExhaustedError(
                        f"Groq API quota exhausted or forbidden: {str(status_err)}",
                        provider=self.provider_name
                    )
                raise LLMProviderError(
                    f"Groq API error ({status_err.status_code}): {str(status_err)}",
                    provider=self.provider_name,
                    status_code=status_err.status_code
                )
            except groq.APIConnectionError as conn_err:
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                raise LLMNetworkError(
                    f"Failed to connect to Groq cloud API: {str(conn_err)}",
                    provider=self.provider_name
                )
            except Exception as e:
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                raise LLMProviderError(
                    f"Unexpected error communicating with Groq: {str(e)}",
                    provider=self.provider_name
                )

    async def generate_structured(
        self,
        messages: List[LLMMessage],
        schema: Type[T],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Tuple[T, LLMResponse]:
        """Request structured JSON output adhering to the Pydantic schema."""
        self.validate_input(messages)
        client = self._get_client()
        t0 = time.perf_counter()

        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        system_instruction = (
            "You are CampVion's Student Intent Analysis Engine. "
            "You must return ONLY a valid JSON object matching the following JSON schema strictly:\n"
            f"{schema_json}\n"
            "Do not include markdown fences, comments, or any extra text."
        )

        chat_messages = [{"role": "system", "content": system_instruction}]
        chat_messages.extend([{"role": m.role, "content": m.content} for m in messages])

        retries = 0
        backoff_delay = 1.0

        while True:
            try:
                completion = await client.chat.completions.create(
                    model=self.model,
                    messages=chat_messages,
                    temperature=temperature if temperature is not None else self.temperature,
                    max_tokens=max_tokens or self.max_output_tokens,
                    response_format={"type": "json_object"}
                )
                dur_ms = (time.perf_counter() - t0) * 1000

                choice = completion.choices[0]
                text = (choice.message.content or "").strip()

                # Clean markdown fences if model returned them
                if text.startswith("```"):
                    lines = text.splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    text = "\n".join(lines).strip()

                try:
                    parsed_json = json.loads(text)
                    structured_obj = schema.model_validate(parsed_json)
                except Exception as parse_err:
                    logger.error("Failed to parse Groq output into schema %s: %s\nOutput was: %s", schema.__name__, str(parse_err), text)
                    raise LLMValidationError(
                        f"Groq output did not match {schema.__name__}: {str(parse_err)}",
                        provider=self.provider_name
                    )

                p_tokens = completion.usage.prompt_tokens if completion.usage else 0
                c_tokens = completion.usage.completion_tokens if completion.usage else 0
                t_tokens = completion.usage.total_tokens if completion.usage else (p_tokens + c_tokens)
                cost_usd = (p_tokens * 0.00000059) + (c_tokens * 0.00000079)

                usage = UsageMetrics(
                    prompt_tokens=p_tokens,
                    completion_tokens=c_tokens,
                    total_tokens=t_tokens,
                    estimated_cost_usd=round(cost_usd, 6)
                )

                self.record_metrics(success=True, latency_ms=dur_ms, usage=usage)

                response = LLMResponse(
                    text=text,
                    model=self.model,
                    provider=self.provider_name,
                    latency_ms=round(dur_ms, 2),
                    usage=usage,
                    raw_response={"id": completion.id, "finish_reason": choice.finish_reason}
                )
                return structured_obj, response

            except (groq.RateLimitError, groq.APIConnectionError) as retryable:
                if retries < self.max_retries:
                    retries += 1
                    logger.warning("Groq retryable fault: %s. Retrying attempt %d/%d...", str(retryable), retries, self.max_retries)
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2.0
                    continue
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                raise
            except Exception:
                dur_ms = (time.perf_counter() - t0) * 1000
                self.record_metrics(success=False, latency_ms=dur_ms)
                raise

    async def check_health(self) -> ProviderHealthStatus:
        """Lightweight live connectivity probe."""
        if not self.api_key:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unconfigured",
                is_available=False,
                error_message="GROQ_API_KEY is not configured. Please paste your key into backend/.env.",
                supported_features=["llama-3.3-70b-versatile", "json_object", "ultra_fast_lpu"]
            )

        t0 = time.perf_counter()
        try:
            client = self._get_client()
            # Fast ping with 1 token
            completion = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
                temperature=0.0
            )
            dur_ms = (time.perf_counter() - t0) * 1000

            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="healthy",
                is_available=True,
                latency_ms=round(dur_ms, 2),
                supported_features=[
                    "llama-3.3-70b-versatile",
                    "json_object",
                    "ultra_fast_lpu",
                    "intent_extraction",
                    "clarification_generation"
                ]
            )
        except groq.AuthenticationError:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="error",
                is_available=False,
                error_message="Groq authentication failed: Invalid or expired GROQ_API_KEY in backend/.env.",
                supported_features=[]
            )
        except Exception as e:
            dur_ms = (time.perf_counter() - t0) * 1000
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unavailable",
                is_available=False,
                latency_ms=round(dur_ms, 2),
                error_message=f"Groq health probe failed: {str(e)}",
                supported_features=[]
            )

