# 실행 사례 생성 보고서 — 논문 §4 (2026-09-22)

> **대상 독자: 논문 작성 세션의 Claude.** 이 저장소를 처음 보는 상태에서 논문 §3(방법)·§4(실행 사례)·§5(한계)를 쓸 수 있도록, 무엇을 어디서 읽어야 하는지와 실측 수치를 정리했다. 수치는 전부 `backend/outputs/demo_cases/*.json`에서 그대로 옮긴 것이며, 이 문서와 JSON이 다르면 JSON이 맞다.

---

## 0. 한 줄 요약

Vision(분류·CAM) → Knowledge RAG(문헌 772 chunk) + Case RAG(MIMIC-CXR 227,759 study) → Trust Resolver 파이프라인을 실제 데이터 11건에 통과시켜 **ACCEPT / CAUTION / REJECT / NEED_MORE_EVIDENCE 4종 판정을 모두 재현**했다. 임계값·판정 로직은 건드리지 않았다. CAUTION은 "분류기가 양성 임계값 바로 아래(p≈0.48–0.49)인데 CAM과 유사 증례는 지지"하는 경계 사례 2건에서 발생했다. 후속 승인에 따라 CAM 없는 정답 음성 영상에 `uncertainty_check` 질문을 한 **#11 단일 소견 REJECT**를 추가했다. 기존 #1–#10의 선별 결과와 판정·신뢰도는 모두 유지됐다.

---

## 1. 읽어야 할 파일 지도 (논문 절 → 파일)

경로는 저장소 루트 기준. **굵게** 표시한 것부터 읽는다.

| 논문 절 | 파일 | 무엇이 있나 |
|---|---|---|
| 전체 구조 | **`docs/ARCHITECTURE.md`** | 배포 구성, 파이프라인 도식, A/B 담당 경계, Python 선택 근거 |
| | `README.md`, `docs/TEAM.md` | 프로젝트 개요, 2인 역할 분담 |
| §3.1 파이프라인 | **`docs/INTERFACE.md`** | A↔B 계약. EvidenceItem/EvidencePacket/FinalEvidence 스키마, metadata 규약, 질문 유형 8종 |
| | **`backend/app/agents/pipeline.py`** | end-to-end 실행 순서 (Gatekeeper → Planner → Orchestrator → RAG → Trust) |
| | `backend/app/agents/planner.py` | 질문 → task_type 8종 분류, required_evidence 결정, RAG 검색어 생성. LLM 우선·규칙 폴백 |
| | `backend/app/agents/orchestrator.py` | vision tool 실행, 실패를 예외 대신 ToolResult(FAILED)로 기록, 품질 임계 미만 조기 종료 |
| | `backend/app/agents/gatekeeper.py` | 범위 밖 질문 차단 + 촬영 자세 기반 품질 휴리스틱 |
| | `backend/app/schemas/{common,evidence,query,verdict}.py` | 실제 pydantic 스키마. Verdict enum 4종 |
| §3.1 Vision 도구 | **`backend/app/tools/vision/_store.py`** | 사전 산출 예측(26,489장)·CAM(70건) 적재. GPU 없이 동작하는 이유. VIEW_QUALITY 표 |
| | `backend/app/tools/vision/classifier.py` | 14소견 확률 → EvidenceItem. MIN_REPORT_PROBABILITY=0.05 |
| | `backend/app/tools/vision/localizer.py` | CAM 정합성 proxy → EvidenceItem. **confidence는 폐야 집중도이지 국소화 정확도가 아님** (docstring 필독) |
| | `docs/INTEGRATION.md` | 2026-09-21 A/B 통합 기록. RAG 미연결 상태의 결과표(3종만 재현)와 "CAUTION이 안 나온 이유"의 당시 가설 |
| 분류기 성능 | (저장소 밖) `glass_agent_handoff_20260829/README.md`, `reports/metrics_A4.json` | ConvNeXt-Base 512, held-out AUROC 등. **공식 MIMIC-CXR test split이 아님** (아래 §3) |
| §3.2 Knowledge RAG | **`docs/KNOWLEDGE_RAG_REPORT.md`** | 완성된 구축 보고서 (코퍼스 17건, chunking, 임베딩, Hit@k 평가, 한국어 격차, Phase 2 계획). 논문 §3.2의 1차 재료 |
| | `docs/knowledge-rag/sources.csv` | 17개 문헌의 doc_id·기관·연도·URL·target_coverage |
| | `docs/knowledge-rag/README_Knowledge_RAG_v1.md`, `COLLECTION_STATUS_v1.md`, `RAG_ARCHITECTURE.txt` | 수집 단계 인수인계 문서 (보고서와 중복, 보조용) |
| | `backend/app/retrieval/knowledge_rag/{parse,chunk,embed,index,search,bm25,fusion,rerank,translate}.py` | 구현. search.py에 quality = 권위도×신선도 식 |
| | `backend/app/retrieval/crag.py` | Phase 3 CRAG (충분성 평가·재검색). 데모 사례에는 미사용 |
| | `backend/scripts/eval_retrieval.py`, `eval_phase2.py` | Hit@k / MRR 평가 스크립트 |
| | `docs/KNOWLEDGE_RAG_발표대본.md`, `docs/RAG_셋업가이드.md` | 발표용·셋업용. 논문에는 불필요 |
| §3.2 Case RAG | **`backend/app/retrieval/case_rag/search.py`** | 유사 증례 top-k를 **집계 1건**의 EvidenceItem으로 만드는 방식. agreement_ratio, confidence = mean_sim × ratio, quality = min(n/20, 1) |
| | `backend/app/retrieval/case_rag/build_index.py`, `index.py` | MIMIC-CXR study 단위 테이블(Findings+Impression), payload에 subject_id 미저장 |
| | `backend/scripts/build_case_index.py`, `eval_case_retrieval.py` | 색인 배치, agreement/lift 평가 |
| | `docs/KNOWLEDGE_RAG_REPORT.md` §5.4 | Case RAG 규모(227,835 study / 377,095 image / 65,379 환자), 데이터 취급 |
| §3.3 Trust | **`backend/app/trust/normalize.py`** | claim_key 도출, 도구별 지지/반대 판정 규칙, POSITIVE_THRESHOLD=0.5, DEFAULT_QUALITY=0.6 |
| | **`backend/app/trust/scoring.py`** | 신뢰도 = 사전확률 × 근거성격 가중치 × confidence × quality. TOOL_PRIOR / TYPE_WEIGHT / QUALITY_FLOOR |
| | **`backend/app/trust/resolver.py`** | 판정 규칙과 우선순위. ACCEPT_THRESHOLD=REJECT_THRESHOLD=0.35, CONFLICT_RATIO=0.5 |
| | `backend/tests/test_trust.py` | 판정 규칙의 단위 테스트 (규칙을 서술할 때 예시로 쓸 수 있음) |
| §4 실행 사례 | **이 문서 §5–§7** + **`backend/outputs/demo_cases/summary.json`** | 결과표 |
| | **`backend/outputs/demo_cases/case_NN_<group>.json`** (11건) | 사례별 전체 기록: selection / plan / packet / retrieved / final. 근거 수치는 여기서 |
| | `backend/scripts/run_demo_cases.py` | 사례 선별 기준(7그룹)과 실행 스크립트 |
| | `WORKORDER_demo_cases.md` | 이번 작업 지시서 (무엇을 하지 말라고 했는지 포함) |
| | `WORKORDER_clean_reject.md`, 이 문서 §5.1·§6.2 | 후속 작업 지시와 사전 조사, 사용자 승인으로 변경된 사양, 검증 결과 |
| | `backend/outputs/clean_reject_verification.json` | 사전 조사 후보 25건, 기존 10건 대조, #11 점수 재계산 및 재실행 시간 (로컬 검증 기록) |
| §5 한계 | **이 문서 §8** | 논문에 반드시 써야 할 한계 목록 |
| 시연/UI (선택) | `frontend/README.md`, `frontend/DESIGN.md`, `docs/DEMO_SCRIPT.md`, `docs/report-captures/*.png` (9장) | **프론트엔드는 mock 파이프라인 위의 목업**이다. 백엔드와 연결돼 있지 않고 화면의 "CXR-NET v2.4", 확률값 등은 시연용 가상 데이터. 논문에서 UI 캡처를 쓰되 실제 파이프라인 출력이라고 쓰면 안 된다 |

