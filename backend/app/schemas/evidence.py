"""Evidence Packet - A 담당과 B 담당 사이의 단일 계약.

담당 A(Agent & Vision)는 vision tool 실행 결과를 EvidenceItem 리스트로 정규화해
EvidencePacket 을 만들어 넘긴다.
담당 B(Retrieval & Trust)는 ViT / CAM 내부 구현을 몰라도 이 packet 만 보고
신뢰도 계산과 충돌 해결을 수행할 수 있다.

계약 예시 (담당자 간 합의된 최소 형태):

    {
      "claim": "pleural_effusion",
      "tool": "classifier",
      "result": true,
      "confidence": 0.82,
      "evidence": {"location": "left_costophrenic_angle"},
      "quality": 0.91
    }
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import EvidenceKind, ToolName


class EvidenceItem(BaseModel):
    """도구 하나가 주장 하나에 대해 내놓은 근거 단위."""

    claim: str = Field(..., description="검증 대상 주장. 예: pleural_effusion")
    tool: ToolName = Field(..., description="이 근거를 만든 도구")
    kind: EvidenceKind = Field(..., description="근거의 출처 성격")

    result: bool | float | str = Field(
        ..., description="도구의 판정. classifier=bool, quantifier=float, vqa=str"
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="도구가 자기 판정에 대해 보고한 확신도"
    )
    quality: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="입력 품질 점수. 영상 노이즈/자세/문헌 신선도 등에서 산출",
    )

    evidence: dict[str, Any] = Field(
        default_factory=dict,
        description="도구별 부가 근거. localizer=bbox/location, rag=citation 등",
    )
    latency_ms: int | None = Field(default=None, description="도구 실행 소요 시간")


class EvidencePacket(BaseModel):
    """담당 A -> 담당 B 로 넘어가는 컨테이너.

    B 는 이 packet 과 자기 RAG 근거를 합쳐 FinalEvidence 를 만든다.
    """

    case_id: str = Field(..., description="분석 단위 식별자")
    query: str = Field(..., description="사용자 원본 질문")
    items: list[EvidenceItem] = Field(default_factory=list)

    missing_evidence: list[str] = Field(
        default_factory=list,
        description="Planner 가 요구했으나 수집하지 못한 근거 목록",
    )
    notes: dict[str, Any] = Field(
        default_factory=dict, description="파이프라인 디버그용 메타"
    )

    def by_claim(self, claim: str) -> list[EvidenceItem]:
        """같은 주장에 대한 근거만 추린다. 충돌 탐지의 시작점."""
        return [item for item in self.items if item.claim == claim]

    @property
    def claims(self) -> list[str]:
        """packet 이 다루는 주장 목록(중복 제거, 등장 순서 유지)."""
        seen: dict[str, None] = {}
        for item in self.items:
            seen.setdefault(item.claim, None)
        return list(seen)
