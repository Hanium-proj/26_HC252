# Chest AI · 실제 모델과 RAG를 연결한 로컬 연구 작업 공간

2026 한이음 흉부 X-ray 진단 지원 프로젝트. 가상 환자·고정 분석 결과·대본 답변을 제거하고, 실제 업로드 영상과 실제 검색 근거로 동작한다. **연구용이며 진단 정확도·운영 임계값·임상 효용 검증은 아직 수행하지 않았다.**

## 실행

필요 환경: Python 3.11, Node.js 20.9 이상. 현재 프론트는 Next.js 16 / React 19, 백엔드는 FastAPI다.

```bash
# backend
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env  # OPENAI_API_KEY와 임의의 API_KEY를 설정

# frontend
cd ../frontend
npm ci
cp .env.example .env.local  # BACKEND_API_KEY를 backend API_KEY와 동일하게 설정
```

키를 이미 설정했다면 `.env`를 덮어쓰지 않는다. OpenAI 키는 백엔드 `.env`에만 둔다. 프론트에는 OpenAI 키가 필요하지 않다.

저장소 루트에서 두 서버 실행:

```bash
./scripts/run-local.sh
# UI: http://127.0.0.1:3001  / API docs: http://127.0.0.1:8000/docs
```

포트는 `FRONTEND_PORT`, `BACKEND_PORT`로 변경할 수 있다. 두 서버는 기본적으로 loopback에만 바인딩된다. `frontend/.env.local`의 `ALLOW_LOCAL_WORKSPACE=true`는 로컬 production build 확인용이며, 공개 배포 승인을 뜻하지 않는다. 현재 단일 사용자 로컬 작업 공간이다. 다중 사용자 배포에는 로그인·사용자별 데이터 격리·접근 관리가 별도로 필요하다.

## 실제 동작

1. 대시보드에서 PNG/JPEG/단일 프레임 흑백 DICOM 업로드(최대 15MB). 파일명에서 환자 정보를 생성하지 않는다.
2. 임상 메모와 익명 환자 식별자를 입력하고, 같은 식별자가 등록된 실제 이전 영상만 비교 대상으로 선택해 분석 실행. 입력이 바뀌면 이전 결과를 무효화한다.
3. DenseNet121 사전학습 가중치로 18개 소견의 **보정되지 않은 sigmoid 점수**와 해당 영상의 실제 Grad-CAM을 계산한다.
4. PSPNet으로 폐·심장 해부학적 분할을 계산한다. 마스크 픽셀 비율과 폭 비율은 임상 CTR·물리적 mm 측정·병변 분할이 아니다.
5. OpenAI 영상 모델이 실제 영상과 입력된 메모로 구조화 설명을 생성한다. 비교 영상이 없으면 비교 결과를 만들지 않는다.
6. 문헌 검색은 제공된 가이드라인 청크의 dense/BM25 검색과 질환 메타데이터를 사용한다. 실제 페이지·청크·원문 링크를 표시한다.
7. 유사 증례는 로컬 MIMIC 판독문에서 FTS5 후보 검색 후 의미 재정렬한다. 영상 유사도가 아니며, 환자 진단을 확정하는 근거로 취급하지 않는다.
8. 에이전트는 실제 분석·검색 근거와 대화 이력을 받아 OpenAI 답변을 SSE로 스트리밍한다. 실패·중단을 완료로 표시하지 않는다.

기존 팀 ViT/RunPod/Qwen 가중치·서버 정보는 전달되지 않아 현재 영상 엔진은 공개 사전학습 DenseNet121/PSPNet과 OpenAI다. `runpod_client.py`는 선택적 HTTP 어댑터이며, 원래 팀 서버의 입출력 계약 확인 없이 연결된 것으로 표시하지 않는다.

모델 첫 실행 시 TorchXRayVision 공식 릴리스에서 가중치를 다운로드한다. 이후 `~/.torchxrayvision/` 캐시를 사용한다. API 사용은 실제 OpenAI 비용이 발생한다. `VISION_MODEL`, `CHAT_MODEL`로 모델을 변경할 수 있다.

## 제공 데이터 색인 구축

현재 제공된 파일: `knowledge_chunks.json`, `Knowledge_RAG_v1 (1).zip`, `MIMIC_CXR_Similar_Case_RAG_v1 (1).zip`.

```bash
cd backend
.venv/bin/python scripts/prepare_local_rag.py ../knowledge_chunks.json
.venv/bin/python scripts/prepare_case_rag.py \
  '../MIMIC_CXR_Similar_Case_RAG_v1 (1).zip' \
  ../../dataset-meta/mimic-cxr-2.0.0-chexpert.csv
```

문헌 임베딩은 배치별로 저장해 재실행 시 재사용한다. 완료 전 파일을 운영 색인으로 공개하지 않는다. PDF 원본은 별도 보관하며 청크의 `source_url`, `page`, `doc_id`로 출처를 추적한다. 현재 코퍼스는 **17문서/772청크**, 판독문은 **227,835건**이다.

`backend/data/`와 입력 압축파일은 Git에서 제외된다. MIMIC 원문·라벨·인덱스는 접근 권한이 있는 환경에서만 사용한다. 로컬 MIMIC 유사 판독문 검색 시 선택된 후보 판독문이 OpenAI 임베딩 API로 전송된다. 익명 환자 식별자는 검사 연결용으로 로컬에만 보관한다. 영상 분석 시 영상과 임상 메모도 OpenAI로 전송된다. 해당 데이터의 이용 조건과 기관의 처리 정책을 충족하는 환경에서만 사용해야 한다.

## 검사와 평가

```bash
cd backend
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests
.venv/bin/python scripts/eval_live_retrieval.py
.venv/bin/python scripts/benchmark_live.py --url http://127.0.0.1:3001

cd ../frontend
npm run lint
npm run typecheck
npm run build
npm audit
```

검색 평가는 기존 8개 질문을 한국어·영어로 측정하는 작은 개발 회귀 세트다. 임상 진단 정확도나 독립 검색 성능을 입증하지 않는다. 실제 독립 정답 영상이 준비되면 `scripts/eval_classifier_manifest.py`로 AUROC/AP/민감도/특이도와 추론 시간을 측정할 수 있다. 모델 학습 데이터와 평가 데이터의 환자 중복 여부를 먼저 확인해야 한다.

자세한 실행 검증 결과와 한계는 [docs/LIVE_VERIFICATION.md](docs/LIVE_VERIFICATION.md)를 참고한다.

## 팀 브랜치 통합

`feat/agent-a4-trust-v2`의 사전 예측 재생 파이프라인도 main에 포함됩니다.
실시간 업로드 분석은 기존 `/analyze`, `/agent/stream`을 사용하며, 사전 산출물 평가는
`/agent/replay/run`, `/agent/replay/stream`을 사용합니다. `/agent/run`은 재생 API의 호환 별칭입니다.
재생 모듈은 `app/agents/replay/`, 공통 진입점은 `app/agents/pipeline.py`에 있습니다.
팀의 예측 CSV/CAM 파일과 `GLASS_HANDOFF_DIR` 설정이 필요하며, 없으면 API가 503으로 알립니다.
기존 논문 사례 보고서는 당시 실행 결과이며, 현재 코드에서 재생성한 수치가 아닙니다.
