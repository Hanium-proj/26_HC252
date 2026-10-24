# 작업 지시서 — 표 4에 "깨끗한 REJECT" 사례 확보

**대상:** Claude Code
**작업 위치:** `backend/`
**예상 소요:** 스크립트 한 줄 수정 + 재실행 약 1분
**선행 문서:** `docs/DEMO_CASES_REPORT.md` (특히 §5, §6, §8-7, §8-8, §12)

---

## 1. 왜 하는가

현재 표 4의 REJECT는 **#10 `no_target` 한 건뿐**이고, 논문 예시로 두 가지 약점이 있다.

1. **위음성이다.** Atelectasis p=0.455인데 정답 라벨이 1이다. "REJECT가 옳았다"고 쓸 수 없다. (보고서 §8-8)
2. **다중 소견 사례다.** 대상을 특정하지 않은 질문이라 상위 3소견을 함께 평가했고,
   pneumothorax ACCEPT + support_devices ACCEPT + atelectasis REJECT가 섞여
   "가장 보수적 판정을 따른다"는 규칙의 예시로는 좋지만 REJECT 자체의 예시로는 복잡하다.

한편 `low_prob_with_cam` 그룹은 `p < 0.30` 조건으로 뽑는데, 실제로 선별된 것은
**p = 0.044 / 0.050**이었다. 이 값은 `MIN_REPORT_PROBABILITY = 0.05` 근처라
classifier가 근거를 아예 만들지 않아 **"분류기가 반대"가 아니라 "필수 근거 결손"**으로
NEED_MORE_EVIDENCE가 된다. (보고서 §6.1 #3·#4, §8-7)

→ 즉 현재 표에는 **"분류기가 명확히 반대해서 REJECT"인 단일 소견 사례가 없다.**

**목표:** `0.05 ≤ p < 0.30` 구간에서 사례를 뽑아, 가능하면 **정답 라벨이 0인**
(즉 REJECT가 올바른) 단일 소견 REJECT 사례를 확보한다.

---

## 2. 수정할 것 — 딱 한 군데

`backend/scripts/run_demo_cases.py` 의 `pick_cases()` 안,
`low_prob_with_cam` 그룹 선별 조건.

현재는 `p < 0.30`(또는 상수 `LOW`)만 본다. 이를 **하한을 추가**해
`MIN_REPORT_PROBABILITY(0.05) ≤ p < 0.30` 으로 바꾼다.

- 하한값은 `app/tools/vision/classifier.py`의 `MIN_REPORT_PROBABILITY`를
  import 해서 쓰거나, 동일 값을 모듈 상수로 두고 주석에 근거를 남길 것.
- 정렬은 **확률 내림차순**으로 바꾸는 것을 권장한다. 0.30에 가까운 쪽이
  classifier 반대 신뢰도(0.9 × p × quality)가 커서 REJECT_THRESHOLD(0.35)를
  넘기 쉽다. 현재는 오름차순이라 가장 낮은 값부터 뽑힌다.

> **참고:** REJECT가 나오려면 `s_con ≥ 0.35` 이고 `s_con > s_pro` 여야 한다.
> `s_con = 0.90(prior) × 1.00(type) × p × quality`. AP 영상(quality 0.9)이면
> `s_con = 0.81p` 이므로 **p ≳ 0.43**에서야 0.35를 넘는다.
> 즉 0.05–0.30 구간에서는 s_con이 0.04–0.24로 임계값에 못 미쳐
> **NEED_MORE_EVIDENCE(규칙 6)** 가 나올 가능성이 높다.
> 이는 실패가 아니라 결과다. §4를 참고해 있는 그대로 보고할 것.

---

## 3. 실행

```powershell
docker start qdrant-hanium          # 이미 떠 있으면 생략
curl http://localhost:6333/collections

$env:GLASS_HANDOFF_DIR="C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\glass_agent_handoff_20260829\glass_agent_handoff_20260829"

cd backend
python -m scripts.run_demo_cases --per-group 2
python -m pytest tests/ -q
```

---

## 4. 확인하고 보고할 것

### 4-1. 먼저 후보가 있는지 사전 조사 (실행 전에 해도 좋다)

CAM 70건 중 `0.05 ≤ p < 0.30` 인 것들의 **확률과 정답 라벨 분포**를 먼저 뽑아라.

```python
from app.tools.vision._store import get_store
s = get_store(); s.load()
rows = []
for cam in s.cam_cases():
    pred = s.get(cam.dicom_id)
    if not pred: continue
    p = pred.probability(cam.finding); gt = pred.truth(cam.finding)
    if p is None: continue
    if 0.05 <= p < 0.30:
        rows.append((round(p,3), gt, cam.finding, pred.view, cam.dicom_id[:12]))
for r in sorted(rows, reverse=True): print(r)
```

- **gt=0 인 후보가 있으면** 그것이 최선이다 (올바른 REJECT 가능성).
- **전부 gt=1 이면** 보고서 §8-4가 말한 대로 CAM 70건이 전량 정답 양성이므로
  구조적으로 "올바른 REJECT"는 이 데이터에서 불가능하다. 그 사실을 명시해 보고할 것.
  이 경우 **선별 조건 변경을 되돌릴지 유지할지 판단을 요청**하라. 억지로 진행하지 말 것.

### 4-2. 실행 결과

콘솔 표 전체와, 새로 뽑힌 `low_prob_with_cam` 2건에 대해:

| 항목 | 값 |
|---|---|
| dicom_id / study_id / view | |
| finding / probability / ground truth | |
| 판정 (verdict) | |
| s_pro / s_con | |
| rationale 원문 | |
| 근거 구성 (classifier·localizer·case 각각 score) | |

`backend/outputs/demo_cases/case_NN_low_prob_with_cam.json` 에서 그대로 옮길 것.

### 4-3. 판정별 최종 분포

```
ACCEPT              N건
CAUTION             N건
REJECT              N건
NEED_MORE_EVIDENCE  N건
```

---

## 5. 하지 말 것

- **임계값 조작 금지.** `ACCEPT_THRESHOLD`, `REJECT_THRESHOLD`, `CONFLICT_RATIO`,
  `POSITIVE_THRESHOLD`, `MIN_REPORT_PROBABILITY`, `TOOL_PRIOR`, `TYPE_WEIGHT` 전부 그대로 둔다.
  REJECT가 안 나오면 "안 나왔다"가 결과다.
- `app/trust/`, `app/schemas/`, `app/tools/vision/` 수정 금지.
  이번 작업에서 바꾸는 파일은 `scripts/run_demo_cases.py` **하나뿐**이다.
- 다른 그룹(`high_prob_with_cam`, `borderline_with_cam`, `low_quality`, `no_cam`, `no_target`)의
  선별 조건 변경 금지. 기존 8건의 결과가 바뀌면 안 된다.
  → 재실행 후 **#1·#2·#5·#6·#7~#10의 판정이 이전과 동일한지 반드시 대조**할 것.
- `.env`, `data/`, `outputs/` 커밋 금지.

---

## 6. 작업 후 처리

1. `python -m pytest tests/ -q` 통과 확인 (직전 기준 **61 passed**)
2. `docs/DEMO_CASES_REPORT.md` 갱신:
   - §5 그룹 표의 `low_prob_with_cam` 조건 수정
   - §6 결과표 교체
   - §6.1 사례별 근거에서 #3·#4 항목 교체
   - §11 변경 이력에 이번 수정 추가
   - **§8-7(결손 vs 반대 구분)과 §8-8(#10 위음성)은 그대로 유지.** 여전히 유효하다.
3. 보고 형식은 §4를 따른다.

---

## 7. 배경 — 이 결과가 논문에서 쓰이는 방식

논문 표 4는 "판정 규칙이 조건에 따라 서로 다르게 동작한다"를 보이는 것이 목적이다.
성능 평가가 아니다(보고서 §8-14). 따라서:

- **깨끗한 REJECT가 나오면**: 표 4의 REJECT 예시를 그것으로 교체하고,
  #10은 "대상 미특정 질의에서 전체 판정이 가장 보수적인 값으로 수렴하는 예"로만 쓴다.
- **안 나오면**: 표 4는 현행 유지. 대신 §5 한계에
  "정답 양성만으로 구성된 CAM 산출물 때문에 올바른 REJECT를 시연하지 못했다"를 추가한다.

어느 쪽이든 논문은 성립한다. **결과를 만들어내려 하지 말고 관측된 대로 보고하라.**
