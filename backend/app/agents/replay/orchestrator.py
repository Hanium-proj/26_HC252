"""[담당 A] Tool Orchestration - QueryPlan 을 실행해 EvidencePacket 을 만든다.

여기가 담당 A 의 출구다. 이 함수의 반환값이 곧 담당 B 의 입력이다.

설계 원칙:
  - 도구 실패를 예외로 올리지 않는다. ToolResult(status=FAILED) 로 기록하고
    계속 진행한다. Trust 가 근거 결손을 판정할 수 있어야 하기 때문이다.
  - 영상 품질이 임계 미만이면 조기 종료한다. 판독 불가능한 영상에서
    분류 확률을 산출하는 것은 근거가 아니라 잡음이다.
"""

from __future__ import annotations

import time

from app.agents.replay import classifier, gatekeeper, localizer
from app.schemas.common import PacketStatus, ToolName, ToolStatus
from app.schemas.evidence import EvidenceItem, EvidencePacket, ToolResult
from app.schemas.query import Plan, QueryInput

# 이 품질 미만이면 이후 영상 도구를 호출하지 않는다.
# Trust 의 QUALITY_FLOOR(0.25)와 맞춘다. 어차피 0점 처리될 근거를 만들기 위해
# 도구를 호출하는 것은 낭비이며, 결손으로 남기는 편이 판정에 정확하다.
QUALITY_ABORT = 0.25


async def run(plan: Plan, image_ref: str | None, query: QueryInput | None = None) -> EvidencePacket:
    """plan.tool_call_order 를 따라 vision tool 을 호출하고 결과를 정규화한다."""
    query = query or QueryInput(question="", image_path=image_ref)
    items: list[EvidenceItem] = []
    results: list[ToolResult] = []
    limitations: list[str] = []
    status = PacketStatus.COMPLETE

    targets = plan.resolved_targets()
    quality = 1.0

    for tool in plan.tool_call_order:
        started = time.perf_counter()
        try:
            produced = await _dispatch(tool, image_ref, targets)
        except Exception as exc:  # 도구 실패는 기록만 하고 진행한다
            results.append(
                ToolResult(tool_name=tool, status=ToolStatus.FAILED, error=str(exc)[:200])
            )
            limitations.append(f"{tool.value} 실행 실패: {str(exc)[:120]}")
            status = PacketStatus.PARTIAL
            continue

        elapsed = int((time.perf_counter() - started) * 1000)

        if not produced:
            results.append(
                ToolResult(
                    tool_name=tool,
                    status=ToolStatus.SKIPPED,
                    error="산출물 없음 (해당 영상·소견의 결과가 존재하지 않음)",
                )
            )
            status = PacketStatus.PARTIAL
            continue

        for it in produced:
            it.latency_ms = elapsed
        items.extend(produced)
        results.append(
            ToolResult(
                tool_name=tool,
                status=ToolStatus.SUCCESS,
                payload=produced[0].metadata,
                confidence=produced[0].confidence,
            )
        )

        # Gatekeeper 직후 품질 게이트. 이후 도구 호출 여부를 결정한다.
        if tool is ToolName.GATEKEEPER:
            q = produced[0].metadata.get("quality")
            if isinstance(q, int | float):
                quality = float(q)
            if quality < QUALITY_ABORT:
                limitations.append(
                    f"입력 영상 품질 {quality:.2f} 가 임계값 {QUALITY_ABORT} 미만이어서 "
                    "영상 분석을 중단함"
                )
                status = PacketStatus.BLOCKED
                break

    if image_ref is None:
        limitations.append("영상이 제공되지 않아 영상 근거를 수집하지 못함")
        status = PacketStatus.PARTIAL

    packet = EvidencePacket(
        query=query,
        plan=plan,
        items=items,
        tool_results=results,
        limitations=limitations,
        status=status,
    )

    # 결손이 있으면 PARTIAL 로 낮춘다. Trust 가 별도로 판정하지만
    # packet 단계에서도 상태가 드러나야 디버깅이 쉽다.
    if packet.missing_evidence() and status is PacketStatus.COMPLETE:
        packet.status = PacketStatus.PARTIAL

    return packet


async def _dispatch(
    tool: ToolName, image_ref: str | None, targets: list[str]
) -> list[EvidenceItem]:
    """도구 하나를 호출한다."""
    if image_ref is None:
        return []

    if tool is ToolName.GATEKEEPER:
        item = await gatekeeper.inspect(image_ref)
        return [item] if item else []

    if tool is ToolName.CLASSIFIER:
        return await classifier.classify(image_ref, targets=targets)

    if tool is ToolName.LOCALIZER:
        return await localizer.localize(image_ref, targets=targets)

    # VQA / Quantifier 는 현재 미구현. 호출되면 산출물 없음으로 처리되어
    # 필수 근거였다면 NEED_MORE_EVIDENCE 판정으로 이어진다.
    return []