**읽지 않아도 되는 것:** `frontend/lib/demo/*` (mock 데이터), `frontend/components/*`, `backend/.env`(시크릿), `backend/data/*`(인덱스·캐시), `backend/app/synthesis/qwen.py`(미구현 stub), `backend/app/tools/vision/{vqa,quantifier,runpod_client}.py`(미구현 stub).

---

## 2. 시스템 개요 (한 단락)

질문과 영상이 들어오면 Gatekeeper가 범위를 판정하고 촬영 자세로 입력 품질(PA 0.95 / AP 0.90 / LATERAL 0.45)을 매긴다. Planner가 질문을 8개 유형 중 하나로 분류하고 대상 소견·필수 근거(`classifier_prediction`, `cam_localization`)·문헌 검색어를 정한다. Orchestrator가 classifier와 localizer를 실행해 EvidencePacket을 만든다. Knowledge RAG가 대상 소견당 문헌 chunk 3건, Case RAG가 유사 study 8건을 집계한 근거 1건을 더한다. Trust Resolver가 모든 근거를 소견(claim)별로 묶어 지지/반대 신뢰도를 합산하고 ACCEPT / CAUTION / REJECT / NEED_MORE_EVIDENCE를 낸다. 전체 판정은 주장별 판정 중 가장 보수적인 것을 따른다. 도식은 `docs/ARCHITECTURE.md`.

---

## 3. 실험 환경

### 3.1 데이터·모델

| 항목 | 값 | 출처 |
|---|---|---|
| 분류기 | ConvNeXt-Base (`convnext_base.fb_in22k_ft_in1k`), 512×512, U-MultiClass 라벨 정책, EMA 체크포인트, flip-TTA | handoff README |
| 소견 14종 | CheXpert 라벨 체계 (Atelectasis, Cardiomegaly, Consolidation, Edema, Enlarged Cardiomediastinum, Fracture, Lung Lesion, Lung Opacity, No Finding, Pleural Effusion, Pleural Other, Pneumonia, Pneumothorax, Support Devices) | `_store.py` CLASS_NAMES |
| 분류기 성능 | image AUROC 0.8395 / mAP 0.4133, study AUROC 0.8416 / mAP 0.4283 | handoff README. **subject-disjoint held-out split이며 공식 MIMIC-CXR test split이 아님** |
| 분할 | Train 208,536 / Val 26,100 / Test 26,489 image (Test 16,054 study, 4,557 subject) | handoff README |
| 사전 산출 예측 | test 26,489장 × 14소견 확률 + 정답 라벨 (`predictions/test_image_predictions.csv`) | `_store.py` |
| CAM 산출물 | 70 finding-case (69 unique image), 7 소견 × 10건 (Atelectasis, Cardiomegaly, Edema, Lung Opacity, Pleural Effusion, Pneumonia, Pneumothorax). **70건 전부 정답 양성**. Grad-CAM + Eigen-CAM, 폐 분할 마스크 기반 정합성 proxy | `reports/grounding_A3_final_cnn.json` |
| Knowledge 코퍼스 | 17 문헌 (guideline 8: ACR, ATS/IDSA, BTS, WHO / review 9: PMC), 647쪽, 537,059 토큰 → 899 chunk → 참고문헌 제거 후 **772 chunk** (700 토큰, overlap 100) | `KNOWLEDGE_RAG_REPORT.md` §2–3 |
| Case 코퍼스 | MIMIC-CXR 판독문 study 단위. 원본 227,835 study / 섹션 파싱 227,781 → **색인 227,759 point** | `KNOWLEDGE_RAG_REPORT.md` §5.4, Qdrant 실측 |
| 임베딩 | OpenAI text-embedding-3-large, 3,072차원, Qdrant Cosine | `embed.py`, 컬렉션 config |

