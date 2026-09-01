"""Phase 2 단계별 기여도 측정.

dense 단독(Phase 1) 대비 번역 / BM25 / 리랭킹을 하나씩 얹으며 측정한다.
한 번에 전부 켜고 재면 어느 단계가 기여했는지 알 수 없다.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from eval_retrieval import QUERIES  # noqa: E402

from app.retrieval.knowledge_rag.search import hybrid_search, search_raw  # noqa: E402

TOP_K = 8

CONFIGS = [
    ("Phase 1: dense 단독", dict(use_translation=False, use_bm25=False, use_rerank=False)),
    ("+ 질의 번역", dict(use_translation=True, use_bm25=False, use_rerank=False)),
    ("+ BM25 & RRF", dict(use_translation=True, use_bm25=True, use_rerank=False)),
    ("+ 리랭킹 (전체)", dict(use_translation=True, use_bm25=True, use_rerank=True)),
]


def measure(lang: str, runner) -> tuple[float, float, float, float]:
    hits = rr = 0.0
    uniq = 0
    t0 = time.time()
    for q_ko, q_en, gold in QUERIES:
        res = runner(q_ko if lang == "ko" else q_en)
        docs = [h.payload["doc_id"] for h in res]
        rank = next((i for i, d in enumerate(docs, 1) if d in gold), None)
        hits += bool(rank)
        rr += (1.0 / rank) if rank else 0.0
        uniq += len(set(docs))
    n = len(QUERIES)
    return hits / n, rr / n, uniq / n, (time.time() - t0) / n


def main() -> None:
    print(f"평가 쿼리 {len(QUERIES)}개 · top-{TOP_K}\n")
    header = (
        f"{'구성':<24} {'한국어 Hit':>11} {'한 MRR':>8} "
        f"{'영어 Hit':>9} {'영 MRR':>8} {'고유문서':>8} {'지연':>8}"
    )
    print(header)
    print("-" * 82)

    base = search_raw
    for label, opts in CONFIGS:
        if label.startswith("Phase 1"):
            def run(q, _b=base):
                return _b(q, top_k=TOP_K)
        else:
            def run(q, _o=opts):
                return hybrid_search(q, top_k=TOP_K, **_o)

        ko_h, ko_m, ko_u, ko_t = measure("ko", run)
        en_h, en_m, _, _ = measure("en", run)
        print(
            f"{label:<24} {ko_h:>11.3f} {ko_m:>8.3f} "
            f"{en_h:>9.3f} {en_m:>8.3f} {ko_u:>8.2f} {ko_t*1000:>6.0f}ms"
        )


if __name__ == "__main__":
    main()
