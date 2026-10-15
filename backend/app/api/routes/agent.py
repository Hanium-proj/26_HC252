"""[공통] 전체 파이프라인 + 스트리밍 답변. 프론트 /agent 화면이 사용.

A -> B -> Synthesis 를 한 번에 태우는 통합 엔드포인트다.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents import pipeline

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    case_id: str = ""
    query: str
    image_ref: str | None = None


def _sse(event: str, payload: object) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


@router.post("/run")
async def run(req: AgentRequest) -> dict:
    """비스트리밍 실행. 실행 사례 생성과 디버깅에 쓴다."""
    result = await pipeline.run(req.query, image_ref=req.image_ref)
    return result.to_dict()


@router.post("/stream")
async def stream(req: AgentRequest) -> StreamingResponse:
    """SSE 로 파이프라인 진행 상황과 최종 판정을 흘려보낸다.

    이벤트 순서 (프론트가 이 순서를 가정한다):
        plan     -> Plan
        tool     -> 도구 실행 결과
        evidence -> EvidencePacket
        verdict  -> FinalEvidence
        done
    """

    async def events() -> AsyncIterator[str]:
        try:
            result = await pipeline.run(req.query, image_ref=req.image_ref)
        except Exception as exc:  # 파이프라인 자체 실패만 error 로 보낸다
            yield _sse("error", {"detail": f"{type(exc).__name__}: {exc}"})
            return

        if result.blocked:
            yield _sse("error", {"detail": result.block_reason, "blocked": True})
            yield _sse("done", {"blocked": True})
            return

        if result.plan:
            yield _sse("plan", result.plan.model_dump(mode="json"))

        if result.packet:
            for tr in result.packet.tool_results:
                yield _sse("tool", tr.model_dump(mode="json"))
            yield _sse("evidence", result.packet.model_dump(mode="json"))

        for item in result.retrieved:
            yield _sse(
                "tool",
                {
                    "tool_name": item.source.value,
                    "status": "success",
                    "payload": item.metadata,
                },
            )

        if result.final:
            yield _sse("verdict", result.final.model_dump(mode="json"))

        yield _sse("done", {"notes": result.notes})

    return StreamingResponse(events(), media_type="text/event-stream")
