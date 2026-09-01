"""[담당 B] 문헌 검색 엔드포인트. 프론트 /literature 화면이 사용."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.retrieval.knowledge_rag.search import hybrid_search, quality_score

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
    q: str = Query(..., min_length=2, description="검색 질의. 한국어 가능"),
    top_k: int = Query(5, ge=1, le=20),
    coverage: list[str] | None = Query(
        None, description="CheXpert observation 으로 범위 제한. 예: Pneumothorax"
    ),
    bm25: bool = Query(False, description="BM25 병행. 평가상 성능이 하락하여 기본 비활성"),
    rerank: bool = Query(False, description="cross-encoder 리랭킹. 동일 사유로 기본 비활성"),
) -> list[LiteratureHit]:
    """Knowledge RAG 검색.

    한국어 질의는 자동으로 영문 번역 후 검색한다. 코퍼스가 영문이라
    번역 없이는 Hit@8 이 1.000 에서 0.750 으로 떨어진다.
    """
    try:
        hits = hybrid_search(
            q, top_k=top_k, coverage=coverage, use_bm25=bm25, use_rerank=rerank
        )
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
