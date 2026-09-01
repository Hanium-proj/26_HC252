"""Case RAG 유사 사례 검색 품질 평가.

14개 observation 각각에 대해 전형적 판독 소견을 질의로 넣고, 검색된 top-k 중
해당 소견을 가진 사례의 비율(agreement)을 측정한다.

agreement 만으로는 품질을 판정할 수 없다. 코퍼스에 흔한 소견은 무작위로 뽑아도
일치율이 높기 때문이다. 따라서 코퍼스 내 기저 출현율(prevalence) 대비
몇 배로 올랐는지(lift)를 함께 산출한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.retrieval.case_rag.search import search_raw  # noqa: E402
from app.retrieval.knowledge_rag.index import get_client  # noqa: E402

# observation 별 전형적 판독 소견 문장. MIMIC 판독문 어투에 맞춰 작성했다.
QUERIES: dict[str, str] = {
    "Atelectasis": "Bibasilar atelectasis with volume loss at the lung bases.",
    "Cardiomegaly": "The cardiac silhouette is enlarged. Cardiomegaly is present.",
    "Consolidation": "Dense airspace consolidation in the right lower lobe.",
    "Edema": "Pulmonary vascular congestion with interstitial pulmonary edema.",
    "Enlarged Cardiomediastinum": "The cardiomediastinal silhouette is widened.",
    "Fracture": "Acute displaced rib fractures along the left lateral chest wall.",
    "Lung Lesion": "A pulmonary nodule is identified in the right upper lobe.",
    "Lung Opacity": "Patchy airspace opacity in the left mid lung zone.",
    "Pleural Effusion": "Large left pleural effusion with blunting of the costophrenic angle.",
    "Pleural Other": "Pleural thickening with calcified pleural plaques.",
    "Pneumonia": "Findings consistent with pneumonia in the left lower lobe.",
    "Pneumothorax": "Right apical pneumothorax with a visible visceral pleural line.",
    "Support Devices": "Endotracheal tube tip terminates in the right mainstem bronchus.",
}

TOP_K = 10


def prevalence(client, collection: str, total: int) -> dict[str, float]:
    """코퍼스 내 각 소견의 출현율. lift 계산의 분모."""
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    out: dict[str, float] = {}
    for obs in QUERIES:
        n = client.count(
            collection_name=collection,
            count_filter=Filter(
                must=[
                    FieldCondition(
                        key="positive_findings", match=MatchValue(value=obs)
                    )
                ]
            ),
            exact=True,
        ).count
        out[obs] = n / total
    return out


def main() -> None:
    settings = get_settings()
    client = get_client()
    total = client.get_collection(settings.case_collection).points_count

    print(f"코퍼스 {total:,}건 · top-{TOP_K}\n")
    base = prevalence(client, settings.case_collection, total)

    print(f"{'Observation':<28} {'일치':>6} {'기저':>7} {'lift':>7} {'유사도':>7}")
    print("-" * 62)

    agr_all, lift_all = [], []
    for obs, q in QUERIES.items():
        hits = search_raw(q, top_k=TOP_K)
        n = sum(1 for h in hits if obs in h.payload.get("positive_findings", []))
        agr = n / len(hits)
        p = base[obs]
        lift = agr / p if p > 0 else float("inf")
        sim = sum(h.score for h in hits) / len(hits)
        agr_all.append(agr)
        if p > 0:
            lift_all.append(lift)
        print(
            f"{obs:<28} {n:>3}/{TOP_K}  {p*100:>5.1f}%  {lift:>6.1f}x  {sim:>6.3f}"
        )

    print("-" * 62)
    print(f"{'평균':<28} {sum(agr_all)/len(agr_all)*100:>5.1f}%"
          f"  {sum(base.values())/len(base)*100:>5.1f}%"
          f"  {sum(lift_all)/len(lift_all):>6.1f}x")


if __name__ == "__main__":
    main()
