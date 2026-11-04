"""
CampVion LLM Subsystem - OpenAI & Compatible Cloud API Provider
Supports OpenAI (gpt-4o-mini, gpt-4o) and OpenAI-compatible cloud endpoints
(Groq, OpenRouter, Azure, Mistral, Together) over server-side HTTPS.
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

logger = logging.getLogger("campvion.llm.openai")

class OpenAICloudProvider(BaseLLMProvider):
    """
    Hosted cloud provider for OpenAI and OpenAI-compatible REST APIs.
    """

    DEFAULT_BASE_URL = "https://api.openai.com/v1"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        max_input_length: int = 2000,
        max_output_tokens: int = 1024,
        temperature: float = 0.1
    ):
        super().__init__(
            provider_name="openai",
            model=model,
            api_key=api_key,
            base_url=base_url or self.DEFAULT_BASE_URL,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
        self.endpoint_url = f"{self.base_url.rstrip('/')}/chat/completions"

    async def _post_with_retry(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute HTTP POST with retry."""
        if not self.api_key:
            raise LLMAuthenticationError(
                "OpenAI API key is not configured. Please set OPENAI_API_KEY or LLM_API_KEY.",
                provider=self.provider_name
            )

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        retries = 0
        backoff_delay = 1.0

        while True:
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    resp = await client.post(self.endpoint_url, headers=headers, json=payload)

                if resp.status_code == 200:
                    return resp.json()

                if resp.status_code == 401:
                    raise LLMAuthenticationError(
                        f"OpenAI authentication failed: {resp.text}",
                        provider=self.provider_name
                    )

                if resp.status_code == 429:
                    err_text = resp.text.lower()
                    if "insufficient_quota" in err_text or "quota" in err_text:
                        raise LLMQuotaExhaustedError(
                            f"OpenAI quota exhausted: {resp.text}",
                            provider=self.provider_name
                        )
                    if retries < self.max_retries:
                        retries += 1
                        logger.warning("OpenAI rate limit (429). Retrying in %.1fs...", backoff_delay)
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    raise LLMRateLimitError(
                        "OpenAI rate limit exceeded after maximum retries.",
                        provider=self.provider_name
                    )

                if resp.status_code >= 500:
                    if retries < self.max_retries:
                        retries += 1
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    raise LLMNetworkError(
                        f"OpenAI server error HTTP {resp.status_code}: {resp.text}",
                        provider=self.provider_name
                    )

                raise LLMProviderError(
                    f"OpenAI API error {resp.status_code}: {resp.text}",
                    provider=self.provider_name,
                    status_code=resp.status_code
                )

            except httpx.TimeoutException:
                if retries < self.max_retries:
                    retries += 1
                    await asyncio.sleep(backoff_delay)
                    continue
                raise LLMTimeoutError(
                    f"OpenAI request timed out after {self.timeout_seconds}s.",
                    provider=self.provider_name,
                    timeout_seconds=self.timeout_seconds
                )
            except httpx.ConnectError as e:
                raise LLMNetworkError(
                    f"Failed to connect to OpenAI endpoint: {str(e)}",
                    provider=self.provider_name
                )
            except (LLMProviderError, LLMAuthenticationError, LLMRateLimitError, LLMQuotaExhaustedError, LLMTimeoutError, LLMNetworkError):
                raise
            except Exception as e:
                raise LLMProviderError(
                    f"Unexpected error communicating with OpenAI: {str(e)}",
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

        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens or self.max_output_tokens
        }

        try:
            raw_data = await self._post_with_retry(payload)
            latency_ms = (time.perf_counter() - t0) * 1000

            choices = raw_data.get("choices", [])
            if not choices or "message" not in choices[0]:
                raise LLMValidationError("Empty completion choices received", provider=self.provider_name)

            text = choices[0]["message"].get("content", "")
            usage_data = raw_data.get("usage", {})
            prompt_tokens = usage_data.get("prompt_tokens", 0)
            completion_tokens = usage_data.get("completion_tokens", 0)
            total_tokens = usage_data.get("total_tokens", prompt_tokens + completion_tokens)

            # gpt-4o-mini: $0.15/1M in, $0.60/1M out
            cost_usd = (prompt_tokens * 0.00000015) + (completion_tokens * 0.00000060)

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
        except Exception:
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
        self.validate_input(messages)
        t0 = time.perf_counter()

        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        system_prompt = f"You are a structured parser. Output only valid JSON conforming strictly to:\n{schema_json}"
        
        chat_msgs = [{"role": "system", "content": system_prompt}]
        chat_msgs.extend([{"role": m.role, "content": m.content} for m in messages])

        payload = {
            "model": self.model,
            "messages": chat_msgs,
            "response_format": {"type": "json_object"},
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens or self.max_output_tokens
        }

        try:
            raw_data = await self._post_with_retry(payload)
            latency_ms = (time.perf_counter() - t0) * 1000

            choices = raw_data.get("choices", [])
            if not choices or "message" not in choices[0]:
                raise LLMValidationError("Empty completion choices received", provider=self.provider_name)

            text = choices[0]["message"].get("content", "").strip()
            
            try:
                parsed_json = json.loads(text)
                structured_obj = schema.model_validate(parsed_json)
            except Exception as e:
                raise LLMValidationError(
                    f"Model output did not match {schema.__name__}: {str(e)}",
                    provider=self.provider_name
                )

            usage_data = raw_data.get("usage", {})
            prompt_tokens = usage_data.get("prompt_tokens", 0)
            completion_tokens = usage_data.get("completion_tokens", 0)
            total_tokens = usage_data.get("total_tokens", prompt_tokens + completion_tokens)
            cost_usd = (prompt_tokens * 0.00000015) + (completion_tokens * 0.00000060)

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
        if not self.api_key:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unconfigured",
                is_available=False,
                error_message="No OpenAI API key configured. Set OPENAI_API_KEY.",
                supported_features=["generate", "generate_structured", "json_object"]
            )

        t0 = time.perf_counter()
        try:
            test_msg = [LLMMessage(role="user", content="ping")]
            res = await self.generate(test_msg, max_tokens=1)
            dur_ms = (time.perf_counter() - t0) * 1000

            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="healthy",
                is_available=True,
                latency_ms=round(dur_ms, 2),
                supported_features=["generate", "generate_structured", "json_object"]
            )
        except Exception as e:
            dur_ms = (time.perf_counter() - t0) * 1000
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unavailable",
                is_available=False,
                latency_ms=round(dur_ms, 2),
                error_message=str(e),
                supported_features=[]
            )

