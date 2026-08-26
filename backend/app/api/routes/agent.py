"""[공통] 전체 파이프라인 + 스트리밍 답변. 프론트 /agent 화면이 사용.

A -> B -> Synthesis 를 한 번에 태우는 통합 엔드포인트다.
두 담당자의 결과물이 실제로 맞물리는지 여기서 확인하게 된다.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    case_id: str
    query: str
    image_ref: str | None = None


@router.post("/stream")
async def stream(req: AgentRequest) -> StreamingResponse:
    """SSE 로 파이프라인 진행 상황과 최종 답변을 흘려보낸다.

    이벤트 순서 (프론트가 이 순서를 가정한다):
        plan     -> QueryPlan
        tool     -> 도구 실행 시작/완료
        evidence -> EvidencePacket
        verdict  -> FinalEvidence
        token    -> 답변 토큰
        done
    """

    async def events():
        yield 'event: error\ndata: {"detail":"파이프라인 미구현"}\n\n'

    return StreamingResponse(events(), media_type="text/event-stream")
