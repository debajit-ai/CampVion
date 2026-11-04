from typing import Dict, Any, List
from app.schemas.tool import ToolSchema

class BaseTool:
    name: str = ""
    description: str = ""
    category: str = ""
    input_schema: Dict[str, Any] = {}
    output_schema: Dict[str, Any] = {}
    requires_human_approval: bool = False
    required_permissions: List[str] = ["student"]
    expected_failure_conditions: List[str] = []
    retry_policy: Dict[str, Any] = {
        "max_retries": 3,
        "retryable_errors": ["timeout", "transient_network"],
        "is_idempotent": True
    }
    side_effects: str = "read_only"
    audit_requirements: str = "standard_log"

    def to_schema(self) -> ToolSchema:
        return ToolSchema(
            name=self.name,
            description=self.description,
            category=self.category,
            input_schema=self.input_schema,
            requires_human_approval=self.requires_human_approval,
            output_schema=self.output_schema,
            required_permissions=self.required_permissions,
            expected_failure_conditions=self.expected_failure_conditions,
            retry_policy=self.retry_policy,
            side_effects=self.side_effects,
            audit_requirements=self.audit_requirements
        )

    def execute(self, **kwargs) -> Any:
        raise NotImplementedError("Tool must implement execute method")