### 3.2 실행 환경 (2026-09-22 실측)

| 항목 | 값 |
|---|---|
| Qdrant | Docker `qdrant/qdrant:v1.17.1` 서버 모드, 컨테이너 `qdrant-hanium`, `http://localhost:6333` |
| 컬렉션 | `radiology_cases` 227,759 points (HNSW m=16, ef_construct=100, 전부 색인됨), `knowledge_guidelines_reviews` 772 points |
| 기동 시간 | 약 37초 (RocksDB→Gridstore 자동 마이그레이션 포함). 로컬 파일 모드(`QdrantClient(path=…)`)는 순수 Python이라 같은 컬렉션 적재에 41분 이상 → 서버 모드로 전환 |
| 최초 데모 10건 실행 | **42초** (대부분 OpenAI 임베딩 API 왕복. Qdrant 질의 자체는 ms 단위). 후속 11건 검증은 §6.2 |
| 후속 데모 11건 재실행 | **41.01초**, RAG 포함. 기존 10건 불변·#11 REJECT 재현 (§6.2) |
| Python | 3.11.9, qdrant-client 1.12.2, openai 1.59.3, pydantic-settings |
| 테스트 | `python -m pytest tests/ -q` → **61 passed** |

---

## 4. Trust 판정 규칙 (논문 §3.3에 그대로 옮길 수 있는 형태)

코드: `backend/app/trust/{normalize,scoring,resolver}.py`. 아래 상수는 전부 코드 원문이며 이번 작업에서 변경하지 않았다. 코드 주석에 **"검증셋 확보 전까지는 임의값이며 캘리브레이션 대상"** 이라고 명시돼 있다 — 논문에도 그렇게 써야 한다.

### 4.1 근거 하나의 신뢰도

```
score = TOOL_PRIOR[source] × TYPE_WEIGHT[evidence_type] × confidence × quality
        (quality < QUALITY_FLOOR(0.25) 이거나 검증 대상 미상이면 0)
```

| TOOL_PRIOR | 값 | | TYPE_WEIGHT | 값 |
|---|---:|---|---|---:|
| classifier | 0.90 | | model (환자 영상) | 1.00 |
| quantifier | 0.80 | | literature (문헌) | 0.80 |
| localizer | 0.70 | | case (증례) | 0.65 |
| vqa | 0.60 | | | |
| knowledge | 0.75 | | | |
| case | 0.55 | | | |
| gatekeeper | 0.00 | | | |

`quality`의 출처: 영상 근거는 gatekeeper의 촬영 자세 휴리스틱(PA 0.95 / AP 0.90 / AP AXIAL 0.80 / LATERAL·LL 0.45 / 기타 0.60). 문헌은 권위도(guideline 1.0, review 0.85, review/reference 0.80) × 신선도(반감기 12년 지수 감쇠, 하한 0.3, 연도 미상 0.7). 증례는 표본 수 기반 min(n/20, 1) → top_k=8이면 0.4.

### 4.2 지지 / 반대 판정 (normalize.py `_verdict`)

| 도구 | 지지(True) 조건 | 비고 |
|---|---|---|
| classifier | `probability ≥ POSITIVE_THRESHOLD(0.5)` | 미만이면 반대. 단 `probability < 0.05`면 근거 자체를 만들지 않음(classifier.py MIN_REPORT_PROBABILITY) |
| localizer | `region`이 존재 | `"outside_lung_field"`도 문자열이 있으므로 지지로 집계됨 (§8 참고) |
| quantifier | `value > 0` | 미구현 |
| case | `agreement_ratio ≥ 0.5` | 유사 사례 중 해당 소견 보유 비율 |
| knowledge, vqa | 항상 None (판정불가) | 맥락·인용으로만 쓰이고 신뢰도 합산에서 제외 |

### 4.3 주장별 판정 (resolver.py `resolve_claim`) — 순서가 곧 우선순위

```
1. 필수 근거 결손(missing)             → NEED_MORE_EVIDENCE
2. 근거 없음                           → NEED_MORE_EVIDENCE
3. 충돌: pro와 con이 모두 있고
   min(s_pro, s_con) ≥ CONFLICT_RATIO(0.5) × max(s_pro, s_con)   → CAUTION
   (영상 근거가 한쪽에만 있으면 resolved_to로 해석 방향 기록, 양쪽 다 있으면 None)
4. s_pro ≥ ACCEPT_THRESHOLD(0.35) and s_pro > s_con              → ACCEPT
5. s_con ≥ REJECT_THRESHOLD(0.35) and s_con > s_pro              → REJECT
6. 그 외                                                          → NEED_MORE_EVIDENCE
overall = 주장별 판정 중 가장 보수적인 것 (NEED_MORE_EVIDENCE < CAUTION < REJECT < ACCEPT)
```

`trust_score` = min(s_pro, 1.0). 1.0으로 포화된 값이 표에 보이는 이유.

### 4.4 RAG 호출 방식 (pipeline.py)

- Knowledge: Planner가 만든 영문 검색어(예: `"Pneumothorax chest radiograph diagnostic criteria and management"`)로 대상 소견당 top-3.
- Case: **`"chest radiograph with {claim}"`** 라는 소견명 텍스트로 top-8을 검색해 1건으로 집계. 첫 번째 대상 소견에만 수행. → 검색 질의가 환자 영상·판독문이 아니라 소견명이므로 **agreement_ratio가 영상과 무관하게 소견별 상수**가 된다 (§7.2, §8).

---

## 5. 사례 선별 (run_demo_cases.py `pick_cases`)

정답 라벨은 **선별에만** 쓰이고 검색·판정에는 들어가지 않는다. `--per-group 2`.

