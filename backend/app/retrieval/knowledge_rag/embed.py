"""[담당 B] 4단계 - MedCPT 임베딩."""

from __future__ import annotations


def embed_documents(texts: list[str]) -> list[list[float]]:
    """MedCPT Article Encoder 로 문서 chunk 를 벡터화한다."""
    raise NotImplementedError("담당 B: 문서 임베딩 구현")


def embed_query(text: str) -> list[float]:
    """MedCPT Query Encoder 로 질의를 벡터화한다.

    MedCPT 는 query 와 article 인코더가 분리되어 있다. 같은 인코더를 쓰면
    검색 성능이 떨어지므로 이 두 함수를 반드시 구분해서 사용한다.
    """
    raise NotImplementedError("담당 B: 질의 임베딩 구현")
