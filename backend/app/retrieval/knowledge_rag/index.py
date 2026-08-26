"""[담당 B] 5단계 - Dense + BM25 인덱스 구축."""

from __future__ import annotations

from typing import Any


def build_dense(chunks: list[dict[str, Any]]) -> None:
    """벡터 인덱스를 만든다. (pgvector / Qdrant / FAISS 중 택1)"""
    raise NotImplementedError("담당 B: dense 인덱스 구현")


def build_bm25(chunks: list[dict[str, Any]]) -> None:
    """희소 인덱스를 만든다. 의학 약어/고유명사는 BM25 가 dense 보다 강하다."""
    raise NotImplementedError("담당 B: BM25 인덱스 구현")
