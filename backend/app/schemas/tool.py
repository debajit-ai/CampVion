from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class ToolSchema(BaseModel):
    name: str
    description: str
    category: str
    input_schema: Dict[str, Any]
    requires_human_approval: bool
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    required_permissions: List[str] = Field(default_factory=lambda: ["student"])
    expected_failure_conditions: List[str] = Field(default_factory=list)
    retry_policy: Dict[str, Any] = Field(
        default_factory=lambda: {"max_retries": 3, "retryable_errors": ["timeout", "transient_network"], "is_idempotent": True}
    )
    side_effects: str = "read_only"
    audit_requirements: str = "standard_log"
