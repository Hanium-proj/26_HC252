"""[담당 B] 4단계 - Qdrant 인덱스.

컬렉션을 분리한다:
  knowledge_guidelines_reviews  - 문헌 (이 파일)
  radiology_cases               - 증례 (case_rag/index.py)
검색 목적과 metadata 스키마가 달라 한 컬렉션에 섞지 않는다.

qdrant_url 이 비어 있으면 로컬 파일 모드로 동작한다. 서버로 옮길 때는
.env 의 QDRANT_URL 만 채우면 되고 코드는 그대로다.
"""

from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.core.config import get_settings
from app.retrieval.knowledge_rag.chunk import Chunk


def get_client() -> QdrantClient:
    settings = get_settings()
    if settings.qdrant_url:
        return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    return QdrantClient(path=settings.qdrant_path)


def recreate_collection(client: QdrantClient, name: str, dim: int) -> None:
    """컬렉션을 새로 만든다. 기존 것이 있으면 지운다.

    재색인은 전체 삭제 후 재생성이 안전하다. 부분 갱신은 chunk_id 가 바뀌었을 때
    옛 벡터가 남아 검색 결과에 유령 문서로 나타난다.
    """
    if client.collection_exists(name):
        client.delete_collection(name)
    client.create_collection(
        collection_name=name,
        # 코사인 거리: OpenAI 임베딩은 정규화돼 있어 코사인이 표준
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )


def upsert_chunks(
    client: QdrantClient,
    name: str,
    chunks: list[Chunk],
    vectors: list[list[float]],
    batch_size: int = 256,
) -> int:
    if len(chunks) != len(vectors):
        raise ValueError(f"chunk({len(chunks)}) 와 vector({len(vectors)}) 개수 불일치")

    points = [
        # Qdrant point id 는 정수 또는 UUID 만 허용한다. 문자열 chunk_id 는 payload 에 둔다
        PointStruct(id=i, vector=v, payload=c.to_payload())
        for i, (c, v) in enumerate(zip(chunks, vectors, strict=True))
    ]
    for i in range(0, len(points), batch_size):
        client.upsert(collection_name=name, points=points[i : i + batch_size])
    return len(points)
