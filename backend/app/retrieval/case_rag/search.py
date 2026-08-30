"""[담당 B] Case RAG - 유사 증례 검색.

Vision 파이프라인이 판정한 소견을 근거로 과거 유사 study 를 찾는다.
검색 결과는 EvidenceItem(kind=CASE) 로 Trust Resolver 에 전달된다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

from app.core.config import get_settings
from app.retrieval.knowledge_rag.embed import aembed_query, embed_query
from app.retrieval.knowledge_rag.index import get_client
from app.schemas.common import EvidenceKind, ToolName
from app.schemas.evidence import EvidenceItem

# 증례 근거의 신뢰도는 표본 수에 따라 달라진다. 유사 사례 2건으로 내린 판단과
# 200건으로 내린 판단을 같은 무게로 둘 수 없다.
_SUPPORT_SATURATION = 20.0


@dataclass
class CaseHit:
    score: float
    payload: dict[str, Any]

    @property
    def summary(self) -> str:
        p = self.payload
        views = p.get("view_positions", "").replace("|", ", ")
        findings = ", ".join(p.get("positive_findings", [])) or "No Finding"
        return f"{p['case_id']} ({views}) - {findings}"


def search_raw(
    query_text: str,
    top_k: int = 5,
    require_findings: list[str] | None = None,
    exclude_no_finding: bool = False,
) -> list[CaseHit]:
    """유사 증례 원본 검색 결과."""
    settings = get_settings()
    client = get_client()

    must = []
    if require_findings:
        must.append(
            FieldCondition(key="positive_findings", match=MatchAny(any=require_findings))
        )
    if exclude_no_finding:
        must.append(FieldCondition(key="no_finding", match=MatchValue(value=False)))

    res = client.query_points(
        collection_name=settings.case_collection,
        query=embed_query(query_text),
        limit=top_k,
        query_filter=Filter(must=must) if must else None,
        with_payload=True,
    ).points
    return [CaseHit(score=p.score, payload=p.payload) for p in res]


def agreement(hits: list[CaseHit], claim: str) -> float:
    """검색된 증례 중 해당 소견을 가진 비율.

    이 비율이 곧 증례 근거의 판정값이 된다. 유사 사례 10건 중 8건에서 흉수가
    관찰되었다면, 그 자체가 하나의 근거다.
    """
    if not hits:
        return 0.0
    n = sum(1 for h in hits if claim in h.payload.get("positive_findings", []))
    return n / len(hits)


def support_quality(hits: list[CaseHit]) -> float:
    """표본 수 기반 품질 점수. 사례가 많을수록 1.0 에 수렴한다."""
    return round(min(len(hits) / _SUPPORT_SATURATION, 1.0), 3)


async def search(
    claim: str,
    query_text: str,
    top_k: int = 10,
) -> list[EvidenceItem]:
    """유사 증례를 EvidenceItem(kind=CASE) 한 건으로 집계해 반환한다.

    증례는 개별 건이 아니라 *집계*가 근거다. "유사 사례 10건 중 8건에서
    흉수 관찰"이 근거이지, 특정 환자 1명의 소견이 근거가 되는 것은 아니다.
    따라서 top_k 건을 하나의 EvidenceItem 으로 요약한다.
    """
    settings = get_settings()
    client = get_client()

    res = client.query_points(
        collection_name=settings.case_collection,
        query=await aembed_query(query_text),
        limit=top_k,
        with_payload=True,
    ).points
    hits = [CaseHit(score=p.score, payload=p.payload) for p in res]
    if not hits:
        return []

    ratio = agreement(hits, claim)
    mean_score = sum(h.score for h in hits) / len(hits)

    return [
        EvidenceItem(
            claim=claim,
            tool=ToolName.CASE_RAG,
            kind=EvidenceKind.CASE,
            result=ratio >= 0.5,
            # 검색 유사도와 소견 일치율을 함께 반영한다. 유사하지 않은 사례가
            # 우연히 같은 소견을 가진 경우를 걸러내기 위함이다.
            confidence=round(max(0.0, min(1.0, mean_score * ratio)), 3),
            quality=support_quality(hits),
            evidence={
                "n_cases": len(hits),
                "agreement_ratio": round(ratio, 3),
                "mean_similarity": round(mean_score, 3),
                "case_ids": [h.payload["case_id"] for h in hits],
                "examples": [h.summary for h in hits[:3]],
            },
        )
    ]
