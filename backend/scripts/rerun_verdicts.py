"""저장된 실행 사례로 판정을 재계산하고 근거 역할 ablation 을 수행한다 (논문 표 1·2).

Qdrant 없이 동작한다. 사례 JSON 에 저장된 plan 과 RAG 검색 결과(retrieved)를 그대로 쓰고,
영상 근거만 현재 코드와 예측 CSV 로 다시 만든다.

조건
  base     : 현재 규칙 (반대 확신도 1-p)
  cam_ctx  : CAM(localizer) 근거를 맥락으로 처리 (지지·반대 합산에서 제외)
  cam_case : CAM + 판독문(case) 근거를 맥락으로 처리

실행 (backend/ 에서):
    # 영상+임상정보(A4-with) 예측으로 재계산 — 논문에 쓴 설정
    $env:GLASS_HANDOFF_DIR="...\\glass_agent_handoff_20260829"
    $env:GLASS_PREDICTIONS_CSV="...\\glass_multimodal_agent_addon_20260929\\predictions\\a4\\test_image_predictions_a4_with.csv"
    $env:GLASS_MODEL_NAME="a4_with_fusion"
    python -m scripts.rerun_verdicts --cases outputs/demo_cases_a4

출력은 콘솔 표와 --out JSON. 사례 JSON·출력은 MIMIC 파생물이므로 커밋하지 않는다(.gitignore).
"""

from __future__ import annotations

import argparse
import asyncio
import glob
import json
import os
from collections import Counter
from pathlib import Path

from app.agents import orchestrator
from app.schemas.common import ToolName
from app.schemas.evidence import EvidenceItem
from app.schemas.query import Plan, QueryInput
import app.trust.normalize as N
import app.trust.resolver as R
import app.trust.scoring as S
from app.tools.vision._store import get_store

_ORIG_VERDICT = N._verdict


def _set_context(cam_ctx: bool, case_ctx: bool) -> None:
    """지정한 근거를 판정 불가(None)로 바꿔 합산에서 제외한다. 근거 자체는 보존된다."""

    def verdict(item: EvidenceItem):
        if cam_ctx and item.source is ToolName.LOCALIZER:
            return None
        if case_ctx and item.source is ToolName.CASE:
            return None
        return _ORIG_VERDICT(item)

    N._verdict = verdict


async def _resolve(case: dict, cam_ctx: bool = False, case_ctx: bool = False):
    plan = Plan.model_validate(case["packet"]["plan"])
    query = QueryInput.model_validate(case["packet"]["query"])
    packet = await orchestrator.run(plan, case["selection"]["dicom_id"], query=query)
    retrieved = [EvidenceItem.model_validate(x) for x in case["retrieved"]]
    _set_context(cam_ctx, case_ctx)
    try:
        final = await R.resolve(packet, retrieved)
        normalized = N.normalize(packet, retrieved)
        claims = []
        for v in final.verdicts:
            group = [n for n in normalized if n.claim_key == v.claim]
            s_pro = sum(S.score(n) for n in group if n.verdict is True)
            s_con = sum(S.score(n) for n in group if n.verdict is False)
            claims.append(
                {"claim": v.claim, "verdict": v.verdict.value,
                 "support": round(s_pro, 3), "oppose": round(s_con, 3)}
            )
        return final.overall.value, claims
    finally:
        _set_context(False, False)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default="outputs/demo_cases_a4", help="사례 JSON 폴더")
    ap.add_argument("--out", default=None, help="결과 JSON 경로 (기본: <cases>/summary_rerun.json)")
    args = ap.parse_args()

    if not os.getenv("GLASS_HANDOFF_DIR") and not os.getenv("GLASS_PREDICTIONS_CSV"):
        raise SystemExit("GLASS_HANDOFF_DIR 또는 GLASS_PREDICTIONS_CSV 환경변수를 지정하세요.")

    store = get_store()
    store.load()

    rows = []
    for f in sorted(glob.glob(str(Path(args.cases) / "case_*.json"))):
        case = json.loads(Path(f).read_text(encoding="utf-8"))
        sel = case["selection"]
        overall, claims = asyncio.run(_resolve(case))
        cam, _ = asyncio.run(_resolve(case, cam_ctx=True))
        cam_case, _ = asyncio.run(_resolve(case, cam_ctx=True, case_ctx=True))
        pred = store.get(sel["dicom_id"])
        prob = pred.probability(sel["finding"]) if (pred and sel.get("finding")) else None
        rows.append({
            "case": Path(f).name, "finding": sel.get("finding"), "prob": prob,
            "gt": sel.get("ground_truth"), "verdict": overall, "claims": claims,
            "verdict_cam_context": cam, "verdict_cam_case_context": cam_case,
        })

    for r in rows:
        p = f"{r['prob']:.3f}" if isinstance(r["prob"], float) else "-"
        print(f"{r['case']:<40}{str(r['finding']):<18}{p:>7}  {r['verdict']:<20}"
              f"{r['verdict_cam_context']:<20}{r['verdict_cam_case_context']}")
    for key in ("verdict", "verdict_cam_context", "verdict_cam_case_context"):
        print(key, dict(Counter(r[key] for r in rows)))

    out = Path(args.out) if args.out else Path(args.cases) / "summary_rerun.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {out.resolve()}")


if __name__ == "__main__":
    main()
