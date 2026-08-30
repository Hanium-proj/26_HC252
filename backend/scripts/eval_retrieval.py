"""Knowledge RAG 검색 품질 평가.

테스트 쿼리 8개로 Hit@k 를 측정한다.

정답 문서는 sources.csv 의 target_coverage 에서 도출했다. 예를 들어
"pneumothorax 소견" 질문의 정답은 target_coverage 에 Pneumothorax 가 있는 문서다.

코퍼스는 영어이고 실제 사용자는 한국어로 질문하므로 두 언어를 모두 측정한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.retrieval.knowledge_rag.search import search_raw  # noqa: E402

# (질문 ko, 질문 en, 정답 doc_id 집합)
QUERIES: list[tuple[str, str, set[str]]] = [
    (
        "흉부 X-ray에서 기흉을 시사하는 주요 소견은?",
        "What are the key chest radiograph findings suggesting pneumothorax?",
        {"GL004", "RV008", "RV007", "RV002"},
    ),
    (
        "흉수가 보이면 어떤 원인을 추가로 고려해야 하는가?",
        "If pleural effusion is seen, what underlying causes should be considered?",
        {"GL004", "RV004", "RV007", "RV005", "RV009"},
    ),
    (
        "폐부종과 폐렴을 영상 소견으로 어떻게 구분할 수 있는가?",
        "How can pulmonary edema be distinguished from pneumonia on imaging?",
        {"RV005", "RV001", "GL001", "GL003", "RV003", "RV006"},
    ),
    (
        "흉부 X-ray에서 불확정 폐결절 발견 시 다음 영상검사는?",
        "What is the next imaging step for an indeterminate pulmonary nodule on CXR?",
        {"GL002"},
    ),
    (
        "의료기기 위치 이상에서 확인해야 할 합병증은?",
        "What complications should be checked when a support device is malpositioned?",
        {"RV002"},
    ),
    (
        "늑골 골절이 의심될 때 적절한 영상검사는?",
        "What is the appropriate imaging study when rib fracture is suspected?",
        {"GL007"},
    ),
    (
        "심비대와 폐부종이 함께 보일 때 어떤 임상 맥락을 고려하는가?",
        "What clinical context applies when cardiomegaly and pulmonary edema coexist?",
        {"RV009", "RV005", "RV006"},
    ),
    (
        "종격동 확대가 의심될 때 다음 평가 단계는?",
        "What are the next evaluation steps when mediastinal widening is suspected?",
        {"GL008"},
    ),
]

TOP_K = 8


def run(lang: str, k: int = TOP_K) -> tuple[float, float, list]:
    """언어별 Hit@k / MRR 측정."""
    hits = 0
    rr_total = 0.0
    rows = []

    for i, (q_ko, q_en, gold) in enumerate(QUERIES, start=1):
        q = q_ko if lang == "ko" else q_en
        res = search_raw(q, top_k=k)
        found = [h.payload["doc_id"] for h in res]

        rank = next((j for j, d in enumerate(found, start=1) if d in gold), None)
        hit = rank is not None
        hits += hit
        rr_total += (1.0 / rank) if rank else 0.0

        rows.append((i, q, gold, found, rank, res))

    return hits / len(QUERIES), rr_total / len(QUERIES), rows


def main() -> None:
    for lang, label in (("en", "영어"), ("ko", "한국어")):
        hit, mrr, rows = run(lang)
        print(f"\n{'=' * 74}")
        print(f"  {label} 쿼리 · top-{TOP_K}   Hit@{TOP_K} = {hit:.3f}   MRR = {mrr:.3f}")
        print("=" * 74)
        for i, q, gold, found, rank, res in rows:
            mark = f"순위 {rank}" if rank else "실패"
            print(f"\n[{i}] {q}")
            print(f"    정답 {sorted(gold)} -> {mark}")
            print(f"    검색 {found}")
            top = res[0]
            print(f"    1위 (score {top.score:.3f}) {top.citation}")
            print(f"         {top.text[:110].replace(chr(10), ' ')}...")


if __name__ == "__main__":
    main()
