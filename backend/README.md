# Chest AI Backend

FastAPI. Agent / Vision orchestration / RAG / Trust 파이프라인.

## 실행

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # 값 채우기
uvicorn app.main:app --reload --port 8000
```

http://localhost:8000/docs 에서 API 확인.

Python 3.11 고정(`.python-version`). 3.13+ 는 torch / pydantic-core 휠이 아직 없다.

## 구조

```
app/
  schemas/        [공통] A/B 계약. 변경은 합의 후 PR (docs/INTERFACE.md)
  agents/         [A] Planner, Gatekeeper, orchestration
  tools/vision/   [A] Classifier, Localizer, VQA, Quantifier, RunPod client
  retrieval/      [B] knowledge_rag/, case_rag/
  trust/          [B] scoring, resolver
  synthesis/      [공통] Qwen
  api/routes/     [공통] HTTP 계층 (얇게 유지)
  core/           설정
```

담당 경계는 `docs/TEAM.md`.

## 현재 상태

파이프라인이 end-to-end 로 동작한다. Gatekeeper → Planner → Vision tools →
Knowledge/Case RAG → Trust Resolver 를 거쳐 판정(ACCEPT / CAUTION / REJECT /
NEED_MORE_EVIDENCE)을 반환한다. 진입점은 `app/agents/pipeline.py`,
HTTP 는 `POST /agent/run` 과 `/agent/stream`(SSE).

**GPU 없이 돈다.** `app/tools/vision/_store.py` 가 학습 후 미리 산출해 둔
test split 예측과 CAM 정합성 지표를 읽는다. 실행 전 경로를 지정한다:

```bash
export GLASS_HANDOFF_DIR=/path/to/glass_agent_handoff_20260829
```

RAG 를 쓰려면 Qdrant 서버가 필요하다. **이미지는 v1.17.1 로 고정**하고
`.env` 에 `QDRANT_URL` 을 채운다(비우면 로컬 파일 모드라 적재에 41분 걸린다).
자세한 내용과 막히는 지점은 [docs/WHATS_CHANGED.md](../docs/WHATS_CHANGED.md).

미구현으로 남긴 것(의도적): `tools/vision/vqa.py`, `quantifier.py`,
`synthesis/qwen.py`, `runpod_client.py`. 호출되면 근거 결손으로 처리되어
Trust 판정에 그대로 반영된다.

## 검사

```bash
pytest       # 계약 회귀 테스트
ruff check app tests
```

`tests/test_schemas.py` 는 A/B 계약이 깨졌는지 잡는 테스트다. 실패하면 상대 담당자에게 알린다.

## 시크릿

`.env` 에만 둔다. 코드에서는 `app/core/config.py` 의 `get_settings()` 를 통해서만 접근한다.
`.env` 는 `.gitignore` 에 있다.
