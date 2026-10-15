# 변경 요약 — 에이전트 파이프라인 연결 (2026-10)

브랜치 `feat/agent-a4-trust-v2`. 담당 A 영역을 구현해 담당 B의 RAG/Trust와 연결하고, 논문에 실을 실행 사례를 생성했다.

**스키마 계약(`app/schemas/`, `docs/INTERFACE.md`)은 건드리지 않았다.** 다만 `app/trust/scoring.py` 한 줄을 고쳤다 — 담당 B 영역이라 아래 "확인 요청"에 따로 적었다.

---

## 한 줄로

전에는 `/health`만 돌아가는 스켈레톤이었다. 지금은 **질문 + 영상을 넣으면 판정까지 나온다.**

```
질문 + 영상
  → Gatekeeper   범위·품질 판정
  → Planner      질문 유형 8종 분류, 필요 근거 결정
  → Vision       Classifier(14소견 확률) + Localizer(CAM 정합성)
  → EvidencePacket
  → Knowledge RAG(문헌) + Case RAG(유사 증례)     ← 담당 B, 기존 구현
  → Trust Resolver                                ← 담당 B, 기존 구현
  → FinalEvidence (ACCEPT / CAUTION / REJECT / NEED_MORE_EVIDENCE)
```

`POST /agent/run`, `POST /agent/stream`(SSE)로 호출한다.

---

## 바뀐 것

### 새로 만든 것

| 파일 | 하는 일 |
|---|---|
| `app/agents/pipeline.py` | 위 흐름 전체를 하나로 묶은 진입점 |
| `app/tools/vision/_store.py` | 학습 끝나고 미리 뽑아둔 예측 결과를 읽는다. **GPU·RunPod 없이 전체 파이프라인이 돈다** |
| `scripts/run_demo_cases.py` | 판정 4종이 각각 나오는 사례를 자동 선별·실행 |
| `scripts/rerun_verdicts.py` | 저장된 사례로 판정만 재계산 + 근거 역할 ablation (논문 표 1·2). Qdrant 없이 동작 |

### stub → 구현

`gatekeeper.py`, `planner.py`, `orchestrator.py`, `api/routes/agent.py`, `tools/vision/classifier.py`, `tools/vision/localizer.py`

전부 `NotImplementedError`를 던지던 파일이다. docstring에 적혀 있던 설계 의도를 그대로 따랐다.

### 고친 것

- **`app/trust/scoring.py`** — 아래 확인 요청 참고
- `app/core/config.py` — `.env` 인코딩을 `utf-8-sig`로. Windows 편집기가 파일 앞에 붙이는 BOM 때문에 `OPENAI_API_KEY`가 **조용히 빈 값으로** 읽히고 있었다. RAG가 계속 실패하던 원인이 이거였다
- `.gitignore` — `backend/outputs/` 추가 (MIMIC 파생물이라 올리면 안 된다)

---

## 담당 B 확인 요청 — `trust/scoring.py`

반대 근거의 확신도 계산을 **`p` → `1 - p`** 로 바꿨다. 분류기가 반대편에 설 때만 적용된다.

```python
conf = n.item.confidence
if n.item.source is ToolName.CLASSIFIER and n.verdict is False:
    conf = 1.0 - conf
```

**이유:** 기존 식은 분류기가 "소견 없음"에 가까울수록(p≈0) 반대 근거가 **약해졌다.** 확률 0.05로 확실히 음성이라고 본 경우의 반대 점수가 0.03이라 REJECT 임계값 0.35를 못 넘고, 오히려 p≈0.45로 애매할 때만 REJECT가 나왔다. 뒤집힌 동작이라 판단해 고쳤고 회귀 테스트(`test_strong_negative_is_strong_opposition`)를 붙였다.

**봐줬으면 하는 것:** 이 해석이 맞는지, 그리고 `TOOL_PRIOR`·`TYPE_WEIGHT`를 다시 조정해야 하는지. 임계값(`ACCEPT_THRESHOLD`, `REJECT_THRESHOLD`, `CONFLICT_RATIO`, `POSITIVE_THRESHOLD`)은 **하나도 안 건드렸다.**

---

## 직접 돌려보기

