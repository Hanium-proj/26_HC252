"""[공통] 전체 파이프라인 + 스트리밍 답변. 프론트 /agent 화면이 사용.

A -> B -> Synthesis 를 한 번에 태우는 통합 엔드포인트다.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents import pipeline
from app.core.ai import public_error
from app.tools.vision._store import get_store

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    case_id: str = ""
    query: str = Field(min_length=2, max_length=3000)
    image_ref: str | None = Field(default=None, max_length=512)


def _sse(event: str, payload: object) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


def check_artifacts(req: AgentRequest) -> None:
    if req.image_ref:
        store = get_store()
        if not store.available:
            raise HTTPException(
                503, "팀 모델 사전 산출물이 없습니다. GLASS_HANDOFF_DIR 설정이 필요합니다."
            )
        if store.get(req.image_ref) is None:
            raise HTTPException(
                404,
                "사전 예측에서 이 영상을 찾지 못했습니다. 새 업로드 영상은 /analyze를 사용하세요.",
            )


@router.post("/replay/run")
@router.post("/run", include_in_schema=False)
async def run(req: AgentRequest) -> dict:
    """비스트리밍 실행. 실행 사례 생성과 디버깅에 쓴다."""
    check_artifacts(req)
    result = await pipeline.run(req.query, image_ref=req.image_ref)
    return result.to_dict()


@router.post("/replay/stream")
async def stream(req: AgentRequest) -> StreamingResponse:
    """SSE 로 파이프라인 진행 상황과 최종 판정을 흘려보낸다.

    이벤트 순서 (프론트가 이 순서를 가정한다):
        plan     -> Plan
        tool     -> 도구 실행 결과
        evidence -> EvidencePacket
        verdict  -> FinalEvidence
        done
    """

    check_artifacts(req)

    async def events() -> AsyncIterator[str]:
        yield _sse("status", {"mode": "artifact_replay", "status": "running"})
        try:
            result = await pipeline.run(req.query, image_ref=req.image_ref)
        except Exception as exc:  # 파이프라인 자체 실패만 error 로 보낸다
            yield _sse("error", {"detail": public_error(exc)})
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
