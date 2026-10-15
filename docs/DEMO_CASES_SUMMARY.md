# 실행 사례 결과 정리 (2026-09-22)

> 논문 §4 실행 사례 작업의 **한 장짜리 요약**. 근거 수치·파일 지도·한계 전문은 `docs/DEMO_CASES_REPORT.md`.

## 결론

Vision → Knowledge RAG + Case RAG → Trust Resolver 파이프라인을 실제 데이터 11건에 통과시켜 **4종 판정(ACCEPT / CAUTION / REJECT / NEED_MORE_EVIDENCE)을 모두 재현**했다. 판정 로직(`app/trust/`)과 임계값은 건드리지 않았다. 테스트 61 passed.

| 판정 | 건수 |
|---|---:|
| ACCEPT | 2 |
| CAUTION | 2 |
| REJECT | 2 |
| NEED_MORE_EVIDENCE | 5 |

## 최종 결과표 (논문 표 4 원본)

```
#  group               finding           prob    gt  판정
 1 high_prob_with_cam  Pneumothorax      0.958    1  ACCEPT
 2 high_prob_with_cam  Pleural Effusion  0.921    1  ACCEPT
 3 low_prob_with_cam   Atelectasis       0.044    1  NEED_MORE_EVIDENCE
 4 low_prob_with_cam   Atelectasis       0.050    1  NEED_MORE_EVIDENCE
 5 borderline_with_cam Pleural Effusion  0.491    1  CAUTION
 6 borderline_with_cam Cardiomegaly      0.483    1  CAUTION
 7 low_quality         Lung Opacity      0.194    0  NEED_MORE_EVIDENCE
 8 low_quality         Lung Opacity      0.075    0  NEED_MORE_EVIDENCE
 9 no_cam              Edema             0.741    1  NEED_MORE_EVIDENCE
10 no_target           -                 0.958    1  REJECT
11 negative_no_cam     Lung Opacity      0.4999   0  REJECT
```

원본: `backend/outputs/demo_cases/summary.json`, 사례별 JSON 11건.

## 판정별 대표 사례 (논문 본문용)

| 판정 | 사례 | 무슨 일이 있었나 |
|---|---|---|
| **ACCEPT** | #1 기흉 p=0.958 | classifier(0.776) + CAM(0.536) + 유사 증례 8/8(0.101) 전부 지지. 지지 1.414 ≥ 0.35 |
| **CAUTION** | #6 심비대 p=0.483 | classifier는 반대(0.392), CAM 폐야 집중(0.457)과 유사 증례 7/8(0.093)은 지지 → 지지 0.549 vs 반대 0.392, 서로 절반 이상 → 충돌 → 확정 대신 판독의에게 넘김. 정답이 양성이라 분류기의 과소 판정을 잡아낸 셈 |
| **REJECT** | #11 폐음영 p=0.4999, 정답 0 | CAM 없는 영상에 "얼마나 확실한가요?"(uncertainty_check) 질문. classifier 단독 반대(0.405) ≥ 0.35, 증례 지지(0.088)는 미약 → REJECT. **정답 음성과 일치하는 단일 소견 REJECT** |
| **NEED_MORE_EVIDENCE** | #9 폐부종 p=0.741 | classifier 지지 0.601로 ACCEPT 조건을 넘지만 필수 근거(CAM)가 없음 → "보지 않았다"를 "근거가 없다"와 구분해 보류 |

#10(REJECT)은 대상 미특정 질문에서 3소견을 동시 평가해 가장 보수적 판정으로 수렴한 예시로만 쓴다. 그 REJECT(무기폐 p=0.455)는 정답이 1이라 **위음성**이다.

## 오늘 해결한 것

1. **Qdrant 서버 전환** — 로컬 파일 모드는 227,759 벡터 적재에 41분+. Docker 서버로 바꿔 기동 37초, 11건 실행 41초. 스토리지가 RocksDB 형식이라 `latest`/v1.18은 기동 실패 → **v1.17.1** 필요.
2. **RAG가 조용히 죽어 있던 원인** — `.env` 앞의 UTF-8 BOM 때문에 `OPENAI_API_KEY`가 빈 값으로 읽힘. `config.py` 인코딩을 `utf-8-sig`로 바꿔 해결. 직전 통합 기록의 `APIConnectionError`도 이것이 원인.
3. **CAUTION 경로 확인** — 지시서가 예상한 "증례가 반대" 조합은 구조적으로 불가능(Case RAG가 소견명으로만 질의해 일치율이 소견별 상수 0.75~1.0, 항상 지지). 실제 충돌은 **분류기가 경계 음성(0.36~0.50) + CAM·증례 지지**에서만 생김. 이 구간을 뽑는 `borderline_with_cam` 그룹 추가 → CAM 70건 중 13건 해당, 2건 실행.
4. **깨끗한 REJECT 확보** — CAM 70건이 전부 정답 양성이라 CAM 사례로는 올바른 REJECT 불가. CAM을 요구하지 않는 `uncertainty_check` 질문 + 정답 음성 영상으로 `negative_no_cam` 그룹 추가 → #11. 기존 10건 판정·신뢰도 불변 확인.

## 논문 쓸 때 주의 (핵심 5개)

1. **임계값·사전확률은 캘리브레이션 안 된 설계값.** 코드 주석에 그렇게 적혀 있고 논문에도 그렇게 써야 한다.
2. **REJECT는 분류기가 "약하게" 음성일 때만 나온다.** 반대 근거의 confidence로 `1-p`가 아닌 `p`를 쓰므로 p≈0.05인 강한 음성은 반대 신뢰도가 0.03에 불과해 REJECT가 안 된다(#8). #11을 "분류기가 음성을 확신했다"로 서술하면 틀림. 한계 절에 기재.
3. **#3·#4는 분류기가 반대한 게 아니라 결손.** p<0.05면 classifier가 근거를 아예 안 만든다.
4. **CAM confidence는 국소화 정확도가 아니라 폐야 집중도 proxy.** #5는 proxy 미통과(`outside_lung_field`)인데도 지지로 집계됨 → CAUTION 예시는 #6 권장.
5. **프론트엔드는 백엔드 미연결 목업.** UI 캡처의 "CXR-NET v2.4"와 확률값은 시연용 가상 데이터.

전체 한계 16항목은 `DEMO_CASES_REPORT.md` §8.

## 남은 것

- **OPENAI_API_KEY 교체** — 노출된 키로 실행했다. platform.openai.com에서 폐기·재발급 후 `backend/.env` 첫 줄 교체.
- 논문 CAUTION 예시로 #6만 쓸지 #5도 쓸지 결정.

## 재현

```powershell
docker start qdrant-hanium
$env:GLASS_HANDOFF_DIR="C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\glass_agent_handoff_20260829\glass_agent_handoff_20260829"
cd backend
python -m scripts.run_demo_cases --per-group 2
python -m pytest tests/ -q
```
