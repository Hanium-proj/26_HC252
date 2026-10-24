# 통합 현황 — Agent/Vision ↔ RAG/Trust

**2026-09-21 작업. 담당 A 영역(stub)을 구현하고 담당 B 영역(기구현)과 연결함.**

---

## 1. 동작 확인 결과

```
POST /agent/run    -> 200, overall = ACCEPT
POST /agent/stream -> 200, SSE 순서 plan → tool×3 → evidence → verdict → done
범위 밖 질문       -> blocked = True (Gatekeeper)
기존 테스트        -> 36 passed (회귀 없음)
```

전체 흐름이 한 번에 통과한다.

```
질문 + 영상
  → Gatekeeper.check        범위 판정
  → planner.plan            유형 8종 분류, 필요 근거·도구 결정
  → orchestrator.run        gatekeeper → classifier → localizer
  → EvidencePacket
  → Knowledge/Case RAG      (선택, 실패해도 진행)
  → trust.resolver.resolve  유형별 가중 → 판정
  → FinalEvidence
```

## 2. 구현한 파일

| 파일 | 내용 |
|---|---|
| `app/tools/vision/_store.py` | **신규.** 사전 산출 예측(26,489장)·CAM 정합성(70건) 적재 |
| `app/tools/vision/classifier.py` | stub → 구현. 14소견 확률을 EvidenceItem 으로 |
| `app/tools/vision/localizer.py` | stub → 구현. CAM 정합성 지표를 EvidenceItem 으로 |
| `app/agents/gatekeeper.py` | stub → 구현. `check()` 범위 판정 + `inspect()` 품질 측정 |
| `app/agents/planner.py` | stub → 구현. 규칙 기반 + LLM 선택. **`QueryPlan` → `Plan` 오타 수정** |
| `app/agents/orchestrator.py` | stub → 구현. 도구 실행 + 품질 게이트 + 결손 기록 |
| `app/agents/pipeline.py` | **신규.** end-to-end 오케스트레이션 |
| `app/api/routes/agent.py` | "미구현" → `/agent/run`, `/agent/stream` 구현 |
| `scripts/run_demo_cases.py` | **신규.** 논문 §4 실행 사례 자동 생성 |

**담당 B 코드는 한 줄도 수정하지 않았다.** 스키마 계약(`docs/INTERFACE.md`)을 그대로 따랐다.

## 3. GPU 없이 동작하는 이유

`_store.py` 가 `glass_agent_handoff` 의 사전 산출물을 읽는다.

- `predictions/test_image_predictions.csv` — test 26,489장 × 14소견 확률 + **정답 라벨**
- `reports/grounding_A3_final_cnn.json` — 70 finding-case 의 CAM 정합성 지표

실시간 추론이 필요해지면 `runpod_client.infer` 를 구현해 같은 형식으로 반환하면
상위 계층은 수정이 필요 없다.

### 설정

```bash
# 산출물 폴더 지정 (기본값: data/glass_agent_handoff)
export GLASS_HANDOFF_DIR=/path/to/glass_agent_handoff_20260829
```

## 4. 실행 사례 생성

```bash
cd backend
python -m scripts.run_demo_cases --per-group 2 --no-rag   # RAG 없이
python -m scripts.run_demo_cases --per-group 2            # RAG 포함
```

결과: `outputs/demo_cases/case_NN_<group>.json` + `summary.json`

### 현재 산출 (RAG 미연결 상태)

| # | 그룹 | 소견 | 확률 | 정답 | 판정 |
|---|---|---|---:|---:|---|
| 1 | high_prob_with_cam | Pneumothorax | 0.958 | 1 | **ACCEPT** |
| 2 | high_prob_with_cam | Pleural Effusion | 0.921 | 1 | **ACCEPT** |
| 3 | low_prob_with_cam | Atelectasis | 0.044 | 1 | NEED_MORE_EVIDENCE |
| 4 | low_prob_with_cam | Atelectasis | 0.050 | 1 | NEED_MORE_EVIDENCE |
| 5 | low_quality (측면) | Lung Opacity | 0.194 | 0 | NEED_MORE_EVIDENCE |
| 6 | low_quality (측면) | Lung Opacity | 0.075 | 0 | NEED_MORE_EVIDENCE |
| 7 | no_cam (결손) | Edema | 0.741 | 1 | NEED_MORE_EVIDENCE |
| 8 | no_target | — | — | — | **REJECT** |

**판정 4종 중 3종이 재현된다.** 8번은 대상을 특정하지 않은 질문에서 상위 3소견을
평가한 결과로, Atelectasis(p=0.455)가 임계값 미만이라 반대 근거가 우세해 REJECT 가
나왔다. 전체 판정은 가장 보수적인 값을 따르므로 REJECT 다.

## 5. 남은 것

### CAUTION 이 아직 안 나온다 — Case RAG 인덱스 필요

`CAUTION` 은 지지와 반대가 **동시에 강할 때**만 발동한다. 현재는 영상 근거만
있어서 서로 충돌할 원천이 없다. Case RAG 가 붙어 `agreement_ratio < 0.5` 를
반환하면 분류기 양성 판정과 충돌해 CAUTION 이 나온다.

→ **Qdrant 인덱스를 확보하면 판정 4종이 모두 재현된다.** 논문 §4 의 대조 사례로
가장 강력한 재료이므로 우선순위가 높다.

```bash
# 인덱스가 없다면
python -m scripts.build_knowledge_index     # 772 chunk, 임베딩 약 $0.07
python -m scripts.build_case_index          # 부분집합만 색인해도 충분
```

### 미구현으로 남긴 것 (의도적)

| 항목 | 사유 |
|---|---|
| `tools/vision/vqa.py`, `quantifier.py` | 논문 범위 밖. 호출되면 결손으로 처리되어 판정에 반영됨 |
| `synthesis/qwen.py` | 논문 핵심은 `FinalEvidence` 까지. 최종 문장 생성은 선택 |
| `runpod_client.py` | 사전 산출물로 대체. 실시간 추론 필요 시 구현 |

## 6. 주의사항

**localizer 의 confidence 를 병변 국소화 확신도로 읽으면 안 된다.**
정합성 proxy 는 CAM 에너지가 폐야 안에 집중되었는지만 측정한다. 병변 bounding box
주석이 없어 IoU 평가를 수행하지 못했으며, 이 사실은 `metadata.caveat` 에 기록된다.
하류 설명 생성이 "병변을 여기서 찾았다"로 서술해서는 안 된다.

**gatekeeper 의 quality 는 학습된 품질 모델이 아니다.**
촬영 자세 기반 휴리스틱이다(PA 0.95 / AP 0.90 / LATERAL 0.45). 학습과 CAM 평가가
정면 영상만 사용했으므로 측면을 분포 밖 입력으로 낮게 잡은 것이며,
`metadata.quality_source = "view_heuristic"` 로 표시된다.

**RAG 실패는 파이프라인 실패가 아니다.**
검색이 안 되면 `notes` 와 `FinalEvidence.limitations` 에 사유를 남기고 영상 근거만으로
판정한다. 근거 결손은 Trust 가 이미 다루므로 여기서 예외를 올릴 이유가 없다.
