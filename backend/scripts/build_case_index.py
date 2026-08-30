"""Case RAG 인덱스 구축 배치 (MIMIC-CXR).

선행 조건:
  1. mimic-cxr-reports.zip 을 data/mimic_cxr/reports 에 해제
  2. MIT-LCP 공식 섹션 파서로 mimic_cxr_sectioned.csv 생성
     python create_section_files.py --reports_path <reports>/files \
         --output_path <sections> --no_split

실행:
    cd backend && .venv/bin/python scripts/build_case_index.py \
        --sections data/mimic_cxr/sections/mimic_cxr_sectioned.csv \
        --labels ../cxr/labels.csv \
        --study-list ../MIMIC_CXR_Similar_Case_RAG_v1/cxr-study-list.csv.gz

주의: MIMIC-CXR 은 PhysioNet credentialed 데이터이다. 산출물(인덱스, 캐시)은
저장소에 커밋하지 않는다.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.retrieval.case_rag.build_index import build_study_table  # noqa: E402
from app.retrieval.case_rag.index import recreate_collection, upsert  # noqa: E402
from app.retrieval.knowledge_rag.embed import embed_stream  # noqa: E402
from app.retrieval.knowledge_rag.index import get_client  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sections", required=True, type=Path)
    ap.add_argument("--labels", required=True, type=Path)
    ap.add_argument("--study-list", required=True, type=Path)
    ap.add_argument(
        "--limit", type=int, default=0, help="상위 N건만 처리 (파이프라인 검증용)"
    )
    ap.add_argument(
        "--split", default="", help="특정 split 만 처리 (train/validate/test)"
    )
    args = ap.parse_args()

    settings = get_settings()
    t0 = time.time()

    print(">>> 1/4 study 테이블 구성")
    master = build_study_table(args.sections, args.labels, args.study_list)
    total = len(master)
    print(f"    study {total:,}건")

    usable = master[master["has_retrieval_text"]].copy()
    print(f"    retrieval_text 보유 {len(usable):,}건 (제외 {total - len(usable):,}건)")

    if args.split:
        usable = usable[usable["split"] == args.split]
        print(f"    split={args.split} 필터 적용 -> {len(usable):,}건")
    if args.limit:
        usable = usable.head(args.limit)
        print(f"    limit 적용 -> {len(usable):,}건")

    texts = usable["retrieval_text"].tolist()
    rows = [r for _, r in usable.iterrows()]
    n_tok = sum(len(t) for t in texts) // 4  # 대략치
    print(f"    임베딩 대상 {len(texts):,}건, 약 {n_tok/1e6:.1f}M 토큰(추정)")

    # 22만 건 규모에서는 전체 벡터를 메모리에 모을 수 없으므로
    # 배치를 받는 즉시 색인하고 버린다.
    print(f">>> 2/3 컬렉션 생성 ({settings.case_collection})")
    client = get_client()
    dim = settings.embedding_dim
    recreate_collection(client, settings.case_collection, dim)

    print(f">>> 3/3 임베딩 + 색인 ({settings.embedding_model})")
    t1 = time.time()
    done = 0
    for local_idx, _batch, vectors in embed_stream(texts):
        if done == 0 and len(vectors[0]) != dim:
            raise RuntimeError(
                f"임베딩 차원 불일치: 설정 {dim} vs 실제 {len(vectors[0])}"
            )
        upsert(
            client,
            settings.case_collection,
            [rows[i] for i in local_idx],
            vectors,
            start_id=done,
        )
        done += len(vectors)
        if done % 20000 < len(vectors):
            rate = done / max(time.time() - t1, 1)
            eta = (len(texts) - done) / max(rate, 1)
            print(
                f"    {done:,}/{len(texts):,} · {rate:.0f}건/초 · 남은시간 {eta/60:.1f}분",
                flush=True,
            )

    info = client.get_collection(settings.case_collection)
    print(f"    {done:,}개 색인 · 컬렉션 count={info.points_count:,}")
    print(f"    임베딩+색인 소요 {time.time()-t1:.1f}초")

    print(f"\n완료. 총 {time.time()-t0:.1f}초")


if __name__ == "__main__":
    main()
