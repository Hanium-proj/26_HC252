"""Knowledge RAG 인덱스 구축 배치.

실행:
    cd backend && .venv/bin/python scripts/build_knowledge_index.py

parse -> chunk -> embed -> Qdrant 를 한 번에 돌린다. 오프라인 배치이므로
API 서버와 분리해 둔다.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.retrieval.knowledge_rag.chunk import chunk_corpus  # noqa: E402
from app.retrieval.knowledge_rag.embed import embed_documents  # noqa: E402
from app.retrieval.knowledge_rag.index import (  # noqa: E402
    get_client,
    recreate_collection,
    upsert_chunks,
)
from app.retrieval.knowledge_rag.parse import parse_corpus  # noqa: E402


def main() -> None:
    settings = get_settings()
    t0 = time.time()

    print(">>> 1/4 PDF 파싱")
    docs = parse_corpus(Path(settings.corpus_dir))
    print(f"    문서 {len(docs)}개, 페이지 {sum(len(d.pages) for d in docs)}쪽")

    print(">>> 2/4 Chunking")
    chunks, dropped = chunk_corpus(docs)
    n_tok = sum(c.n_tokens for c in chunks)
    print(f"    chunk {len(chunks)}개 (참고문헌 {dropped}개 제외), {n_tok:,} 토큰")

    print(f">>> 3/4 임베딩 ({settings.embedding_model})")
    t1 = time.time()
    vectors = embed_documents([c.text for c in chunks], progress=True)
    dim = len(vectors[0])
    print(f"    {len(vectors)}개 벡터 · {dim}차원 · {time.time()-t1:.1f}초")

    print(f">>> 4/4 Qdrant 색인 ({settings.knowledge_collection})")
    client = get_client()
    recreate_collection(client, settings.knowledge_collection, dim)
    n = upsert_chunks(client, settings.knowledge_collection, chunks, vectors)
    info = client.get_collection(settings.knowledge_collection)
    print(f"    {n}개 저장 · 컬렉션 count={info.points_count}")

    print(f"\n완료. 총 {time.time()-t0:.1f}초")


if __name__ == "__main__":
    main()
