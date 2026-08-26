"""Trust & Conflict Resolver 의 출력 계약 (담당 B)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Verdict
from app.schemas.evidence import EvidenceItem


class Conflict(BaseModel):
    """같은 주장에 대해 도구들이 서로 다른 판정을 낸 상황."""

    claim: str
    items: list[EvidenceItem]
    description: str = Field(default="", description="충돌 내용 사람이 읽는 설명")
    resolved_to: bool | float | str | None = Field(
        default=None, description="Resolver 가 채택한 값. 해결 실패 시 None"
    )


class ClaimVerdict(BaseModel):
    """주장 하나에 대한 최종 판정."""

    claim: str
    verdict: Verdict
    trust_score: float = Field(
        ..., ge=0.0, le=1.0, description="도구별 신뢰도 * 품질 을 합산한 최종 점수"
    )
    supporting: list[EvidenceItem] = Field(default_factory=list)
    opposing: list[EvidenceItem] = Field(default_factory=list)
    conflict: Conflict | None = None
    rationale: str = Field(default="", description="왜 이 verdict 인지")


class FinalEvidence(BaseModel):
    """Resolver 출력. Qwen Synthesis 입력이 된다."""

    case_id: str
    query: str
    verdicts: list[ClaimVerdict] = Field(default_factory=list)
    citations: list[dict] = Field(
        default_factory=list, description="RAG 출처. 최종 답변에 인용"
    )
    overall: Verdict = Field(
        default=Verdict.NEED_MORE_EVIDENCE, description="케이스 전체 상태"
    )