| 그룹 | 조건 | 기대 판정 | 선별 건수 |
|---|---|---|---|
| `high_prob_with_cam` | CAM 있음, p ≥ 0.70, 확률 내림차순 | ACCEPT | 2 |
| `low_prob_with_cam` | CAM 있음, p < 0.30, 확률 오름차순 | 분류기 근거 결손 확인 | 2 |
| `borderline_with_cam` | CAM 있음, 0.30 ≤ p < 0.50, 임계값에 가까운 순 | **CAUTION** | 2 (이번 작업에서 추가) |
| `low_quality` | LATERAL 영상, 최상위 소견 | 품질 게이트 확인 | 2 |
| `no_cam` | CAM 없는 정면 영상, p ≥ 0.70 | 필수 근거 결손 | 1 (고정) |
| `no_target` | 1번 사례 영상에 "이 영상 어떻게 보이나요?" | 대상 미특정 처리 | 1 (고정) |
| `negative_no_cam` | CAM 없는 정면(PA/AP 계열), gt=0, **원확률 0.43 ≤ p < 0.50**, 추가로 `round(p, 4) < 0.50`, 원확률 내림차순 | 단일 소견 REJECT | 1 (고정) |

기본 질문 템플릿: `"이 영상에 {소견 한국어}가 있나요?"` (기흉·흉수·심비대·무기폐·폐부종·경화·폐음영·폐렴). Planner가 규칙 기반으로 `finding_presence`로 분류하고 대상을 잡는다. `no_target`은 위 표의 질문을 쓰며, `negative_no_cam`은 **`"이 영상의 {소견 한국어} 소견은 얼마나 확실한가요?"`** 를 사용한다. `확실` 키워드로 `uncertainty_check`가 되고 한국어 소견명으로 대상이 추출된다.

### 5.1 REJECT 후속 작업의 사전 조사와 승인된 변경

`WORKORDER_clean_reject.md` §4-1 사전 조사를 재확인했다. **CAM 70건은 gt=1 70건**, 이 중 **0.05 ≤ p < 0.30 후보 25건도 gt=1 25건 / gt=0 0건**이다. 이 CAM 후보만으로 정답 음성과 일치하는 REJECT를 확보할 수 없다. 해당 구간은 분류기 반대 점수도 최대 약 0.222로 REJECT 임계값 0.35보다 작고, localizer와 증례는 지지한다. 원래 제안대로 `low_prob_with_cam` 하한을 바꾸지 않았으며 #3·#4의 결손 사례도 유지했다.

이 결과를 보고받은 사용자가 **`negative_no_cam` 1건 추가, 질문 유형 `uncertainty_check`, 기존 10건 불변, 임계값 미변경**을 승인했다. 이 후속 사양이 최초 지시서의 `low_prob_with_cam` 변경안을 대체한다. #11의 필수 근거는 `classifier_prediction`과 `view_quality`이고 CAM은 필수가 아니다.

선별 시 classifier가 확률을 소수 4자리로 반올림해 Trust에 전달한다는 점도 반영했다. 원확률 `0.4999953`은 전달값 `0.5`가 되어 양성 지지로 바뀌므로 제외한다. 최종 선택된 원확률 `0.49992603`은 전달값 `0.4999`로 음성 경계에 남는다. **0.43은 후보 선별 하한일 뿐 REJECT를 보장하지 않는다**(AP에서 0.81×0.43=0.3483 < 0.35). 최종 판정은 실제 파이프라인으로 확인했다.

---

## 6. 결과 — 논문 표 4

콘솔 출력 그대로:

```
#  group               finding               prob  gt  판정                       근거
--------------------------------------------------------------------------------------------
1  high_prob_with_cam  Pneumothorax         0.958   1  ACCEPT                    3
2  high_prob_with_cam  Pleural Effusion     0.921   1  ACCEPT                    3
3  low_prob_with_cam   Atelectasis          0.044   1  NEED_MORE_EVIDENCE        2
4  low_prob_with_cam   Atelectasis           0.05   1  NEED_MORE_EVIDENCE        2
5  borderline_with_cam Pleural Effusion     0.491   1  CAUTION                   3
6  borderline_with_cam Cardiomegaly         0.483   1  CAUTION                   3
7  low_quality         Lung Opacity         0.194   0  NEED_MORE_EVIDENCE        2
8  low_quality         Lung Opacity         0.075   0  NEED_MORE_EVIDENCE        2
9  no_cam              Edema                0.741   1  NEED_MORE_EVIDENCE        2
10 no_target           -                    0.958   1  REJECT                    5
11 negative_no_cam     Lung Opacity           0.5   0  REJECT                    2
```

`근거` = EvidencePacket의 영상 근거 수(gatekeeper 포함). RAG 근거(문헌 3 + 증례 1)는 별도.

콘솔/summary의 `prob`는 소수 3자리 표시다. **#11의 표시값 0.5를 양성 판정 입력으로 해석하면 안 된다.** 원확률은 0.49992603, classifier와 Trust가 쓰는 값은 0.4999다. 논문 표에서는 #11을 **0.4999**로 적어 경계 방향을 보존한다.

최종 분포: **ACCEPT 2건 / CAUTION 2건 / REJECT 2건 / NEED_MORE_EVIDENCE 5건**.

### 6.1 사례별 근거 신뢰도 (JSON에서 재계산, `score()` 적용값)

각 행: 도구 / 지지·반대 / confidence / quality / score. 문헌 3건은 전 사례에서 판정불가(맥락)이므로 s_pro·s_con에 들어가지 않는다.

**#1 Pneumothorax p=0.958, AP, gt=1 → ACCEPT** (dicom `007d334a-…`, study 50760076)
- classifier 지지 0.9583 × q0.9 → **0.776** · localizer 지지 (lung_field, energy 0.851) → **0.536** · case 지지 (8/8 일치, sim 0.707) → **0.101**
- s_pro = 1.414, s_con = 0 → "지지 근거 신뢰도 1.414 이 임계값 0.35 이상"

**#2 Pleural Effusion p=0.921, AP, gt=1 → ACCEPT** (`ec193a14-…`, 51492631)
- classifier 0.746 · localizer (lung_field, 0.786) 0.495 · case (8/8, sim 0.732) 0.105 → s_pro 1.346

