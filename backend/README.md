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

스켈레톤이다. `/health` 만 동작하고 나머지 라우트는 501을 반환한다.
각 모듈은 시그니처와 docstring만 있고 `NotImplementedError` 를 던진다.
docstring에 구현 시 주의할 점을 적어 뒀다.

## 검사

```bash
pytest       # 계약 회귀 테스트
ruff check app tests
```

`tests/test_schemas.py` 는 A/B 계약이 깨졌는지 잡는 테스트다. 실패하면 상대 담당자에게 알린다.

## 시크릿

`.env` 에만 둔다. 코드에서는 `app/core/config.py` 의 `get_settings()` 를 통해서만 접근한다.
`.env` 는 `.gitignore` 에 있다.
