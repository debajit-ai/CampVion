"""
CampVion LLM Subsystem - Optional Ollama Adapter (Local Inference)
Provided strictly as an optional future adapter.
NOT required for application startup, cloud deployment, or normal production operations.
"""

import time
import json
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
    LLMTimeoutError,
    LLMNetworkError,
    LLMValidationError
)

logger = logging.getLogger("campvion.llm.ollama")

class OllamaProvider(BaseLLMProvider):
    """
    Optional adapter for local Ollama daemon.
    Non-blocking: If Ollama is absent, the backend still operates normally.
    """

    DEFAULT_BASE_URL = "http://localhost:11434"

    def __init__(
        self,
        model: str = "llama3",
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 1,
        max_input_length: int = 2000,
        max_output_tokens: int = 1024,
        temperature: float = 0.1
    ):
        super().__init__(
            provider_name="ollama",
            model=model,
            api_key=None,
            base_url=base_url or self.DEFAULT_BASE_URL,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )
        self.endpoint_url = f"{self.base_url.rstrip('/')}/api/chat"

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
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "num_predict": max_tokens or self.max_output_tokens
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(self.endpoint_url, json=payload)

            if resp.status_code != 200:
                raise LLMProviderError(
                    f"Ollama returned HTTP {resp.status_code}: {resp.text}",
                    provider=self.provider_name,
                    status_code=resp.status_code
                )

            data = resp.json()
            latency_ms = (time.perf_counter() - t0) * 1000
            text = data.get("message", {}).get("content", "")

            usage = UsageMetrics(
                prompt_tokens=data.get("prompt_eval_count", 0),
                completion_tokens=data.get("eval_count", 0),
                total_tokens=data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
                estimated_cost_usd=0.0  # Local inference
            )

            self.record_metrics(success=True, latency_ms=latency_ms, usage=usage)

            return LLMResponse(
                text=text,
                model=self.model,
                provider=self.provider_name,
                latency_ms=round(latency_ms, 2),
                usage=usage,
                raw_response=data
            )
        except httpx.ConnectError:
            latency_ms = (time.perf_counter() - t0) * 1000
            self.record_metrics(success=False, latency_ms=latency_ms)
            raise LLMNetworkError(
                "Local Ollama daemon is not reachable on localhost:11434. "
                "For cloud deployments, please configure a cloud LLM provider (e.g. Gemini or OpenAI).",
                provider=self.provider_name
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
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        enriched_msgs = [
            LLMMessage(role="system", content=f"Respond strictly in JSON complying with schema:\n{schema_json}")
        ] + messages

        raw_resp = await self.generate(enriched_msgs, temperature=temperature, max_tokens=max_tokens)
        try:
            parsed = json.loads(raw_resp.text)
            structured_obj = schema.model_validate(parsed)
            return structured_obj, raw_resp
        except Exception as e:
            raise LLMValidationError(
                f"Ollama output did not match {schema.__name__}: {str(e)}",
                provider=self.provider_name
            )

    async def check_health(self) -> ProviderHealthStatus:
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url.rstrip('/')}/api/tags")
            dur_ms = (time.perf_counter() - t0) * 1000

            if resp.status_code == 200:
                return ProviderHealthStatus(
                    provider_name=self.provider_name,
                    configured_model=self.model,
                    status="healthy",
                    is_available=True,
                    latency_ms=round(dur_ms, 2),
                    supported_features=["generate", "generate_structured", "local_adapter"]
                )
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="degraded",
                is_available=False,
                error_message=f"Ollama returned HTTP {resp.status_code}",
                supported_features=[]
            )
        except Exception as e:
            return ProviderHealthStatus(
                provider_name=self.provider_name,
                configured_model=self.model,
                status="unavailable",
                is_available=False,
                error_message="Ollama daemon is not running on localhost:11434. (Cloud providers recommended for deployment).",
                supported_features=[]
            )

