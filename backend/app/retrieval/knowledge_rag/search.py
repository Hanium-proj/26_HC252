"""[담당 B] 6단계 - 하이브리드 검색. Dense + BM25 -> RRF -> rerank."""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem


async def search(claim: str, query: str, top_k: int = 5) -> list[EvidenceItem]:
    """문헌 근거를 검색해 EvidenceItem(kind=LITERATURE) 로 반환한다.

    1. dense 검색 + BM25 검색을 각각 top-N
    2. RRF 로 두 순위를 융합  score = sum(1 / (k + rank))
    3. cross-encoder 로 reranking
    4. 상위 top_k 를 EvidenceItem 으로 변환
       - confidence: rerank 점수를 정규화
       - quality: 저널 권위 + 발행 연도 신선도
       - evidence: {"pmid": ..., "title": ..., "section": ...} 인용 정보
    """
    raise NotImplementedError("담당 B: 하이브리드 검색 구현")
