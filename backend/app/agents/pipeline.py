"""[공통] end-to-end 파이프라인.

    질문 + 영상
      -> Gatekeeper (범위 판정)
      -> Planner (유형 분류, 필요 근거·도구 결정)
      -> Orchestrator (vision tool 실행 -> EvidencePacket)
      -> Knowledge RAG / Case RAG (문헌·증례 근거)
      -> Trust & Conflict Resolver (유형별 가중 -> 판정)
      -> FinalEvidence

RAG 는 선택적으로 동작한다. Qdrant 인덱스나 API 키가 없으면 문헌 근거 없이
진행하고 그 사실을 limitations 에 남긴다. 검색 실패를 파이프라인 실패로
만들지 않는 이유는, 영상 근거만으로도 판정이 성립해야 하고 Trust 가
근거 결손을 이미 다루기 때문이다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.agents import gatekeeper, orchestrator, planner
from app.schemas.evidence import EvidenceItem, EvidencePacket
from app.schemas.query import Plan, QueryInput
from app.schemas.verdict import FinalEvidence
from app.trust.resolver import resolve


@dataclass
class PipelineResult:
    """한 질의의 전체 실행 기록. 논문 실행 사례의 단위가 된다."""

    query: QueryInput
    blocked: bool = False
    block_reason: str = ""
    plan: Plan | None = None
    packet: EvidencePacket | None = None
    retrieved: list[EvidenceItem] = field(default_factory=list)
    final: FinalEvidence | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query.model_dump(),
            "blocked": self.blocked,
            "block_reason": self.block_reason,
            "plan": self.plan.model_dump(mode="json") if self.plan else None,
            "packet": self.packet.model_dump(mode="json") if self.packet else None,
            "retrieved": [r.model_dump(mode="json") for r in self.retrieved],
            "final": self.final.model_dump(mode="json") if self.final else None,
            "notes": self.notes,
        }


async def run(
    question: str,
    image_ref: str | None = None,
    context: dict[str, Any] | None = None,
    use_knowledge: bool = True,
    use_case: bool = True,
) -> PipelineResult:
    """질의 하나를 끝까지 실행한다."""
    query = QueryInput(
        question=question, image_path=image_ref, context=context or {}
    )
    result = PipelineResult(query=query)

    # 1. Gatekeeper
    gate = gatekeeper.check(question, has_image=bool(image_ref))
    if not gate.allowed:
        result.blocked = True
        result.block_reason = gate.reason
        return result

    # 2. Planner
    result.plan = planner.plan(query)

    # 3. Vision tool orchestration
    result.packet = await orchestrator.run(result.plan, image_ref, query=query)

    # 4. RAG (선택적)
    retrieved: list[EvidenceItem] = []
    if use_knowledge:
        got, note = await _knowledge(result.plan)
        retrieved += got
        if note:
            result.notes.append(note)
    if use_case:
        got, note = await _cases(result.plan)
        retrieved += got
        if note:
            result.notes.append(note)
    result.retrieved = retrieved

    # 5. Trust & Conflict Resolver
    result.final = await resolve(result.packet, retrieved)

    # RAG 를 쓰지 못한 사실은 최종 산출물의 한계로 남긴다
    for note in result.notes:
        if note not in result.final.limitations:
            result.final.limitations.append(note)

    return result


async def _knowledge(plan: Plan) -> tuple[list[EvidenceItem], str]:
    """문헌 근거를 검색한다. 실패하면 빈 결과와 사유를 돌려준다.

    claim 인자는 Trust 가 근거를 묶는 조인 키가 된다. 검증 대상이 없으면
    문헌 근거가 어느 소견에 붙는지 알 수 없으므로 검색하지 않는다.
    """
    targets = plan.resolved_targets()
    queries = plan.knowledge_requirements
    if not targets or not queries:
        return [], ""
    try:
        from app.retrieval.knowledge_rag import search as ksearch

        items: list[EvidenceItem] = []
        for claim, q in zip(targets[:2], queries[:2], strict=False):
            items += await ksearch.search(claim, q, top_k=3)
        return items, ""
    except Exception as exc:
        return [], f"문헌 검색 불가 ({type(exc).__name__}): 문헌 근거 없이 판정함"


async def _cases(plan: Plan) -> tuple[list[EvidenceItem], str]:
    """유사 증례 근거를 검색한다. 실패하면 빈 결과와 사유를 돌려준다."""
    targets = plan.resolved_targets()
    if not targets:
        return [], ""
    try:
        from app.retrieval.case_rag import search as csearch

        claim = targets[0]
        return await csearch.search(claim, f"chest radiograph with {claim}", top_k=8), ""
    except Exception as exc:
        return [], f"증례 검색 불가 ({type(exc).__name__}): 증례 근거 없이 판정함"