**#3 Atelectasis p=0.044, AP, gt=1 → NEED_MORE_EVIDENCE** (`f940a031-…`, 56869639)
- **classifier 근거 없음** (p < 0.05라 미보고 → `missing_evidence=['classifier_prediction']`) · localizer 지지 0.541 · case 지지 (6/8, sim 0.728) 0.078
- 판정 사유: "Planner 가 요구한 근거를 수집하지 못함". ※ 분류기가 반대한 것이 아니라 결손이다 (§8).

**#4 Atelectasis p=0.050, PA, gt=1 → NEED_MORE_EVIDENCE** (`861a4d7d-…`, 57877745) — #3과 동일 구조 (localizer 0.556, case 0.078).

**#5 Pleural Effusion p=0.491, AP, gt=1 → CAUTION** (`45abc995-02a94561-19fd7a59-00ad34dd-829f20e1`, 56646752) — §7.1

**#6 Cardiomegaly p=0.483, AP, gt=1 → CAUTION** (`f3cafbf1-c7d3ad98-73a394af-fae23ae9-fdfd7462`, 56496732) — §7.1

**#7 Lung Opacity p=0.194, LATERAL, gt=0 → NEED_MORE_EVIDENCE** (`dcd906c2-…`, 50279568)
- quality 0.45 (측면). classifier **반대** 0.1937 × 0.45 → 0.078 · localizer 없음(측면은 CAM 미산출 → `missing_evidence=['cam_localization']`) · case 지지 (7/8, sim 0.703) 0.088
- 0.078 ≥ 0.5 × 0.088 이므로 **충돌 조건은 성립**했으나(conflict 객체 생성됨) 필수 근거 결손이 우선해 NEED_MORE_EVIDENCE. 판정 우선순위 규칙의 실례.

**#8 Lung Opacity p=0.075, LATERAL, gt=0 → NEED_MORE_EVIDENCE** (`8df1bc0a-…`, 52060840) — classifier 반대 0.030, case 지지 0.088, CAM 결손.

**#9 Edema p=0.741, AP, gt=1 → NEED_MORE_EVIDENCE** (`7cc386dd-…`, 51638975)
- classifier 지지 0.601 · case 지지 (8/8, sim 0.756) 0.108 · **CAM 없음** → s_pro 0.709로 ACCEPT 조건을 넘지만 필수 근거 결손이 우선. "보지 않았다"와 "근거가 없다"를 구분하는 설계 의도의 실례.

**#10 no_target, #1과 같은 영상, "이 영상 어떻게 보이나요?" → REJECT** (`007d334a-…`, 50760076)
- Planner가 대상을 못 잡아 classifier가 상위 3소견을 보고, RAG는 대상이 없어 미호출.
- pneumothorax: classifier 0.776 + localizer 0.536 → **ACCEPT** (1.312)
- support_devices: classifier 0.5784 → 0.469 → **ACCEPT**
- atelectasis: classifier 0.455 < 0.5 → 반대 0.369 ≥ 0.35 → **REJECT**
- overall = 가장 보수적 → **REJECT**. ※ 이 영상의 Atelectasis 정답은 **1**이다. 즉 REJECT는 위음성이다 (§8).

**#11 negative_no_cam, Lung Opacity, AP, gt=0 → REJECT**

| 항목 | 저장된 결과 |
|---|---|
| dicom_id | `f1566bb6-de1333d7-a96d62cc-09ff188b-e0feecbb` |
| study_id / view | `54634704` / `AP` |
| finding / ground truth | `Lung Opacity` / `0` |
| probability 원값 / classifier 전달값 | `0.49992603` / `0.4999` |
| question | 이 영상의 폐음영 소견은 얼마나 확실한가요? |
| task_type / targets | `uncertainty_check` / `["Lung Opacity"]` |
| required_evidence | `["classifier_prediction", "view_quality"]` |
| tool_results | gatekeeper `success`, classifier `success`, localizer `skipped` |
| packet.status / missing_evidence() | `partial` / **`[]`** |
| s_pro / s_con | **0.0879 / 0.4049** |
| claim / verdict / overall | `lung_opacity` / `REJECT` / `REJECT` |
| trust_score / conflict | `0.0879` / `None` |
| final.limitations | `[]` |

`partial`은 localizer가 건너뛰어졌다는 상태다. `missing_evidence()`는 **계획에서 요구한 근거만** 검사하며, gatekeeper가 `view_quality`, classifier가 `classifier_prediction`을 충족한다. 따라서 필수 근거 결손은 없다.

| 근거 | 방향 | confidence | quality | score |
|---|---|---:|---:|---:|
| classifier | 반대 | 0.4999 | 0.9 | **0.4049** |
| localizer | 미생산(CAM 없음) | — | — | 합산 대상 없음 |
| case | 지지 | 0.615 | 0.4 | **0.0879** |
| knowledge p.39 | 판정불가 | 0.594 | 0.336 | 0.1198 (합산 제외) |
| knowledge p.51 | 판정불가 | 0.577 | 0.336 | 0.1163 (합산 제외) |
| knowledge p.31 | 판정불가 | 0.576 | 0.336 | 0.1161 (합산 제외) |

증례는 8건 중 7건이 지지(agreement_ratio=0.875, mean_similarity=0.703). 문헌 3건은 모두 *General chest radiograph interpretation* (2011)이며 지지·반대 합산에는 들어가지 않는다. `0.0879 < 0.5×0.4049`라 충돌 조건을 만족하지 않고, `s_con ≥ 0.35` 및 `s_con > s_pro`로 REJECT가 된다. `trust_score`는 지지 합계이므로 REJECT의 확신도나 음성 확률이 아니다.

**rationale 원문:**

> 반대 근거 신뢰도 0.405 이 우세. 판정불가 근거 3건은 맥락으로만 사용

