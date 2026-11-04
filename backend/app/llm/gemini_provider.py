"""
CampVion LLM Subsystem - Google Gemini Cloud API Provider (Primary Cloud Provider)
Implements secure, cloud-hosted LLM communication using Google Gemini's REST API.
Includes rate-limit handling with exponential backoff, quota exhaustion detection,
structured JSON response generation, and usage tracking.
"""

import asyncio
import json
import time
import logging
from typing import List, Dict, Any, Optional, Type, Tuple
import httpx
from pydantic import BaseModel

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

logger = logging.getLogger("campvion.llm.gemini")

class GeminiCloudProvider(BaseLLMProvider):
    """
    Primary Cloud Provider for Google Gemini API (gemini-1.5-flash, gemini-2.0-flash, etc.).
    Uses secure server-side REST requests over HTTPS.
    """

    DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-1.5-flash",
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        max_input_length: int = 2000,
        max_output_tokens: int = 1024,
        temperature: float = 0.1
    ):
        super().__init__(
            provider_name="gemini",
            model=model,
            api_key=api_key,
            base_url=base_url or self.DEFAULT_BASE_URL,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
        self.endpoint_url = f"{self.base_url.rstrip('/')}/models/{self.model}:generateContent"

    def _convert_messages(self, messages: List[LLMMessage]) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """Separate system instruction from conversation contents."""
        system_instruction = None
        contents = []

        for msg in messages:
            if msg.role == "system":
                system_instruction = {"parts": [{"text": msg.content}]}
            elif msg.role == "user":
                contents.append({"role": "user", "parts": [{"text": msg.content}]})
            elif msg.role in ["assistant", "model"]:
                contents.append({"role": "model", "parts": [{"text": msg.content}]})

        if not contents:
            contents.append({"role": "user", "parts": [{"text": "Hello"}]})

        return system_instruction, contents

    async def _post_with_retry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute HTTP POST with exponential backoff for rate limits."""
        if not self.api_key:
            raise LLMAuthenticationError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY or LLM_API_KEY.",
                provider=self.provider_name
            )

        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key
        }

        retries = 0
        backoff_delay = 1.0

        while True:
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    resp = await client.post(self.endpoint_url, headers=headers, json=payload)

                if resp.status_code == 200:
                    return resp.json()

                # Handle specific HTTP error status codes
                if resp.status_code in [401, 403]:
                    err_text = resp.text
                    if "RESOURCE_EXHAUSTED" in err_text or "quota" in err_text.lower():
                        raise LLMQuotaExhaustedError(
                            f"Gemini API quota exceeded: {err_text}",
                            provider=self.provider_name
                        )
                    raise LLMAuthenticationError(
                        f"Gemini authentication failed (HTTP {resp.status_code}): {err_text}",
                        provider=self.provider_name
                    )

                if resp.status_code == 429:
                    if retries < self.max_retries:
                        retries += 1
                        logger.warning(
                            "Gemini rate limit (429) encountered. Retrying attempt %d/%d in %.1fs...",
                            retries, self.max_retries, backoff_delay
                        )
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    raise LLMRateLimitError(
                        "Gemini rate limit exceeded after maximum retries.",
                        provider=self.provider_name
                    )

                if resp.status_code >= 500:
                    if retries < self.max_retries:
                        retries += 1
                        logger.warning(
                            "Gemini server error (%d). Retrying attempt %d/%d...",
                            resp.status_code, retries, self.max_retries
                        )
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    raise LLMNetworkError(
                        f"Gemini server error HTTP {resp.status_code}: {resp.text}",
                        provider=self.provider_name
                    )

                # Other 4xx client errors
                raise LLMProviderError(
                    f"Gemini API request failed with status {resp.status_code}: {resp.text}",
                    provider=self.provider_name,
                    status_code=resp.status_code
                )

            except httpx.TimeoutException:
                if retries < self.max_retries:
                    retries += 1
                    logger.warning("Gemini request timed out. Retrying attempt %d/%d...", retries, self.max_retries)
                    await asyncio.sleep(backoff_delay)
                    continue
                raise LLMTimeoutError(
                    f"Gemini request timed out after {self.timeout_seconds}s.",
                    provider=self.provider_name,
                    timeout_seconds=self.timeout_seconds
                )
            except httpx.ConnectError as e:
                raise LLMNetworkError(
                    f"Failed to connect to Gemini API endpoint: {str(e)}",
                    provider=self.provider_name
                )
            except (LLMProviderError, LLMAuthenticationError, LLMRateLimitError, LLMQuotaExhaustedError, LLMTimeoutError, LLMNetworkError):
                raise
            except Exception as e:
                raise LLMProviderError(
                    f"Unexpected error communicating with Gemini API: {str(e)}",
                    provider=self.provider_name
                )

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> LLMResponse:
        self.validate_input(messages)
        t0 = time.perf_counter()

        system_instruction, contents = self._convert_messages(messages)
        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self.temperature,
                "maxOutputTokens": max_tokens or self.max_output_tokens
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        try:
            raw_data = await self._post_with_retry(payload)
            latency_ms = (time.perf_counter() - t0) * 1000

            # Extract generated text
            candidates = raw_data.get("candidates", [])
            if not candidates or "content" not in candidates[0]:
                raise LLMValidationError("Gemini returned empty candidate output", provider=self.provider_name)

            parts = candidates[0]["content"].get("parts", [])
            text = "".join(p.get("text", "") for p in parts)

            # Token usage
            usage_meta = raw_data.get("usageMetadata", {})
            prompt_tokens = usage_meta.get("promptTokenCount", 0)
            completion_tokens = usage_meta.get("candidatesTokenCount", 0)
            total_tokens = usage_meta.get("totalTokenCount", prompt_tokens + completion_tokens)
            
            # Cost estimation: $0.075/1M in, $0.30/1M out for Gemini Flash
            cost_usd = (prompt_tokens * 0.000000075) + (completion_tokens * 0.00000030)

            usage = UsageMetrics(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                estimated_cost_usd=round(cost_usd, 6)
            )

            self.record_metrics(success=True, latency_ms=latency_ms, usage=usage)

            return LLMResponse(
                text=text,
                model=self.model,
                provider=self.provider_name,
                latency_ms=round(latency_ms, 2),
                usage=usage,
                raw_response=raw_data
            )
        except Exception as e:
            latency_ms = (time.perf_counter() - t0) * 1000
            self.record_metrics(success=False, latency_ms=latency_ms)
            raise

    async def generate_structured(
        self,
        messages: List[LLMMessage],
        schema: Type[T],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Tuple[T, LLMResponse]:
        """Request structured JSON and parse into Pydantic model."""
        self.validate_input(messages)
        t0 = time.perf_counter()

        system_instruction, contents = self._convert_messages(messages)
        
        # Guide model to return JSON adhering strictly to the schema
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        instruction_append = f"\nYou MUST respond with valid JSON matching this schema:\n{schema_json}"
        
        if system_instruction:
            system_instruction["parts"][0]["text"] += instruction_append
        else:
            system_instruction = {"parts": [{"text": instruction_append}]}

        payload: Dict[str, Any] = {
            "contents": contents,
            "systemInstruction": system_instruction,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self.temperature,
                "maxOutputTokens": max_tokens or self.max_output_tokens,
                "responseMimeType": "application/json"
            }
        }

        try:
            raw_data = await self._post_with_retry(payload)
            latency_ms = (time.perf_counter() - t0) * 1000

            candidates = raw_data.get("candidates", [])
            if not candidates or "content" not in candidates[0]:
                raise LLMValidationError("Gemini returned empty candidate output", provider=self.provider_name)

            parts = candidates[0]["content"].get("parts", [])
            text = "".join(p.get("text", "") for p in parts).strip()

            # Clean markdown code blocks if present
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
                logger.error("Failed to parse Gemini output into schema %s: %s", schema.__name__, str(parse_err))
                raise LLMValidationError(
                    f"Model output did not match expected {schema.__name__} schema: {str(parse_err)}",
                    provider=self.provider_name
                )

            usage_meta = raw_data.get("usageMetadata", {})
            prompt_tokens = usage_meta.get("promptTokenCount", 0)
            completion_tokens = usage_meta.get("candidatesTokenCount", 0)
            total_tokens = usage_meta.get("totalTokenCount", prompt_tokens + completion_tokens)
            cost_usd = (prompt_tokens * 0.000000075) + (completion_tokens * 0.00000030)

            usage = UsageMetrics(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                estimated_cost_usd=round(cost_usd, 6)
            )

            self.record_metrics(success=True, latency_ms=latency_ms, usage=usage)

            response = LLMResponse(
                text=text,
                model=self.model,
                provider=self.provider_name,
                latency_ms=round(latency_ms, 2),
                usage=usage,
                raw_response=raw_data
            )
            return structured_obj, response

        except Exception:
            latency_ms = (time.perf_counter() - t0) * 1000
            self.record_metrics(success=False, latency_ms=latency_ms)
            raise

    async def check_health(self) -> ProviderHealthStatus:
        """Probe Gemini API availability."""
        if not self.api_key:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unconfigured",
                is_available=False,
                error_message="No API key configured. Set GEMINI_API_KEY in environment.",
                supported_features=["generate", "generate_structured", "token_usage_tracking"]
            )

        t0 = time.perf_counter()
        try:
            # Lightweight probe with 1 max token
            test_msg = [LLMMessage(role="user", content="ping")]
            res = await self.generate(test_msg, max_tokens=1)
            dur_ms = (time.perf_counter() - t0) * 1000

            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="healthy",
                is_available=True,
                latency_ms=round(dur_ms, 2),
                supported_features=["generate", "generate_structured", "token_usage_tracking", "json_mode"]
            )
        except LLMAuthenticationError as auth_err:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="error",
                is_available=False,
                error_message="Authentication failed: invalid API key.",
                supported_features=[]
            )
        except LLMQuotaExhaustedError as quota_err:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="degraded",
                is_available=False,
                error_message="Quota exhausted: billing or rate limits exceeded.",
                supported_features=[]
            )
        except Exception as err:
            dur_ms = (time.perf_counter() - t0) * 1000
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unavailable",
                is_available=False,
                latency_ms=round(dur_ms, 2),
                error_message=f"Cloud API check failed: {str(err)}",
                supported_features=[]
            )

