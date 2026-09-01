"""[담당 B] Case RAG 엔드포인트 - 유사 증례 검색.

주의: 이 엔드포인트는 MIMIC-CXR 판독문에서 파생된 내용을 반환한다.
PhysioNet credentialed 데이터이므로 인증 없이 공개해서는 안 된다.
`API_KEY` 환경변수가 설정되면 전 요청에 키 검사가 걸린다.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import require_api_key
from app.retrieval.case_rag.search import agreement, search_raw, support_quality

router = APIRouter(prefix="/cases", tags=["cases"], dependencies=[Depends(require_api_key)])


class CaseHitOut(BaseModel):
    case_id: str
    score: float
    text: str
    positive_findings: list[str]
    view_positions: str
    image_count: int


class CaseSearchResponse(BaseModel):
    """증례 검색 응답.

    개별 사례가 아니라 집계가 근거다. 따라서 agreement_ratio 를 함께 반환하며,
    담당 A 는 이 비율을 근거 강도로 사용하면 된다.
    """

    n_cases: int
    agreement_ratio: float | None
    quality: float
    mean_similarity: float
    hits: list[CaseHitOut]


@router.get("/search", response_model=CaseSearchResponse)
async def search(
    q: str = Query(..., min_length=2, description="판독 소견 문장 또는 질의"),
    top_k: int = Query(10, ge=1, le=50),
    claim: str | None = Query(
        None, description="일치율을 계산할 observation. 예: Pleural Effusion"
    ),
    require: list[str] | None = Query(None, description="해당 소견 보유 사례로 제한"),
    exclude_no_finding: bool = Query(False),
) -> CaseSearchResponse:
    try:
        hits = search_raw(
            q,
            top_k=top_k,
            require_findings=require,
            exclude_no_finding=exclude_no_finding,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"증례 인덱스 사용 불가: {e}") from e

    if not hits:
        return CaseSearchResponse(
            n_cases=0, agreement_ratio=None, quality=0.0, mean_similarity=0.0, hits=[]
        )

    return CaseSearchResponse(
        n_cases=len(hits),
        agreement_ratio=round(agreement(hits, claim), 3) if claim else None,
        quality=support_quality(hits),
        mean_similarity=round(sum(h.score for h in hits) / len(hits), 4),
        hits=[
            CaseHitOut(
                case_id=h.payload["case_id"],
                score=round(h.score, 4),
                text=h.payload["text"],
                positive_findings=h.payload.get("positive_findings", []),
                view_positions=h.payload.get("view_positions", ""),
                image_count=h.payload.get("image_count", 0),
            )
            for h in hits
        ],
    )
