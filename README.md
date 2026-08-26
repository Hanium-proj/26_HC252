# 26_HC252 - Chest AI

흉부 X-ray + 임상정보 기반 폐 질환 진단 지원 서비스.
2026 한이음 드림업.

## 구조

```
frontend/   Next.js 14 (App Router) - Vercel 배포
backend/    FastAPI - Railway 배포
docs/       아키텍처 / 인터페이스 계약 / 역할 분담
```

모델(ViT classifier, CAM, VQA, Qwen)은 RunPod에서 GPU 서빙하고
backend가 HTTP로 호출한다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 배포 구성, 파이프라인 전체 흐름, 기술 선택 근거 |
| [docs/INTERFACE.md](docs/INTERFACE.md) | A/B 담당자 간 계약. **개발 시작 전 필독** |
| [docs/TEAM.md](docs/TEAM.md) | 역할 분담과 담당 디렉토리 |

## 시작하기

```bash
# frontend
cd frontend && npm install && npm run dev        # localhost:3000

# backend
cd backend && python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000        # localhost:8000/docs
```

## 파이프라인

```
User Query
   -> [A] Query & Evidence Planner
   -> [A] Vision Tools (Classifier / CAM / VQA / Quantifier)
   -> EvidencePacket
   -> [B] Knowledge RAG + Case-RAG
   -> [B] Trust & Conflict Resolver
   -> FinalEvidence (ACCEPT / CAUTION / NEED_MORE_EVIDENCE)
   -> Qwen Synthesis
   -> Final Answer
```

## 현재 상태

- frontend: 5개 화면 목업 완성 (대시보드 / 분류 / 근거 / 에이전트 / 문헌)
- backend: 스켈레톤. 계약(`app/schemas/`)과 `/health` 만 동작
