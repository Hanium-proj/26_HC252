# Chest AI Backend

실제 업로드·로컬 영상 모델·제공된 RAG 코퍼스·OpenAI 스트리밍을 연결한 FastAPI 서버다. 실행과 데이터 준비는 루트 [README](../README.md)를 따른다.

- `app/api/routes/studies.py`: 실제 검사 저장, 임상 정보 수정, 원본/마스크/CAM 전달
- `app/agents/live.py`: 실제 분석 실행, 영상 적합성 확인, 비교 영상 전달, 결과 저장
- `app/tools/vision/local_model.py`: 사전학습 DenseNet121 18개 소견 + 실제 Grad-CAM
- `app/tools/vision/segmentation.py`: PSPNet 폐·심장 분할과 픽셀 공간 측정
- `app/retrieval/local_corpus.py`: 실제 가이드라인 및 MIMIC 판독문 검색
- `app/retrieval/publications.py`: 선택적 Europe PMC 공개 논문 검색
- `app/api/routes/agent.py`: 실제 근거와 대화 이력으로 OpenAI SSE 답변 생성

기존 `app/schemas/`, `app/trust/`, `app/retrieval/knowledge_rag/`, `app/retrieval/case_rag/`의 계약·평가 로직도 유지한다. 새로운 실제 UI의 JSON 계약은 `schemas/live.py`, `frontend/lib/live/types.ts`, [LIVE_API.md](../docs/LIVE_API.md)에 정의한다. 보정되지 않은 모델 점수를 검증된 질병 확률이나 임상 신뢰도로 변환하지 않는다.

모든 검사·분석·검색 API는 `API_KEY`가 설정되면 키를 요구한다. 개발 환경 외에서는 키 미설정 요청을 거부한다. `.env`·원문·영상·인덱스는 Git에 올리지 않는다. 기본 서버는 단일 프로세스·로컬 사용자용이며 공유 운영을 위한 인증/테넌트 격리가 아니다.

```bash
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests
```
