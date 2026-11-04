"""
CampVion LLM Subsystem - Exceptions and Error Class Hierarchy
Categorizes provider failures, rate limits, timeouts, validation errors,
and ensures student-friendly, actionable error messages without secret leakage.
"""

from typing import Optional

class LLMProviderError(Exception):
    """Base exception for all LLM provider interactions."""
    def __init__(
        self,
        message: str,
        provider: str = "unknown",
        status_code: Optional[int] = None,
        user_friendly_message: Optional[str] = None,
        is_retryable: bool = False
    ):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code
        self.user_friendly_message = (
            user_friendly_message
            or "The AI assistance service is currently encountering an issue. Please try again shortly."
        )
        self.is_retryable = is_retryable

    def to_dict(self):
        return {
            "error_type": self.__class__.__name__,
            "provider": self.provider,
            "status_code": self.status_code,
            "message": self.user_friendly_message,
            "is_retryable": self.is_retryable
        }

class LLMAuthenticationError(LLMProviderError):
    """Raised when an API key is missing, invalid, or expired."""
    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            status_code=401,
            user_friendly_message="AI provider authentication failed. Please verify the server-side API key configuration.",
            is_retryable=False
        )

class LLMRateLimitError(LLMProviderError):
    """Raised when provider rate limits are exceeded (HTTP 429)."""
    def __init__(self, message: str, provider: str = "unknown", retry_after_seconds: Optional[float] = None):
        super().__init__(
            message=message,
            provider=provider,
            status_code=429,
            user_friendly_message="The AI assistant is temporarily experiencing high traffic volume. Please wait a few seconds and try again.",
            is_retryable=True
        )
        self.retry_after_seconds = retry_after_seconds

class LLMQuotaExhaustedError(LLMProviderError):
    """Raised when provider credit or monthly token quota is depleted."""
    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            status_code=403,
            user_friendly_message="The AI service quota has been exceeded. Please notify the system administrator or check billing limits.",
            is_retryable=False
        )

class LLMTimeoutError(LLMProviderError):
    """Raised when a request exceeds the configured network timeout."""
    def __init__(self, message: str, provider: str = "unknown", timeout_seconds: float = 30.0):
        super().__init__(
            message=message,
            provider=provider,
            status_code=408,
            user_friendly_message=f"The AI model request timed out after {timeout_seconds:.1f}s. Please try a simpler query or retry.",
            is_retryable=True
        )
        self.timeout_seconds = timeout_seconds

class LLMNetworkError(LLMProviderError):
    """Raised when cloud network connectivity fails or host is unreachable."""
    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            status_code=503,
            user_friendly_message="Unable to establish a secure connection to the cloud AI service. Please check your network connection.",
            is_retryable=True
        )

class LLMValidationError(LLMProviderError):
    """Raised when model response cannot be parsed into the required schema."""
    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            status_code=422,
            user_friendly_message="The AI model generated an uninterpretable response format. Please rephrase your request.",
            is_retryable=True
        )

class LLMInputLengthExceededError(LLMProviderError):
    """Raised when student natural language input exceeds safety bounds."""
    def __init__(self, char_count: int, max_chars: int):
        super().__init__(
            message=f"Input length {char_count} chars exceeds limit of {max_chars}",
            provider="pre_validation",
            status_code=400,
            user_friendly_message=f"Your message is {char_count} characters, which exceeds the limit of {max_chars}. Please submit a more concise request.",
            is_retryable=False
        )
        self.char_count = char_count
        self.max_chars = max_chars

