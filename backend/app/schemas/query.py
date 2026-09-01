"""Query & Evidence Planner 의 출력 계약 (담당 A)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import TaskType, ToolName


class QueryInput(BaseModel):
    """사용자 입력."""

    question: str
    image_path: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)

    @property
    def targets(self) -> list[str]:
        return list(self.context.get("targets", []))


class Plan(BaseModel):
    """Planner 출력. 도구 호출 실행 계획서."""

    task_type: TaskType
    target: str | None = None
    targets: list[str] = Field(default_factory=list)

    required_evidence: list[str] = Field(default_factory=list)
    supporting_evidence: list[str] = Field(default_factory=list)
    optional_evidence: list[str] = Field(default_factory=list)
    knowledge_requirements: list[str] = Field(default_factory=list)

    tool_call_order: list[ToolName] = Field(default_factory=list)
    expected_output_format: str = ""

    def resolved_targets(self) -> list[str]:
        """유효한 검증 대상 목록.

        target 과 targets 중복을 제거한다. Planner 가 target 만 채우는 경우와
        targets 만 채우는 경우가 모두 있기 때문이다.
        """
        out: dict[str, None] = {}
        for t in ([self.target] if self.target else []) + self.targets:
            if t:
                out.setdefault(t, None)
        return list(out)
