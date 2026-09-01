"""[담당 B] BM25 sparse 검색 - Phase 2.

dense 검색만으로는 의학 약어와 고유명사를 놓친다. "CPA blunting", "ETT",
"PA view" 같은 표현은 의미 임베딩보다 표층 일치가 정확하다.

코퍼스가 772 chunk 로 작으므로 인메모리 인덱스로 충분하다. 별도 검색 엔진을
띄우지 않는다.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi

from app.core.config import get_settings

# 의학 텍스트 토큰화. 하이픈과 슬래시로 이어진 용어(ATS/IDSA, cross-sectional)를
# 분리하지 않으면 검색에서 잡히지 않는다.
_TOKEN = re.compile(r"[a-z0-9]+(?:[-/][a-z0-9]+)*")


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


@dataclass
class SparseHit:
    score: float
    payload: dict[str, Any]


def chunks_path() -> Path:
    """BM25 용 chunk 덤프 경로. 색인 배치가 함께 생성한다."""
    return Path(get_settings().qdrant_path).parent / "knowledge_chunks.json"


@lru_cache(maxsize=1)
def _load() -> tuple[BM25Okapi, list[dict[str, Any]]]:
    path = chunks_path()
    if not path.exists():
        raise FileNotFoundError(
            f"BM25 인덱스 원본이 없다: {path}. build_knowledge_index.py 를 먼저 실행한다"
        )
    payloads = json.loads(path.read_text())
    corpus = [tokenize(p["text"]) for p in payloads]
    return BM25Okapi(corpus), payloads


def search(query: str, top_k: int = 20) -> list[SparseHit]:
    """BM25 상위 top_k 를 반환한다."""
    bm25, payloads = _load()
    scores = bm25.get_scores(tokenize(query))
    order = sorted(range(len(scores)), key=lambda i: -scores[i])[:top_k]
    # 점수 0 은 질의어가 하나도 안 걸린 문서다. 순위 융합에 넣으면 잡음이 된다
    return [SparseHit(score=float(scores[i]), payload=payloads[i]) for i in order if scores[i] > 0]


def reset_cache() -> None:
    """재색인 후 캐시를 비운다."""
    _load.cache_clear()
