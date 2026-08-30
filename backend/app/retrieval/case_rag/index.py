"""[담당 B] Case RAG - Qdrant `radiology_cases` 컬렉션 구축.

Knowledge RAG 와 컬렉션을 분리한다. 검색 목적과 메타데이터 스키마가 다르고,
문헌 근거와 증례 근거는 Trust 계산에서 가중치도 다르게 적용되기 때문이다.

개인정보: payload 에 subject_id 를 넣지 않는다. 유사 사례 검색에 필요한 것은
소견 내용과 study 식별자이지 환자 식별자가 아니다.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.retrieval.case_rag.build_index import OBSERVATIONS


def recreate_collection(client: QdrantClient, name: str, dim: int) -> None:
    if client.collection_exists(name):
        client.delete_collection(name)
    client.create_collection(
        collection_name=name,
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )


def row_to_payload(row: pd.Series) -> dict[str, Any]:
    """study 1건을 Qdrant payload 로 변환한다.

    positive_findings 를 별도로 두는 이유: Qdrant 의 MatchAny 필터는 배열 필드에
    적용하기 쉬우므로, 14개 컬럼을 각각 조건으로 거는 것보다 검색이 단순해진다.
    """
    positives = [
        obs for obs in OBSERVATIONS if row.get(obs) == 1.0 and obs != "No Finding"
    ]
    return {
        "case_id": row["case_id"],
        "study_id": int(row["study_id"]),
        "text": row["retrieval_text"],
        "findings": row.get("findings", ""),
        "impression": row.get("impression", ""),
        "image_count": int(row.get("image_count") or 0),
        "view_positions": str(row.get("view_positions") or ""),
        "dicom_ids": str(row.get("dicom_ids") or ""),
        "split": str(row.get("split") or ""),
        "positive_findings": positives,
        "n_positive": len(positives),
        "no_finding": row.get("No Finding") == 1.0,
    }


def upsert(
    client: QdrantClient,
    name: str,
    rows: list[pd.Series],
    vectors: list[list[float]],
    start_id: int = 0,
    batch_size: int = 512,
) -> int:
    if len(rows) != len(vectors):
        raise ValueError(f"row({len(rows)}) 와 vector({len(vectors)}) 개수 불일치")

    points = [
        PointStruct(id=start_id + i, vector=v, payload=row_to_payload(r))
        for i, (r, v) in enumerate(zip(rows, vectors, strict=True))
    ]
    for i in range(0, len(points), batch_size):
        client.upsert(collection_name=name, points=points[i : i + batch_size])
    return len(points)