논문 표 4의 단일 소견 REJECT 예시는 #11을 사용한다. #10은 다중 소견에서 전체 판정이 가장 보수적인 값을 따르는 예시로 설명한다. #11은 정답 음성 라벨과 일치하지만 **p≈0.5의 경계 사례**다. 분류기가 강하게 음성을 확신했다거나 임상적 배제 성능을 입증했다고 서술하지 않는다.

### 6.2 기존 10건 불변 검증과 테스트

클로드가 그룹 추가 전에 저장한 `scratchpad/summary_before.json`(10건)을 기준으로, 후속 11건 실행의 첫 10건을 대조했다. **번호·그룹·질문·소견·표시확률·정답·전체 판정·영상/RAG 근거 수·주장별 판정과 trust_score가 전부 동일**하다. 또한 중단 시점에 남아 있던 11건 JSON과 재실행 JSON의 `selection`이 모두 일치한다.

| 사례 | 추가 전 | 추가 후 | 비교 |
|---|---|---|---|
| #1·#2 | ACCEPT | ACCEPT | 동일 |
| #3·#4 | NEED_MORE_EVIDENCE | NEED_MORE_EVIDENCE | 동일 |
| **#5·#6** | **CAUTION** | **CAUTION** | **동일** |
| #7·#8·#9 | NEED_MORE_EVIDENCE | NEED_MORE_EVIDENCE | 동일 |
| #10 | REJECT | REJECT | 동일 |

검증은 기존 결과를 임시 폴더에 보관하고 별도 폴더에서 RAG 포함 11건을 **41.01초**에 실행한 뒤, 대조에 통과한 JSON을 `backend/outputs/demo_cases/`에 반영하는 방식으로 수행했다. 세부 기록은 `backend/outputs/clean_reject_verification.json`에 보관한다. 대상이 있는 10건은 각각 문헌 3건·증례 집계 1건을 확보했고 검색 실패 `notes`는 전 사례에서 비어 있다.

`python -m pytest tests/ -q` → **61 passed**. 이번 이어받기 작업은 실행 스크립트와 이 보고서를 수정했으며, `app/trust/`, `app/schemas/`, `app/tools/vision/` 및 임계값은 수정하지 않았다.

---

## 7. CAUTION 분석 — 논문 §4 본문

### 7.1 두 사례의 근거 구성

| | **#6 Cardiomegaly** (논문 예시로 권장) | #5 Pleural Effusion |
|---|---|---|
| 영상 | AP, quality 0.9, gt=1 | AP, quality 0.9, gt=1 |
| **반대** classifier | p=0.4833 (< 0.5) → score **0.392** | p=0.4911 → **0.398** |
| **지지** localizer | eigen-CAM `lung_field`, lung energy 0.725, proxy_pass=**True** → **0.457** | `outside_lung_field`, energy 0.635, proxy_pass=**False** → **0.400** |
| **지지** case | 유사 study 8건 중 **7건** Cardiomegaly (ratio 0.875, mean sim 0.741) → **0.093** | 8건 중 **8건** Pleural Effusion (ratio 1.0, sim 0.732) → **0.105** |
| 맥락 knowledge | *General chest radiograph interpretation* (RV006, PMC8139021, 2011) p.66/67/78 — 판정불가 | *General chest radiograph interpretation* (RV006, 2011) p.85; *Pleural effusion* (RV004, PMC6647819, 2019) p.2/4 — 판정불가 |
| s_pro / s_con | **0.549 / 0.392** → 0.392 ≥ 0.5×0.549=0.275 → 충돌 | **0.505 / 0.398** → 충돌 |
| resolved_to | None (영상 근거가 양쪽에 있음) | None |
| rationale (원문) | "근거 충돌. 지지 2건(신뢰도 0.549) 대 반대 1건(신뢰도 0.392). 영상 근거만으로 해소되지 않음. 판정불가 근거 3건은 맥락으로만 사용" | "근거 충돌. 지지 2건(신뢰도 0.505) 대 반대 1건(신뢰도 0.398). 영상 근거만으로 해소되지 않음. …" |
| 유사 증례 예시 (payload) | s53341062 (PA, AP) Cardiomegaly · s58414419 (AP) Cardiomegaly, Edema, Pleural Effusion · s58679271 (AP) Cardiomegaly | s58898525 (AP) Edema, Pleural Effusion · s52984300 (PA, LATERAL) Pleural Effusion, Pneumonia · s50737668 (AP) Atelectasis, Pleural Effusion |

해석: 분류기 단독이라면 0.483은 "음성"으로 표시됐을 값이다(기본 표시 임계값 0.5). CAM이 폐야 안에 집중되고 유사 판독문 7/8이 심비대를 보고하므로 시스템은 확정 대신 CAUTION을 내고 판독의에게 넘긴다. 정답이 양성이므로 이 경우 CAUTION은 분류기의 과소 판정을 잡아낸 셈이다.

**#5를 쓸 때 주의:** localizer가 `proxy_pass=False`(CAM 에너지가 폐야 밖)인데도 `region` 문자열이 있어 지지로 집계됐다. 흉수는 늑골횡격막각에 고이므로 폐야 마스크 밖일 수 있어 임상적으로는 설명 가능하지만, 현재 정규화 규칙이 이를 구분하지 못한다는 점을 함께 적어야 한다.

### 7.2 왜 이 구간에서만 CAUTION이 나오는가 (진단 기록)

작업 지시서(`WORKORDER_demo_cases.md` §4-2)는 "분류기 확률은 높은데 유사 사례 일치율은 낮은 조합"을 찾으라고 했지만, 그런 조합은 **존재할 수 없다**:

1. Case RAG 질의가 `"chest radiograph with {claim}"` 소견명 텍스트이므로, 같은 소견이면 어떤 영상이든 검색 결과가 같다. 8개 대상 소견의 실측 agreement_ratio:

   | 소견 | ratio | mean sim | case score |
   |---|---:|---:|---:|
   | Pneumothorax | 1.000 | 0.707 | 0.101 |
   | Pleural Effusion | 1.000 | 0.732 | 0.105 |
   | Edema | 1.000 | 0.756 | 0.108 |
   | Cardiomegaly | 0.875 | 0.741 | 0.093 |
   | Lung Opacity | 0.875 | 0.703 | 0.088 |
   | Pneumonia | 0.750 | 0.699 | 0.075 |
   | Atelectasis | 0.750 | 0.728 | 0.078 |
   | Consolidation | 0.750 | 0.724 | 0.078 |

   전부 ≥ 0.5 → **증례 근거는 항상 지지 쪽**이다.
