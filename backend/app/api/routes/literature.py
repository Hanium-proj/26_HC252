"""[담당 B] 문헌 검색 엔드포인트. 프론트 /literature 화면이 사용."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.retrieval.knowledge_rag.search import quality_score, search_raw

router = APIRouter(prefix="/literature", tags=["literature"])


class Citation(BaseModel):
    doc_id: str
    chunk_id: str
    title: str
    organization: str
    year: int | None
    page: int
    section: str | None
    source_url: str
    document_type: str


class LiteratureHit(BaseModel):
    score: float
    quality: float
    text: str
    citation: Citation


@router.get("/search", response_model=list[LiteratureHit])
async def search(
    q: str = Query(..., min_length=2, description="검색 질의"),
    top_k: int = Query(5, ge=1, le=20),
    coverage: list[str] | None = Query(
        None, description="CheXpert observation 으로 범위 제한. 예: Pneumothorax"
    ),
) -> list[LiteratureHit]:
    """Knowledge RAG 하이브리드 검색 (Phase 1: dense 단독)."""
    try:
        hits = search_raw(q, top_k=top_k, coverage=coverage)
    except Exception as e:  # 인덱스 미구축 / Qdrant 연결 실패
        raise HTTPException(
            status_code=503, detail=f"검색 인덱스를 사용할 수 없다: {e}"
        ) from e

    return [
        LiteratureHit(
            score=round(h.score, 4),
            quality=quality_score(h.payload),
            text=h.text,
            citation=Citation(
                doc_id=h.payload["doc_id"],
                chunk_id=h.payload["chunk_id"],
                title=h.payload["title"],
                organization=h.payload["organization"],
                year=h.payload["year"],
                page=h.payload["page"],
                section=h.payload["section"],
                source_url=h.payload["source_url"],
                document_type=h.payload["document_type"],
            ),
        )
        for h in hits
    ]
