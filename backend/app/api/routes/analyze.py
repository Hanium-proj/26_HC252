"""[담당 A] 분석 파이프라인 진입점. Planner -> Vision tools -> EvidencePacket."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.evidence import EvidencePacket

router = APIRouter(prefix="/analyze", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    case_id: str
    query: str
    image_ref: str | None = None


@router.post("", response_model=EvidencePacket)
async def analyze(req: AnalyzeRequest) -> EvidencePacket:
    """담당 A 파이프라인을 돌려 EvidencePacket 을 반환한다.

    구현 시:
        plan = planner.plan(req.case_id, req.query, req.image_ref is not None)
        return await orchestrator.run(plan, req.image_ref)
    """
    raise HTTPException(status_code=501, detail="담당 A: analyze 파이프라인 미구현")