막히기 쉬운 지점이 두 개 있어서 적어둔다.

### 1. Qdrant는 반드시 v1.17.1

```powershell
docker run -d --name qdrant-hanium -p 6333:6333 `
  -v "<qdrant_server 폴더>:/qdrant/storage" qdrant/qdrant:v1.17.1
curl http://localhost:6333/collections
```

`latest`나 v1.18+는 **기동 실패한다** (`unknown variant on_disk`). 인덱스가 구버전 RocksDB 형식이라 그렇다. v1.17.1이 알아서 변환해준다.

`.env`에 `QDRANT_URL=http://localhost:6333`을 **꼭 넣어라.** 비어 있으면 로컬 파일 모드로 떨어지는데, 22만 건 적재에 **41분** 걸린다. 서버 모드면 기동 37초 / 질의 수 ms.

### 2. 예측 산출물 경로

```powershell
$env:GLASS_HANDOFF_DIR="<glass_agent_handoff_20260829 폴더>"
```

안 잡으면 `data/glass_agent_handoff`를 찾다가 실패한다. 영상+임상정보 융합(A4) 예측을 쓰려면 `GLASS_PREDICTIONS_CSV`와 `GLASS_MODEL_NAME`도 지정한다 — `scripts/rerun_verdicts.py` 맨 위에 예시가 있다.

### 실행

```powershell
cd backend
python -m scripts.run_demo_cases --per-group 2   # 사례 생성 (약 1분)
python -m pytest tests/ -q                       # 61 passed
```

---

## 논문 재료

| 문서 | 내용 |
|---|---|
| `docs/DEMO_CASES_SUMMARY.md` | **여기부터 보면 된다.** 한 장짜리 결과 요약 |
| `docs/DEMO_CASES_REPORT.md` | 상세본. 사례별 근거 점수, 파일 지도, 논문에 꼭 써야 할 한계 16가지 |
| `docs/RETRIEVAL_EVAL_AUDIT.md` | 검색 Hit@8 재검증 (한국어 질의 → 자동 번역 시 8/8) |
| `docs/INTEGRATION.md` | 9/21 A/B 통합 작업 기록 |

현재 판정 분포 (영상+임상 융합 예측, 11건):

```
ACCEPT 5 · CAUTION 2 · REJECT 1 · NEED_MORE_EVIDENCE 3
```

CAM 근거를 맥락으로만 쓰면(ablation) CAUTION 2건이 REJECT로 바뀐다 → **CAM이 판정에 실제로 기여한다**는 근거.

---

## 일부러 안 한 것

| 항목 | 이유 |
|---|---|
| VQA, Quantifier | 논문 범위 밖. 호출되면 근거 결손으로 처리되어 판정에 반영된다 |
| `synthesis/qwen.py` (최종 문장 생성) | 논문 핵심은 `FinalEvidence`까지 |
| `runpod_client.py` (실시간 추론) | 사전 산출물로 대체. 필요해지면 같은 형식으로 반환만 하면 상위 계층은 수정 불필요 |
| 프론트엔드 연동 | 현재 프론트는 mock 파이프라인 위의 목업이라 백엔드와 연결돼 있지 않다 |

---

## 주의

- **`backend/outputs/`는 올리지 않는다.** MIMIC-CXR 파생물(예측·임상 텍스트·사례 JSON)이고 PhysioNet credentialed 데이터다. `.gitignore`에 넣어뒀다. 필요하면 자격 보유자끼리 따로 주고받자
- **`docs/DEMO_CASES_REPORT.md`에 MIMIC 영상 ID가 몇 개 있다.** 이 저장소는 private이라 그대로 뒀다. PhysioNet 자격이 없는 사람에게 저장소를 열어주기 전에 한 번 확인해달라
- **CAM 정합성 지표를 "병변 위치를 맞췄다"로 읽으면 안 된다.** 폐야 안에 열이 모였는지만 본 값이고 bbox IoU는 못 했다. 설명 생성 쪽에서 "병변을 여기서 찾았다"로 쓰면 틀린 주장이 된다
- **영상 품질 점수는 학습된 모델이 아니다.** 촬영 자세 기반 휴리스틱이다 (PA 0.95 / AP 0.90 / 측면 0.45)
