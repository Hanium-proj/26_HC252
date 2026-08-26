"""[담당 B] 문헌 검색 단독 엔드포인트. 프론트 /literature 화면이 사용."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.evidence import EvidenceItem

router = APIRouter(prefix="/literature", tags=["literature"])


@router.get("/search", response_model=list[EvidenceItem])
async def search(q: str, top_k: int = 5) -> list[EvidenceItem]:
    """하이브리드 검색 결과를 반환한다.

    구현 시:
        return await knowledge_rag.search.search(claim=q, query=q, top_k=top_k)
    """
    raise HTTPException(status_code=501, detail="담당 B: 문헌 검색 미구현")
