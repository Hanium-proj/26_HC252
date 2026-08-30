"""[담당 B] 5단계 - 검색. Phase 1 은 dense 단독 + metadata 필터.

단계 구분은 다음과 같다:
  Phase 1 (현재) - dense retrieval, metadata filtering, top-k 5~8, citation 반환
  Phase 2        - BM25 추가, RRF 융합, cross-encoder reranking
  Phase 3        - query rewrite, sufficiency 평가(CRAG), web search fallback

검색 결과는 EvidenceItem(kind=LITERATURE) 으로 변환해 Trust Resolver 에 넘긴다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchAny

from app.core.config import get_settings
from app.retrieval.knowledge_rag.embed import aembed_query, embed_query
from app.retrieval.knowledge_rag.index import get_client
from app.schemas.common import EvidenceKind, ToolName
from app.schemas.evidence import EvidenceItem

# 문서 유형별 기본 권위도. guideline 은 학회 합의 문서라 단일 리뷰보다 무겁다.
_TYPE_AUTHORITY = {"guideline": 1.0, "review": 0.85, "review/reference": 0.8}

# 신선도 감쇠 기준 연도. 영상의학 권고는 개정 주기가 있어 오래된 문헌은 낮춘다.
_FRESHNESS_BASE = 2026
_FRESHNESS_HALFLIFE = 12.0


@dataclass
class SearchHit:
    """검색 결과 한 건. citation 에 필요한 정보를 모두 들고 있다."""

    score: float
    text: str
    payload: dict[str, Any]

    @property
    def citation(self) -> str:
        p = self.payload
        year = f", {p['year']}" if p.get("year") else ""
        return f"{p['title']} ({p['organization']}{year}) p.{p['page']}"


def quality_score(payload: dict[str, Any]) -> float:
    """문헌 근거의 품질 점수 (0~1). EvidenceItem.quality 로 들어간다.

    권위도(문서 유형) x 신선도(발행 연도) 로 계산한다.
    2003년 리뷰와 2024년 가이드라인을 같은 무게로 두면 Trust 계산이 무의미해진다.
    """
    authority = _TYPE_AUTHORITY.get(payload.get("document_type", ""), 0.75)

    year = payload.get("year")
    if not year:
        freshness = 0.7  # 연도 미상은 중간값. 임의로 높이지 않는다
    else:
        age = max(_FRESHNESS_BASE - int(year), 0)
        freshness = max(0.5 ** (age / _FRESHNESS_HALFLIFE), 0.3)

    return round(authority * freshness, 3)


def _build_filter(coverage: list[str] | None, doc_types: list[str] | None) -> Filter | None:
    """metadata 필터. 질환(observation)이나 문서 유형으로 검색 범위를 좁힌다."""
    must = []
    if coverage:
        must.append(FieldCondition(key="target_coverage", match=MatchAny(any=coverage)))
    if doc_types:
        must.append(FieldCondition(key="document_type", match=MatchAny(any=doc_types)))
    return Filter(must=must) if must else None


def search_raw(
    query: str,
    top_k: int = 5,
    coverage: list[str] | None = None,
    doc_types: list[str] | None = None,
) -> list[SearchHit]:
    """dense 검색 원본 결과. 평가 스크립트가 직접 쓴다."""
    settings = get_settings()
    client = get_client()

    res = client.query_points(
        collection_name=settings.knowledge_collection,
        query=embed_query(query),
        limit=top_k,
        query_filter=_build_filter(coverage, doc_types),
        with_payload=True,
    ).points

    return [SearchHit(score=p.score, text=p.payload["text"], payload=p.payload) for p in res]


async def search(
    claim: str,
    query: str,
    top_k: int = 5,
    coverage: list[str] | None = None,
) -> list[EvidenceItem]:
    """문헌 근거를 EvidenceItem(kind=LITERATURE) 으로 반환한다.

    담당 A 의 EvidencePacket 과 합쳐져 Trust Resolver 입력이 된다.
    """
    settings = get_settings()
    client = get_client()

    res = client.query_points(
        collection_name=settings.knowledge_collection,
        query=await aembed_query(query),
        limit=top_k,
        query_filter=_build_filter(coverage, None),
        with_payload=True,
    ).points

    items: list[EvidenceItem] = []
    for p in res:
        pl = p.payload
        items.append(
            EvidenceItem(
                claim=claim,
                tool=ToolName.KNOWLEDGE_RAG,
                kind=EvidenceKind.LITERATURE,
                result=pl["text"],
                # 코사인 유사도는 -1~1 이지만 OpenAI 임베딩 실사용 범위는 양수다.
                # 0~1 로 clamp 해 EvidenceItem 제약을 만족시킨다
                confidence=round(max(0.0, min(1.0, p.score)), 3),
                quality=quality_score(pl),
                evidence={
                    "chunk_id": pl["chunk_id"],
                    "doc_id": pl["doc_id"],
                    "title": pl["title"],
                    "organization": pl["organization"],
                    "year": pl["year"],
                    "page": pl["page"],
                    "section": pl["section"],
                    "source_url": pl["source_url"],
                },
            )
        )
    return items
