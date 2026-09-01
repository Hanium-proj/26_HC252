"""Trust & Conflict Resolver 의 출력 계약 (담당 B)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import TaskType, Verdict
from app.schemas.evidence import EvidenceItem


class Conflict(BaseModel):
    """같은 주장에 대해 도구들이 서로 다른 판정을 낸 상황."""

    claim: str
    items: list[EvidenceItem] = Field(default_factory=list)
    description: str = ""
    resolved_to: bool | None = Field(
        default=None, description="Resolver 가 채택한 값. 해결 실패 시 None"
    )


class ClaimVerdict(BaseModel):
    """주장 하나에 대한 최종 판정."""

    claim: str
    verdict: Verdict
    trust_score: float = Field(..., ge=0.0, le=1.0)
    supporting: list[EvidenceItem] = Field(default_factory=list)
    opposing: list[EvidenceItem] = Field(default_factory=list)
    conflict: Conflict | None = None
    rationale: str = ""


class FinalEvidence(BaseModel):
    """Resolver 출력. Qwen Synthesis 입력이 된다."""

    query: str
    task_type: TaskType | None = None
    verdicts: list[ClaimVerdict] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    overall: Verdict = Verdict.NEED_MORE_EVIDENCE
