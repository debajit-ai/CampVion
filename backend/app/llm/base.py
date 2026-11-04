"""
CampVion LLM Subsystem - Base Provider Abstraction
Defines common interfaces, message formats, telemetry models, and governance contracts
for cloud-first hosted LLM integrations.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Type, TypeVar, Tuple
from pydantic import BaseModel, Field
import time
import logging

from app.llm.exceptions import (
    LLMProviderError,
    LLMInputLengthExceededError,
    LLMValidationError
)

logger = logging.getLogger("campvion.llm.base")

T = TypeVar("T", bound=BaseModel)

class LLMMessage(BaseModel):
    """Normalized chat message."""
    role: str = Field(..., description="Message role: system, user, assistant")
    content: str = Field(..., description="Message text content")

class UsageMetrics(BaseModel):
    """Token usage and estimated cost tracking."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0

class LLMResponse(BaseModel):
    """Standardized response from any LLM provider."""
    text: str
    model: str
    provider: str
    latency_ms: float
    usage: UsageMetrics = Field(default_factory=UsageMetrics)
    raw_response: Optional[Dict[str, Any]] = None

class ProviderHealthStatus(BaseModel):
    """Health check outcome for a provider."""
    provider_name: str
    configured_model: str
    status: str  # "healthy", "unconfigured", "unavailable", "degraded"
    is_available: bool
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    supported_features: List[str] = Field(default_factory=list)

class BaseLLMProvider(ABC):
    """
    Abstract Base Class for all LLM providers in CampVion.
    Guarantees plug-and-play modularity across Google Gemini, OpenAI,
    OpenAI-compatible endpoints, and future adapters.
    """

    def __init__(
        self,
        provider_name: str,
        model: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        max_input_length: int = 2000,
        max_output_tokens: int = 1024,
        temperature: float = 0.1
    ):
        self.provider_name = provider_name
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.max_input_length = max_input_length
        self.max_output_tokens = max_output_tokens
        self.temperature = temperature

        # Telemetry metrics
        self._total_requests = 0
        self._total_successful = 0
        self._total_failed = 0
        self._total_prompt_tokens = 0
        self._total_completion_tokens = 0
        self._total_latency_ms = 0.0

    def mask_api_key(self) -> str:
        """Return masked key for safe logging and status reporting."""
        if not self.api_key:
            return "NOT_CONFIGURED"
        if len(self.api_key) <= 8:
            return "***"
        return f"{self.api_key[:4]}...{self.api_key[-4:]}"

    def validate_input(self, messages: List[LLMMessage]) -> None:
        """Ensure input messages do not exceed maximum character safety bounds."""
        total_chars = sum(len(m.content) for m in messages)
        if total_chars > self.max_input_length:
            logger.warning(
                "Input length %d exceeded max limit %d for provider %s",
                total_chars, self.max_input_length, self.provider_name
            )
            raise LLMInputLengthExceededError(total_chars, self.max_input_length)

    def record_metrics(self, success: bool, latency_ms: float, usage: Optional[UsageMetrics] = None) -> None:
        """Internal telemetry aggregation."""
        self._total_requests += 1
        self._total_latency_ms += latency_ms
        if success:
            self._total_successful += 1
            if usage:
                self._total_prompt_tokens += usage.prompt_tokens
                self._total_completion_tokens += usage.completion_tokens
        else:
            self._total_failed += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Return live runtime usage and latency metrics."""
        avg_latency = (
            self._total_latency_ms / self._total_requests
            if self._total_requests > 0 else 0.0
        )
        return {
            "provider_name": self.provider_name,
            "configured_model": self.model,
            "masked_key": self.mask_api_key(),
            "total_requests": self._total_requests,
            "successful_requests": self._total_successful,
            "failed_requests": self._total_failed,
            "total_prompt_tokens": self._total_prompt_tokens,
            "total_completion_tokens": self._total_completion_tokens,
            "total_tokens": self._total_prompt_tokens + self._total_completion_tokens,
            "average_latency_ms": round(avg_latency, 2),
            "max_input_length": self.max_input_length,
            "max_output_tokens": self.max_output_tokens,
            "timeout_seconds": self.timeout_seconds
        }

    @abstractmethod
    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> LLMResponse:
        """Generate text completion from a sequence of chat messages."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        messages: List[LLMMessage],
        schema: Type[T],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Tuple[T, LLMResponse]:
        """Generate a guaranteed structured JSON completion parsed into a Pydantic model."""
        pass

    @abstractmethod
    async def check_health(self) -> ProviderHealthStatus:
        """Perform a lightweight live probe to verify connectivity and credentials."""
        pass

