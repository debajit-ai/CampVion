"""
CampVion LLM Subsystem - Mock / Deterministic Provider
Used for offline hermetic testing, benchmarking, and development when no cloud credentials
are configured in the environment.
"""

import time
import json
import re
from typing import List, Dict, Any, Optional, Type, Tuple
from pydantic import BaseModel

from app.llm.base import (
    BaseLLMProvider,
    LLMMessage,
    LLMResponse,
    UsageMetrics,
    ProviderHealthStatus,
    T
)
from app.llm.exceptions import LLMInputLengthExceededError

class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic mock provider simulating cloud LLM responses without external network calls.
    """

    def __init__(
        self,
        model: str = "mock-cloud-v1",
        timeout_seconds: float = 5.0,
        max_input_length: int = 2000,
        max_output_tokens: int = 1024,
        temperature: float = 0.0
    ):
        super().__init__(
            provider_name="mock",
            model=model,
            api_key="mock-key-for-testing",
            base_url="mock://cloud.local",
            timeout_seconds=timeout_seconds,
            max_retries=1,
            max_input_length=max_input_length,
            max_output_tokens=max_output_tokens,
            temperature=temperature
        )

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> LLMResponse:
        self.validate_input(messages)
        t0 = time.perf_counter()

        last_user_content = next((m.content for m in reversed(messages) if m.role == "user"), "")
        simulated_text = f"Interpreted request: '{last_user_content}'"

        dur_ms = (time.perf_counter() - t0) * 1000
        usage = UsageMetrics(
            prompt_tokens=len(last_user_content.split()),
            completion_tokens=len(simulated_text.split()),
            total_tokens=len(last_user_content.split()) + len(simulated_text.split()),
            estimated_cost_usd=0.0
        )
        self.record_metrics(success=True, latency_ms=dur_ms, usage=usage)

        return LLMResponse(
            text=simulated_text,
            model=self.model,
            provider=self.provider_name,
            latency_ms=round(dur_ms, 2),
            usage=usage
        )

    async def generate_structured(
        self,
        messages: List[LLMMessage],
        schema: Type[T],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Tuple[T, LLMResponse]:
        self.validate_input(messages)
        t0 = time.perf_counter()

        last_user_content = next((m.content for m in reversed(messages) if m.role == "user"), "").lower()

        # Deterministic extraction logic for mock schema fulfillment
        days = 1
        days_match = re.search(r"(-?\d+)\s*(?:day|days)", last_user_content)
        if days_match:
            days = int(days_match.group(1))
        elif "week" in last_user_content:
            days = 5

        category = "personal"
        reason = "personal leave"
        if any(w in last_user_content for w in ["medical", "sick", "fever", "hospital"]):
            category = "medical"
            reason = "medical treatment"
        elif any(w in last_user_content for w in ["family", "wedding", "emergency"]):
            category = "family_emergency"
            reason = "family event"

        # Construct generic schema dict
        schema_dict: Dict[str, Any] = {}
        for field_name in schema.model_fields.keys():
            if field_name == "goal_type":
                schema_dict["goal_type"] = "LEAVE_APPLICATION"
            elif field_name == "days":
                schema_dict["days"] = days
            elif field_name == "category":
                schema_dict["category"] = category
            elif field_name == "reason":
                schema_dict["reason"] = reason
            elif field_name == "requires_approval":
                schema_dict["requires_approval"] = True
            elif field_name == "parameters":
                schema_dict["parameters"] = {
                    "days": days,
                    "category": category,
                    "reason": reason
                }
            elif field_name == "student_id":
                schema_dict["student_id"] = "S001"

        try:
            structured_obj = schema.model_validate(schema_dict)
        except Exception:
            # Fallback if specific fields are required
            structured_obj = schema.model_construct(**schema_dict)

        dur_ms = (time.perf_counter() - t0) * 1000
        usage = UsageMetrics(prompt_tokens=15, completion_tokens=15, total_tokens=30, estimated_cost_usd=0.0)
        self.record_metrics(success=True, latency_ms=dur_ms, usage=usage)

        response = LLMResponse(
            text=json.dumps(schema_dict),
            model=self.model,
            provider=self.provider_name,
            latency_ms=round(dur_ms, 2),
            usage=usage
        )
        return structured_obj, response

    async def check_health(self) -> ProviderHealthStatus:
        return ProviderHealthStatus(
            provider_name=self.provider_name,
            configured_model=self.model,
            status="healthy",
            is_available=True,
            latency_ms=0.5,
            supported_features=["generate", "generate_structured", "offline_mock"]
        )

