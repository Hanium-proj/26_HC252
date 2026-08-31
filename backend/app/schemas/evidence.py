"""Evidence Packet - 담당 A와 담당 B 사이의 단일 계약.

담당 A(Agent & Vision)가 vision tool 실행 결과를 EvidenceItem 으로 정규화해
EvidencePacket 을 만들어 넘긴다. 담당 B(Retrieval & Trust)는 ViT / CAM 내부
구현을 몰라도 이 packet 만 보고 신뢰도 계산과 충돌 해결을 수행한다.

담당 A 파이프라인 출력 형식을 기준으로 한다:

    {
      "source": "classifier",
      "claim": "{'finding': 'pleural_effusion', 'probability': 0.82}",
      "evidence_type": "model",
      "confidence": 0.82,
      "metadata": {"finding": "pleural_effusion", "probability": 0.82}
    }

Trust 계산에 필요한 값(검증 대상, 판정, 입력 품질)은 metadata 에서 도출한다.
도출 규칙은 app/trust/normalize.py 에 있다.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import EvidenceType, PacketStatus, ToolName, ToolStatus
from app.schemas.query import Plan, QueryInput

# required_evidence 항목명 -> 담당 도구. 키워드가 항목명에 포함되면 매칭한다.
# 담당 A 의 명명 규칙에 맞춰 유지해야 하며, 새 항목 추가 시 합의가 필요하다.
EVIDENCE_TOOL_KEYWORDS: list[tuple[tuple[str, ...], ToolName]] = [
    (("classifier", "prediction", "probability"), ToolName.CLASSIFIER),
    (("cam", "localization", "localizer", "heatmap", "region"), ToolName.LOCALIZER),
    (("vqa", "visual_question"), ToolName.VQA),
    (("quantif", "measurement", "ctr"), ToolName.QUANTIFIER),
    (("knowledge", "literature", "guideline"), ToolName.KNOWLEDGE),
    (("case", "similar"), ToolName.CASE),
    (("gatekeeper", "view", "quality"), ToolName.GATEKEEPER),
]


def evidence_owner(requirement: str) -> ToolName | None:
    """근거 항목명을 생산 도구로 매핑한다. 모르면 None."""
    name = requirement.lower()
    for keywords, tool in EVIDENCE_TOOL_KEYWORDS:
        if any(k in name for k in keywords):
            return tool
    return None


class EvidenceItem(BaseModel):
    """도구 하나가 내놓은 근거 단위."""

    source: ToolName = Field(..., description="이 근거를 만든 도구")
    claim: str = Field(..., description="도구가 주장하는 내용")
    evidence_type: EvidenceType = Field(..., description="근거의 출처 성격")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="도구가 자기 판정에 보고한 확신도"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="도구별 구조화 출력. Trust 계산의 입력이 된다",
    )
    latency_ms: int | None = None


class ToolResult(BaseModel):
    """도구 실행 결과. 실패한 호출도 기록한다.

    items 에는 성공한 근거만 담기므로, 어떤 도구가 실패했는지는 여기서만 알 수 있다.
    Trust 는 이 정보로 근거 결손을 판정한다.
    """

    tool_name: ToolName
    status: ToolStatus
    payload: dict[str, Any] = Field(default_factory=dict)
    confidence: float | None = None
    error: str | None = None


class EvidencePacket(BaseModel):
    """담당 A -> 담당 B 로 넘어가는 컨테이너."""

    query: QueryInput
    plan: Plan
    items: list[EvidenceItem] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    status: PacketStatus = PacketStatus.COMPLETE

    def by_source(self, source: ToolName) -> list[EvidenceItem]:
        return [it for it in self.items if it.source is source]

    def failed_tools(self) -> list[ToolName]:
        """실패하거나 건너뛴 도구. 근거 결손 판정의 근거가 된다."""
        return [
            r.tool_name
            for r in self.tool_results
            if r.status is not ToolStatus.SUCCESS
        ]

    def missing_evidence(self) -> list[str]:
        """Planner 가 요구했으나 확보하지 못한 근거.

        required_evidence 항목명은 도구명과 1:1이 아니다.
        (cam_localization 을 만드는 것은 localizer)
        따라서 키워드로 담당 도구를 판정한다. 새 근거 항목명을 추가할 때는
        EVIDENCE_TOOL_KEYWORDS 도 함께 갱신해야 한다.
        """
        produced = {it.source for it in self.items}
        failed = set(self.failed_tools())

        missing = []
        for req in self.plan.required_evidence:
            tool = evidence_owner(req)
            if tool is None:
                # 담당 도구를 알 수 없는 항목은 결손 판정을 보류한다.
                # 임의로 결손 처리하면 모든 케이스가 NEED_MORE_EVIDENCE 가 된다
                continue
            if tool in failed or tool not in produced:
                missing.append(req)
        return missing
