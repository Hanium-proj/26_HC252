"""논문 §4 '통합 실행 사례' 생성 스크립트.

test split 예측과 정답 라벨을 이용해 서로 다른 판정이 나오는 사례를 자동 선별하고,
각 사례를 end-to-end 파이프라인에 통과시켜 결과를 JSON 과 표로 저장한다.

선별 기준(정답 라벨은 negative_no_cam 선별에만 사용하며 검색·판정에는 미사용):
  high_prob_with_cam   확률 >= 0.70, CAM 있음        -> ACCEPT 기대
  low_prob_with_cam    확률 < 0.30, CAM 있음         -> 분류기 근거 결손 확인
  borderline_with_cam  0.30 <= 확률 < 양성 임계값,   -> CAUTION 기대
                       CAM 있음
  low_quality          측면 영상                     -> 품질 게이트 동작 확인
  no_cam               CAM 없는 정면 영상            -> 필수 근거 결손 확인
  no_target            소견을 특정하지 못하는 질문    -> 다중 소견 전체 판정 확인
  negative_no_cam      CAM 없는 정면, 정답 음성,     -> REJECT 기대
                       0.43 <= 확률 < 양성 임계값,
                       uncertainty_check 질문

borderline_with_cam 이 필요한 이유: Case RAG 는 소견명으로만 질의하므로
agreement_ratio 가 영상과 무관하게 소견별 상수(0.75~1.0)이고 항상 지지 쪽에
선다. 따라서 근거 충돌은 분류기가 양성 임계값 미만(반대)이면서 localizer 와
증례가 지지하는 구간에서만 생긴다. 확률 >= 0.70 / < 0.30 만 뽑으면 이 구간을
건너뛴다.

negative_no_cam 이 필요한 이유: CAM 산출물 70건은 전부 정답 양성이라 "올바른
REJECT" 는 CAM 사례에서 나올 수 없고, CAM 이 있으면 localizer 가 항상 지지해
REJECT 대신 CAUTION/ACCEPT 가 된다. CAM 없는 영상에 finding_presence 질문을
하면 cam_localization 결손으로 NEED_MORE_EVIDENCE 가 된다. 그래서 CAM 을
요구하지 않는 uncertainty_check 유형(필수: classifier_prediction, view_quality)
으로 질문해 분류기 단독 반대가 판정으로 이어지게 한다. 확률 하한 0.43 은
s_con = 0.9 x p x quality >= REJECT_THRESHOLD(0.35) 가 성립하는 근사 하한이다.

실행:
    python -m scripts.run_demo_cases                 # 기본 11건 (후보가 충분한 경우)
    python -m scripts.run_demo_cases --per-group 3   # 그룹당 3건
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from app.agents import pipeline
from app.tools.vision._store import get_store
from app.trust.normalize import POSITIVE_THRESHOLD

OUT_DIR = Path("outputs/demo_cases")

# 질문 템플릿. 소견 한국어 표기는 planner 의 별칭 표와 맞춘다.
KO = {
    "Pneumothorax": "기흉",
    "Pneumonia": "폐렴",
    "Pleural Effusion": "흉수",
    "Cardiomegaly": "심비대",
    "Atelectasis": "무기폐",
    "Edema": "폐부종",
    "Consolidation": "경화",
    "Lung Opacity": "폐음영",
}

TARGET_FINDINGS = list(KO.keys())
HIGH = 0.70
LOW = 0.30
# 분류기 단독 반대가 REJECT_THRESHOLD 를 넘는 근사 하한 (AP 품질 0.9 기준 0.81p >= 0.35)
NEGATIVE_LOW = 0.43


def pick_cases(per_group: int) -> list[dict]:
    """판정이 갈릴 만한 사례를 선별한다."""
    store = get_store()
    store.load()
    if not store.available:
        raise SystemExit(
            "예측 파일을 찾지 못했습니다. GLASS_HANDOFF_DIR 환경변수로 "
            "glass_agent_handoff 폴더 경로를 지정하세요."
        )

    groups: dict[str, list[dict]] = {
        "high_prob_with_cam": [],
        "low_prob_with_cam": [],
        "borderline_with_cam": [],
        "low_quality": [],
        "no_cam": [],
    }

    # CAM 산출물은 (영상, 소견) 쌍으로 존재한다. localizer 근거가 나오려면
    # 그 쌍이 맞아야 하므로 소견까지 함께 걸러야 한다.
    # 큐레이션된 70건의 finding-case 는 모두 정답 양성이므로, 여기서는
    # 확률 크기로 나눠 수용 임계값의 동작을 확인한다.
    scored = []
    for cam in store.cam_cases():
        pred = store.get(cam.dicom_id)
        if pred is None:
            continue
        p = pred.probability(cam.finding)
        if p is None:
            continue
        scored.append((p, pred, cam.finding))
    scored.sort(key=lambda x: -x[0])

    for p, pred, finding in scored:
        if p >= HIGH and len(groups["high_prob_with_cam"]) < per_group:
            groups["high_prob_with_cam"].append(_case(pred, finding, "high_prob_with_cam"))
    for p, pred, finding in reversed(scored):
        if p < LOW and len(groups["low_prob_with_cam"]) < per_group:
            groups["low_prob_with_cam"].append(_case(pred, finding, "low_prob_with_cam"))

    # 분류기는 반대(양성 임계값 미만)인데 CAM 과 증례는 지지하는 구간.
    # 임계값에 가까운 순으로 뽑아야 지지·반대 신뢰도가 비슷해져 충돌이 성립한다.
    for p, pred, finding in scored:
        if LOW <= p < POSITIVE_THRESHOLD and len(groups["borderline_with_cam"]) < per_group:
            groups["borderline_with_cam"].append(_case(pred, finding, "borderline_with_cam"))

    # 측면 영상 -> 품질 게이트 확인용. CAM 산출물이 없으므로 결손도 함께 확인된다.
    for dicom_id in store.sample_ids(n=10**9):
        if len(groups["low_quality"]) >= per_group:
            break
        pred = store.get(dicom_id)
        if pred is None or not pred.view.upper().startswith("LATERAL"):
            continue
        top = pred.top_findings(k=1)
        if top:
            groups["low_quality"].append(_case(pred, top[0][0], "low_quality"))

    # CAM 산출물이 없는 정면 영상 -> 필수 근거 결손 확인용
    cam_ids = {c.dicom_id for c in store.cam_cases()}
    for dicom_id in store.sample_ids(n=10**9):
        if len(groups["no_cam"]) >= 1:
            break
        pred = store.get(dicom_id)
        if pred is None or dicom_id in cam_ids:
            continue
        if not pred.view.upper().startswith(("PA", "AP")):
            continue
        for finding in TARGET_FINDINGS:
            p = pred.probability(finding)
            if p is not None and p >= HIGH:
                groups["no_cam"].append(_case(pred, finding, "no_cam"))
                break

    cases = [c for g in groups.values() for c in g]

    # 소견을 특정하지 못하는 질문 1건. 상위 소견의 가장 보수적인 판정을 확인한다.
    if cases:
        base = cases[0]
        cases.append(
            {
                **base,
                "group": "no_target",
                "question": "이 영상 어떻게 보이나요?",
                "finding": None,
            }
        )

    # 정답 음성 + 분류기 경계 음성 + CAM 없음 1건 -> 올바른 단일 소견 REJECT 확인용.
    # uncertainty_check 질문이라 cam_localization 이 필수 근거가 아니다.
    # 임계값에 가까운 순(확률 내림차순)으로 뽑아 분류기 반대 신뢰도를 최대로 한다.
    # 기존 그룹 뒤에 붙여 앞 사례들의 번호가 바뀌지 않게 한다.
    negatives = []
    for dicom_id in store.sample_ids(n=10**9):
        pred = store.get(dicom_id)
        if pred is None or dicom_id in cam_ids:
            continue
        if not pred.view.upper().startswith(("PA", "AP")):
            continue
        for finding in TARGET_FINDINGS:
            p = pred.probability(finding)
            # classifier 는 확률을 소수 4자리로 반올림해 보고하고 Trust 는 그 값으로
            # 판정한다. 0.49999 는 0.5 가 되어 지지로 뒤집히므로 같은 자릿수로 비교한다.
            if p is None or not (NEGATIVE_LOW <= p < POSITIVE_THRESHOLD):
                continue
            if round(p, 4) >= POSITIVE_THRESHOLD:
                continue
            if pred.truth(finding) != 0:
                continue
            negatives.append((p, pred, finding))
    negatives.sort(key=lambda x: -x[0])
    for _p, pred, finding in negatives[:1]:
        cases.append(
            {
                **_case(pred, finding, "negative_no_cam"),
                "question": f"이 영상의 {KO[finding]} 소견은 얼마나 확실한가요?",
            }
        )
    return cases


def _case(pred, finding: str, group: str) -> dict:
    ko = KO.get(finding, finding)
    return {
        "group": group,
        "dicom_id": pred.dicom_id,
        "study_id": pred.study_id,
        "view": pred.view,
        "finding": finding,
        "probability": pred.probability(finding),
        "ground_truth": pred.truth(finding),
        "question": f"이 영상에 {ko}가 있나요?",
    }


async def main(per_group: int, use_rag: bool) -> None:
    cases = pick_cases(per_group)

    # 이전 실행 결과를 지운다. 남아 있으면 그룹 구성이 바뀌었을 때
    # 오래된 사례가 섞여 논문에 잘못 인용될 수 있다.
    if OUT_DIR.exists():
        for old in OUT_DIR.glob("*.json"):
            old.unlink()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    for i, case in enumerate(cases, 1):
        result = await pipeline.run(
            case["question"],
            image_ref=case["dicom_id"],
            use_knowledge=use_rag,
            use_case=use_rag,
        )
        payload = {"selection": case, **result.to_dict()}
        (OUT_DIR / f"case_{i:02d}_{case['group']}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        final = result.final
        verdicts = final.verdicts if final else []
        rows.append(
            {
                "no": i,
                "group": case["group"],
                "question": case["question"],
                "finding": case["finding"] or "-",
                "prob": round(case["probability"], 3) if case["probability"] else "-",
                "gt": case["ground_truth"] if case["ground_truth"] is not None else "-",
                "overall": final.overall.value if final else "BLOCKED",
                "n_evidence": len(result.packet.items) if result.packet else 0,
                "n_literature": len(result.retrieved),
                "verdicts": "; ".join(
                    f"{v.claim}={v.verdict.value}({v.trust_score})" for v in verdicts
                ),
            }
        )

    (OUT_DIR / "summary.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _print(rows)
    print(f"\n저장: {OUT_DIR.resolve()}")


def _print(rows: list[dict]) -> None:
    print(f"\n{'#':<3}{'group':<20}{'finding':<20}{'prob':>6}{'gt':>4}  {'판정':<22}{'근거':>5}")
    print("-" * 92)
    for r in rows:
        print(
            f"{r['no']:<3}{r['group']:<20}{str(r['finding']):<20}"
            f"{str(r['prob']):>6}{str(r['gt']):>4}  {r['overall']:<22}{r['n_evidence']:>5}"
        )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-group", type=int, default=2)
    ap.add_argument("--no-rag", action="store_true", help="RAG 없이 영상 근거만으로 실행")
    args = ap.parse_args()
    asyncio.run(main(args.per_group, use_rag=not args.no_rag))