2. 설령 ratio < 0.5가 나와도 confidence = mean_sim × ratio 이므로 반대 증례의 score는 0.55×0.65×(0.7×0.4)×0.4 ≈ 0.04 이하. 분류기 양성(≥ 0.9×0.5×0.9 = 0.405)과 충돌 조건(≥ 절반)을 절대 못 넘는다.
3. 따라서 충돌은 거울상 — **분류기가 반대(p < 0.5)이고 localizer + 증례가 지지** — 에서만 성립한다. s_pro ≈ localizer(≈0.4–0.55) + case(≈0.1)이므로 s_con = 0.9 × p × 0.9 ≥ 0.5 × s_pro 를 풀면 **p ≳ 0.36**. 즉 p ∈ [0.36, 0.50) 구간.
4. 기존 스크립트는 p ≥ 0.70 과 p < 0.30 만 뽑아 이 구간을 건너뛰고 있었다. CAM 70건의 확률 분포: <0.30 27건 / 0.30–0.50 17건 / 0.50–0.70 12건 / ≥0.70 14건. 점수식으로 사전 계산하면 **13건**(p 0.360–0.491)이 충돌 조건을 만족한다.

정리: CAUTION은 실제 데이터에서 임계값 조작 없이 나왔다. 다만 그 발생 경로가 "증례가 반대"가 아니라 "분류기가 경계 음성 + 영상·증례가 지지"라는 점을 논문에 정확히 써야 한다. 증례 RAG가 반대 근거로 기능하지 못하는 것은 §8의 한계다.

---

## 8. 논문 §5 한계에 반드시 써야 할 것

정직성 항목. 각 항목의 근거 위치를 같이 적었다.

