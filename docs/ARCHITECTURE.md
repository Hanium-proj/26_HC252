> 2026-10-25 현재 실제 로컬 실행 구성은 [README](../README.md)와 [LIVE_API](LIVE_API.md)를 우선 참고합니다. 아래 문서는 기존 팀 배포 구상·EvidencePacket 계약이며, 원래 RunPod 모델이 연결되었다는 의미가 아닙니다.

# 아키텍처

## 배포 구성

```
[Vercel]  frontend/  Next.js 14
    |  HTTP / SSE
    v
[Railway] backend/   FastAPI (CPU)
    |  HTTP
    v
[RunPod]  모델 서버 (GPU) - ViT classifier / CAM / VQA / Qwen
```

역할 분리 이유:
- 모델 추론만 GPU가 필요하다. 오케스트레이션·RAG 검색·Trust 계산은 CPU로 충분하다.
  GPU 인스턴스에 API 서버까지 올리면 비용이 상시로 나간다.
- Railway 백엔드는 상시 가동, RunPod은 요청이 있을 때만 깨우는 구조를 기본으로 한다.
- 프론트는 백엔드 URL을 직접 노출하지 않고 Next Route Handler를 얇은 프록시(BFF)로 둔다.

## 백엔드를 Python으로 택한 이유

1. RAG 파이프라인의 모든 단계가 Python 생태계다.
   MedCPT(transformers), BM25(rank_bm25), cross-encoder reranking(sentence-transformers),
   PubMed 수집(biopython Entrez). Node에는 동등한 대체재가 없다.
2. LangGraph는 Python이 원본이고 JS 포팅판은 기능이 뒤처진다.
3. RunPod 모델 서버가 torch 기반이라 전처리·스키마 코드를 백엔드와 공유할 수 있다.

Next.js의 API Route는 비즈니스 로직을 담지 않는다. 인증 세션 처리와 SSE 중계만 맡는다.

## 파이프라인

```
User Query
   |
   v
[A] Query & Evidence Planner        agents/planner.py
   |  QueryPlan (query_type, required_evidence, tool_order)
   v
[A] Gatekeeper                      agents/gatekeeper.py
   |
   v
[A] Vision Tools                    tools/vision/
     Classifier -> Localizer(CAM) -> VQA -> Quantifier
   |
   v
    EvidencePacket  <-- A와 B의 유일한 접점. schemas/evidence.py
   |
   v
[B] Knowledge RAG + Case-RAG        retrieval/
   |
   v
[B] Trust & Conflict Resolver       trust/resolver.py
   |  FinalEvidence (ACCEPT / CAUTION / NEED_MORE_EVIDENCE)
   v
[공통] Qwen Synthesis                synthesis/qwen.py
   |
   v
Final Answer
```

## 담당 경계

| 담당 | 영역 | 디렉토리 |
|---|---|---|
| A | Agent & Vision Pipeline | `backend/app/agents/`, `backend/app/tools/` |
| B | Retrieval & Trust Pipeline | `backend/app/retrieval/`, `backend/app/trust/` |
| 공통 | 계약 / API / 합성 | `backend/app/schemas/`, `backend/app/api/`, `backend/app/synthesis/` |

A는 `retrieval/`과 `trust/`를 열어볼 필요가 없고, B는 `agents/`와 `tools/`를 몰라도 된다.
접점은 `schemas/`뿐이다.

## 결정 대기 항목

- 벡터 DB 선택: pgvector(Railway Postgres에 얹기) vs Qdrant vs FAISS 로컬
- 영상 저장소: 업로드 원본을 어디에 둘지 (S3 / R2 / Railway 볼륨)
- 인증: 데모 범위에서 필요한지, 필요하다면 Next 세션 기반인지
