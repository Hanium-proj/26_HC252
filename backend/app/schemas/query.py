"""Query & Evidence Planner 의 출력 계약 (담당 A)."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.common import ToolName


class QueryType(str, Enum):
    """질문 유형. 어떤 근거가 필요한지를 결정한다."""

    EXISTENCE = "existence"        # "흉수 있나요?"        -> classifier
    LOCALIZATION = "localization"  # "어디에 있나요?"      -> classifier + localizer
    QUANTIFICATION = "quantification"  # "얼마나 심한가요?" -> quantifier
    COMPARISON = "comparison"      # "이전보다 나빠졌나요?" -> classifier + quantifier(prior)
    KNOWLEDGE = "knowledge"        # "이 소견의 의미는?"   -> knowledge_rag
    OUT_OF_SCOPE = "out_of_scope"  # Gatekeeper 가 차단


class RequiredEvidence(BaseModel):
    """Planner 가 '이 근거는 반드시 있어야 한다'고 선언한 항목."""

    claim: str
    tool: ToolName
    required: bool = Field(
        default=True, description="False 면 있으면 좋은 보조 근거"
    )
    reason: str = Field(default="", description="왜 이 근거가 필요한지")


class QueryPlan(BaseModel):
    """Planner 출력. tool orchestration 의 실행 계획서."""

    case_id: str
    query: str
    query_type: QueryType
    required_evidence: list[RequiredEvidence] = Field(default_factory=list)
    tool_order: list[ToolName] = Field(
        default_factory=list, description="호출 순서. 앞 도구 결과가 뒤 도구 입력이 됨"
    )
    rejected_reason: str | None = Field(
        default=None, description="Gatekeeper 차단 시 사유"
    )