1. **임계값·사전확률은 캘리브레이션되지 않았다.** `ACCEPT_THRESHOLD=REJECT_THRESHOLD=0.35`, `CONFLICT_RATIO=0.5`, `POSITIVE_THRESHOLD=0.5`, `TOOL_PRIOR`, `TYPE_WEIGHT` 전부 설계값. (resolver.py, scoring.py 주석)
2. **Case RAG는 반대 근거가 될 수 없다.** 질의가 소견명 텍스트라 agreement_ratio가 소견별 상수(0.75–1.0)이고 항상 지지 쪽. 환자 판독문·영상 임베딩으로 질의하도록 바꾸기 전에는 "유사 증례가 분류기와 충돌"하는 시나리오는 재현 불가. (§7.2, `pipeline.py _cases`, `case_rag/search.py`)
3. **증례 근거의 가중치가 작다.** top_k=8 → quality 0.4, prior 0.55 × type 0.65 → 최대 score ≈ 0.11. 판정을 뒤집을 수 없고 충돌 성립에 보조적으로만 기여.
4. **CAM 70건이 전부 정답 양성.** 따라서 "분류기 과대 판정을 CAM·증례가 반박"하는 반대 방향 CAUTION은 시연 불가. 경계 사례 CAUTION 13건은 모두 분류기 과소 판정.
5. **localizer confidence는 국소화 정확도가 아니다.** CAM 에너지의 폐야 집중 비율(proxy). bbox IoU 미수행. `outside_lung_field`도 지지로 집계됨(#5). (localizer.py docstring, INTEGRATION.md §6)
6. **quality는 학습된 품질 모델이 아니라 촬영 자세 휴리스틱.** (gatekeeper.py, `_store.py VIEW_QUALITY`)
7. **#3·#4의 NEED_MORE_EVIDENCE는 분류기 반대가 아니라 결손.** p < 0.05면 classifier가 근거를 내지 않아(`MIN_REPORT_PROBABILITY`) 필수 근거 결손으로 처리된다. "분류기가 낮게 봤다"로 서술하면 틀린다.
8. **#10 REJECT는 위음성.** Atelectasis p=0.455, 정답 1. overall이 가장 보수적 판정을 따르는 규칙 때문에 Pneumothorax ACCEPT가 있어도 케이스 전체가 REJECT로 표시된다. "REJECT가 옳았다"고 쓰지 말 것.
9. **분류기 성능은 공식 MIMIC-CXR test split이 아닌 자체 held-out split.** (handoff README 첫 줄)
10. **Knowledge RAG 한국어 질의 격차** (Hit@8 0.750 vs 영어 1.000). 데모는 Planner가 만든 영문 검색어를 쓰므로 영향받지 않았지만 실사용 질의는 한국어. (KNOWLEDGE_RAG_REPORT §4.2)
11. **Knowledge 코퍼스 저밀도 소견** (Fracture 10 chunk, Enlarged Cardiomediastinum 20, Support Devices 38 — 단일 문서 의존). (같은 보고서 §2.3)
12. **미구현 구성요소:** VQA, Quantifier, Qwen synthesis(최종 문장 생성), RunPod 실시간 추론. 논문 범위는 FinalEvidence까지. (INTEGRATION.md §5)
13. **프론트엔드는 목업.** 백엔드 미연결, 화면 데이터는 시연용 가상값. UI 캡처를 실제 파이프라인 출력으로 서술 금지.
14. **사례 수가 11건.** 판정 규칙의 동작을 보이는 실행 사례이지 성능 평가가 아니다. 통계적 주장을 하면 안 된다.
15. **MIMIC-CXR 데이터 취급.** PhysioNet credentialed. 논문에 판독문 원문·영상을 싣지 말 것. 출력 JSON의 `case_ids`(s########)는 MIMIC study id다. dicom_id도 마찬가지. 식별자를 논문에 실을지 여부는 DUA 확인 후 결정.
16. **#11은 질문 유형과 선별 조건이 다르다.** CAM 없는 정답 음성 영상에 CAM을 필수로 요구하지 않는 `uncertainty_check`를 사용했다. 같은 영상을 `finding_presence`로 질문하면 CAM 결손으로 NEED_MORE_EVIDENCE가 되므로, 다른 사례와 질문 조건이 동일한 비교라고 쓰면 안 된다. 현재 점수식은 분류기 반대에도 `p` 자체를 confidence로 사용한다(`1-p`가 아님). 따라서 p≈0.5인 #11의 REJECT는 현행 규칙 시연이며 강한 음성 확률을 의미하지 않는다. CAM 데이터 자체에서 정답 음성 REJECT를 확보하지 못했다는 제한은 여전히 남는다.

---

## 9. 논문에 그대로 쓸 수 있는 값 (§3.2 등)

- `radiology_cases` 포인트 수: **227,759** (Qdrant `/collections/radiology_cases` 실측, 2026-09-22)
- `knowledge_guidelines_reviews` 포인트 수: **772**
- 벡터: 3,072차원, Cosine, HNSW(m=16, ef_construct=100)
- Knowledge citation 예시 1건: **"Pneumothorax imaging", PMC / peer-reviewed, 2025, p.4** (doc_id RV008, chunk `RV008_p0004_c005`, https://pmc.ncbi.nlm.nih.gov/articles/PMC12656181/) — #1 사례의 3번째 인용. 같은 사례의 1·2번은 "Pleural imaging", 2024, p.6–7 (RV007, PMC10928554).
- Case RAG 검색 latency: 파이프라인 1건당 RAG 포함 약 4초 (OpenAI 임베딩 왕복이 지배적)
- 최초 파이프라인 10건 총 42초. 후속 11건 결과·검증은 §6.2, 테스트 61 passed

---

## 10. 재현 절차

```powershell
# 1. Qdrant 서버 (스토리지는 이미 v1.17.1 형식으로 마이그레이션됨)
docker start qdrant-hanium
#   처음이라면:
#   docker run -d --name qdrant-hanium -p 6333:6333 `
#     -v "C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\DATA\qdrant_server\qdrant_server:/qdrant/storage" `
#     qdrant/qdrant:v1.17.1
curl http://localhost:6333/collections

# 2. 환경변수
$env:GLASS_HANDOFF_DIR="C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\glass_agent_handoff_20260829\glass_agent_handoff_20260829"
# backend/.env 에 OPENAI_API_KEY, QDRANT_URL=http://localhost:6333, KNOWLEDGE_COLLECTION, CASE_COLLECTION

# 3. 실행
cd backend
python -m scripts.run_demo_cases --per-group 2
python -m pytest tests/ -q
```

`--no-rag`를 붙이면 영상 근거만으로 실행된다(INTEGRATION.md의 3종 결과 재현). 이미지 버전을 `latest`나 v1.18.x로 바꾸면 `unknown variant on_disk` 오류로 기동 실패한다.

---

## 11. 이번 작업(2026-09-22)에서 바뀐 것

| 파일 | 변경 | 이유 |
|---|---|---|
| `backend/app/core/config.py` | `env_file_encoding` `utf-8` → `utf-8-sig` | `.env` 앞에 UTF-8 BOM이 붙어 있어 첫 줄 `OPENAI_API_KEY`가 빈 값으로 읽혔음. INTEGRATION.md 시점의 RAG 실패(`APIConnectionError`)도 이것이 원인 |
| `backend/scripts/run_demo_cases.py` | `borderline_with_cam` 그룹 추가, `LOW=0.30` 상수화, docstring 갱신 | §7.2 |
| `backend/.env` | `QDRANT_URL`, `KNOWLEDGE_COLLECTION`, `CASE_COLLECTION` 추가 | 서버 모드 전환 |
| `backend/outputs/demo_cases/` | 10건 + summary.json 재생성 | 이전 8건은 RAG 실패 상태였음 |
| Qdrant 스토리지 | v1.17.1이 RocksDB → Gridstore 제자리 마이그레이션 | 원본 zip 별도 보관 권장 |
| `backend/scripts/run_demo_cases.py` (REJECT 후속) | `negative_no_cam` 1건 추가, `uncertainty_check` 한국어 질문, 원확률 범위와 4자리 반올림 후 음성 조건 적용, 실행 건수·설명 갱신 | 사용자 후속 승인. CAM 음성 후보가 없어 기존 그룹은 유지 (§5.1) |
| `backend/outputs/demo_cases/` (REJECT 후속) | 기존 10건 + #11 및 summary.json 재생성 | #11 gt=0 단일 소견 REJECT, 기존 10건 판정·신뢰도 불변 확인 |
| `backend/outputs/clean_reject_verification.json` | 사전 조사·대조·점수·분포·시간 기록 | 클로드 중단 이후 재검증의 로컬 근거 |
| `docs/DEMO_CASES_REPORT.md` | 11건 기준으로 갱신, #11 상세·질문 유형 차이·반올림 주의·검증 결과 추가 | §8-7 결손 및 §8-8 위음성 설명은 유지 |

`app/trust/` 및 임계값은 미변경. `app/schemas/` 미변경.

---

## 12. 미해결 / 후속

- **OPENAI_API_KEY 교체 미완료.** 노출된 기존 키로 실행했다. 폐기·재발급 후 `.env` 첫 줄 교체 필요.
- 논문에 CAUTION 예시로 #6을 쓸지 #5도 쓸지 결정 (§7.1 주의 참고).
- Case RAG를 환자 판독문/영상 임베딩으로 질의하도록 바꾸면 반대 증례 시나리오가 열린다 — 논문 범위 밖, 향후 과제로 기재.
- **단일 소견 REJECT 확보 완료:** #11 `negative_no_cam`, gt=0, s_pro=0.0879 / s_con=0.4049. 기존 `low_prob_with_cam`은 결손 시연으로 유지한다. 최초 지시서의 CAM 하한 변경안은 사전 조사 후 사용자 승인 대안으로 대체됐다 (§5.1).
