"""[담당 A] Tool Orchestration - QueryPlan 을 실행해 EvidencePacket 을 만든다.

여기가 담당 A 의 출구다. 이 함수의 반환값이 곧 담당 B 의 입력이다.
"""

from __future__ import annotations

from app.schemas.evidence import EvidencePacket
from app.schemas.query import QueryPlan


async def run(plan: QueryPlan, image_ref: str | None) -> EvidencePacket:
    """plan.tool_order 를 따라 vision tool 을 호출하고 결과를 정규화한다.

    각 도구 결과는 반드시 EvidenceItem 으로 변환해 packet.items 에 넣는다.
    호출에 실패했거나 조건이 안 맞아 건너뛴 required 근거는
    packet.missing_evidence 에 claim 이름으로 남긴다. (B 가 NEED_MORE_EVIDENCE 판정에 사용)

    LangGraph 로 갈아끼울 지점도 여기다.
    """
    raise NotImplementedError("담당 A: orchestration 구현")
