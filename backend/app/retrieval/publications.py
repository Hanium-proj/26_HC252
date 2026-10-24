"""Live Europe PMC abstracts, bilingual query rewriting, dense + BM25 RRF.

Only real source metadata is returned. Public abstracts are cached locally;
no patient data is sent to the publication service. Ranking is relevance,
not diagnostic confidence. Case reports are not patient similarity matches.
"""

from __future__ import annotations

import asyncio
import hashlib
import html
import json
import re
import time

import httpx
import numpy as np
from rank_bm25 import BM25Okapi

from app.core.ai import client, limiter
from app.core.config import get_settings
from app.core.storage import database
from app.schemas.live import RetrievalQuery

_locks: dict[str, asyncio.Lock] = {}


def _cached(key: str):
    with database() as db:
        row = db.execute(
            "SELECT value FROM cache WHERE key=? AND expires>?", (key, time.time())
        ).fetchone()
    return json.loads(row[0]) if row else None


def _save(key: str, result: dict):
    with database() as db:
        db.execute(
            "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
            (
                key,
                json.dumps(result, ensure_ascii=False),
                time.time() + get_settings().literature_cache_seconds,
            ),
        )


def clean(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", text or "")).strip()


async def search_publications(query: str, top_k: int = 5, cases_only: bool = False) -> dict:
    settings = get_settings()
    key = (
        "pub-v1:"
        + hashlib.sha256(
            f"{query.strip().lower()}:{top_k}:{cases_only}:{settings.embedding_model}".encode()
        ).hexdigest()
    )
    cached = _cached(key)
    if cached:
        return {**cached, "cached": True, "latency_ms": 0}
    lock = _locks.setdefault(key, asyncio.Lock())
    try:
        async with lock:
            cached = _cached(key)
            if cached:
                return {**cached, "cached": True, "latency_ms": 0}
            result = await _search(query, top_k, cases_only)
            _save(key, result)
            return result
    finally:
        if not lock.locked():
            _locks.pop(key, None)


async def _search(query: str, top_k: int, cases_only: bool) -> dict:
    started = time.perf_counter()
    async with limiter():
        rewritten = await client().beta.chat.completions.parse(
            model=get_settings().chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Convert the user's research question into a concise English "
                        "biomedical search "
                        "query of 2-8 essential terms. Exclude patient identifiers, demographics, "
                        "clinical details and instructions. Keep disease and intervention "
                        "concepts. "
                        "Do not add restrictive terms absent from the question. Return only "
                        "the schema."
                    ),
                },
                {"role": "user", "content": query},
            ],
            response_format=RetrievalQuery,
            max_completion_tokens=200,
        )
    parsed = rewritten.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("검색 질의 변환 실패")
    english = re.sub(r"[^a-zA-Z0-9\s-]", " ", parsed.english_query)[:200].strip()
    if not english:
        raise ValueError("검색 가능한 의학 주제가 없습니다")
    suffix = ' AND PUB_TYPE:"case reports"' if cases_only else ""
    expression = f"({english}) AND HAS_ABSTRACT:Y{suffix}"
    # Fixed host prevents SSRF. No LLM-generated URLs are ever fetched.
    async with httpx.AsyncClient(timeout=25, follow_redirects=False) as http:
        for attempt in range(3):
            response = await http.get(
                "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
                params={
                    "query": expression,
                    "format": "json",
                    "pageSize": 25,
                    "resultType": "core",
                },
            )
            if response.status_code not in {429, 500, 502, 503, 504} or attempt == 2:
                break
            await asyncio.sleep(0.5 * 2**attempt)
        response.raise_for_status()
        payload = response.json()
    documents = []
    for row in payload.get("resultList", {}).get("result", []):
        abstract = clean(row.get("abstractText", ""))
        if not abstract or not row.get("id"):
            continue
        source, identifier = row.get("source", "MED"), row["id"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", source + identifier):
            continue
        documents.append(
            {
                "id": f"{source}:{identifier}",
                "title": clean(row.get("title", "")),
                "abstract": abstract[:10000],
                "authors": row.get("authorString", ""),
                "year": row.get("pubYear"),
                "journal": row.get("journalTitle", ""),
                "doi": row.get("doi"),
                "publication_types": row.get("pubTypeList", {}).get("pubType", []),
                "url": f"https://europepmc.org/article/{source}/{identifier}",
                "source": "Europe PMC",
            }
        )
    if documents:
        texts = [f"{d['title']}\n{d['abstract']}" for d in documents]
        async with limiter():
            vectors = await client().embeddings.create(
                model=get_settings().embedding_model, input=[english, *texts]
            )
        matrix = np.array([v.embedding for v in sorted(vectors.data, key=lambda x: x.index)])
        matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-12)
        dense = matrix[1:] @ matrix[0]

        def tokenize(s):
            return re.findall(r"[a-z0-9]+", s.lower())

        sparse = BM25Okapi([tokenize(t) for t in texts]).get_scores(tokenize(english))
        ranks = np.zeros(len(documents))
        for scores in (dense, sparse):
            for rank, idx in enumerate(np.argsort(-scores)):
                ranks[idx] += 1 / (60 + rank + 1)
        for i, doc in enumerate(documents):
            doc["relevance"] = round(float(dense[i]), 4)
            doc["rank_score"] = round(float(ranks[i]), 6)
        documents = [documents[i] for i in np.argsort(-ranks)[:top_k]]
    return {
        "query": query,
        "english_query": english,
        "hits": documents,
        "total": payload.get("hitCount", 0),
        "candidates": len(payload.get("resultList", {}).get("result", [])),
        "cached": False,
        "retrieved_at": time.time(),
        "latency_ms": round((time.perf_counter() - started) * 1000),
        "method": "Europe PMC relevance candidates + OpenAI embeddings + BM25 + RRF",
        "limitations": [
            "검색·재정렬은 초록 기준입니다. 원문 확인이 필요합니다.",
            "문헌 관련도는 환자 진단의 신뢰도나 치료 권고 강도가 아닙니다.",
        ],
    }
