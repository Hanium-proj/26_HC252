# 역할 분담

2인 체제. 개수를 2:2로 자르지 않고 **앞단 추론 / 뒷단 검증**으로 나눴다.

## A - Agent & Vision Pipeline

| 항목 | 위치 |
|---|---|
| Query & Evidence Planner | `backend/app/agents/planner.py` |
| Gatekeeper | `backend/app/agents/gatekeeper.py` |
| Tool orchestration | `backend/app/agents/orchestrator.py` |
| Classifier / Localizer(CAM) / VQA / Quantifier | `backend/app/tools/vision/` |
| RunPod 클라이언트 | `backend/app/tools/vision/runpod_client.py` |
| API | `backend/app/api/routes/analyze.py` |

산출물: **EvidencePacket**

Planner와 vision tool을 묶은 이유는 Planner가 곧 tool 호출 순서를 결정하기 때문이다.
"이 질문이면 classifier를 부르고, 위치가 필요하면 CAM+VQA를 부른다"는 판단이
Planner 안에 있어서, 따로 떼면 한 사람이 두 파일을 왕복해야 한다.

## B - Retrieval & Trust Pipeline

| 항목 | 위치 |
|---|---|
| Knowledge RAG (수집 -> 파싱 -> chunk -> embed -> index -> search) | `backend/app/retrieval/knowledge_rag/` |
| Case-RAG | `backend/app/retrieval/case_rag/` |
| 도구별 신뢰도 | `backend/app/trust/scoring.py` |
| 충돌 해결 | `backend/app/trust/resolver.py` |
| API | `backend/app/api/routes/literature.py` |

산출물: **FinalEvidence** (ACCEPT / CAUTION / NEED_MORE_EVIDENCE)

RAG와 Trust를 묶은 이유는 둘 다 "근거를 평가하고 검증하는 쪽"이기 때문이다.

## 공통

- `backend/app/schemas/` - 계약. 변경은 반드시 합의 후 PR
- `backend/app/synthesis/qwen.py` - 최종 답변 생성
- `backend/app/api/routes/agent.py` - 통합 스트리밍 엔드포인트
- `frontend/` - 이미 목업 완성. 실 API 연동 시 나눠서

## 작업 규칙

- 브랜치: `<type>/<issue-number>-<short-desc>` (예: `feat/3-query-planner`)
- 상대 담당 디렉토리를 수정해야 하면 먼저 이슈로 올린다
- `schemas/` 변경 PR은 두 사람 모두 리뷰
