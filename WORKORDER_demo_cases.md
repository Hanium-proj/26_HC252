# 작업 지시서 — 논문 §4 실행 사례 생성

**대상:** Claude Code / Codex
**작업 위치:** 이 저장소의 `backend/`
**목표:** end-to-end 파이프라인을 실행해 **서로 다른 4종 판정**(ACCEPT / REJECT / CAUTION / NEED_MORE_EVIDENCE)이 나오는 사례를 만들고, 논문 표에 넣을 결과를 출력한다.

---

## 0. 먼저 — API 키 교체 (필수)

기존 `OPENAI_API_KEY`가 화면 캡처로 노출되었다. 반드시 먼저 처리할 것.

1. `platform.openai.com` → API keys → 기존 키 **Revoke**
2. 새 키 발급
3. `backend/.env` 파일을 **에디터로 열어서** 직접 수정 (터미널에 키를 타이핑하지 말 것)
4. Billing → Usage limits에 월 한도 설정 권장

`.env`는 `.gitignore`에 포함되어 있으므로 커밋되지 않는다. 절대 커밋하지 말 것.

---

## 1. 배경

### 이미 확인된 사실

```
knowledge_guidelines_reviews   772 points    (3072d, Cosine)
radiology_cases            227,759 points    (3072d, Cosine)
```

- 분류기 예측은 사전 산출본을 읽는다. **GPU 불필요, 재추론 불필요.**
- Knowledge RAG 검색은 동작 확인 완료.
- 파이프라인 end-to-end 동작 확인 완료(ACCEPT / REJECT / NEED_MORE_EVIDENCE 재현).
- **아직 안 나온 것: CAUTION.** 지지·반대 근거가 동시에 강해야 발동하는데,
  영상 근거만으로는 충돌 상대가 없었다. Case RAG가 붙으면 나올 것으로 예상된다.

### 성능 문제

`QdrantClient(path="data/qdrant")` 로컬 파일 모드는 순수 Python 구현이라
227,759 × 3072 벡터를 전부 RAM에 적재한다. **컬렉션 로딩에만 약 41분**이 걸린다.
프로세스를 띄울 때마다 반복되므로 반복 실행에 부적합하다.

→ **Qdrant 서버(Docker)로 전환한다.** Rust 구현 + HNSW 인덱스라 기동 수 초, 질의 수 ms.

---

## 2. 환경 구성

### 2-1. Qdrant 서버 기동

서버용 스토리지가 **이미 압축 해제되어 있다** (별도 변환 불필요):

```
C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\DATA\qdrant_server\qdrant_server
```

구조: `collections/knowledge_guidelines_reviews`, `collections/radiology_cases`, `aliases/`, `raft_state.json`

```powershell
docker run -d --name qdrant-hanium -p 6333:6333 `
  -v "C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\DATA\qdrant_server\qdrant_server:/qdrant/storage" `
  qdrant/qdrant
```

기동 확인:

```powershell
curl http://localhost:6333/collections
```

`knowledge_guidelines_reviews`, `radiology_cases` 둘 다 보여야 한다.
각 컬렉션의 포인트 수도 확인:

```powershell
curl http://localhost:6333/collections/radiology_cases
```

> **버전 불일치 시:** 스토리지를 만든 Qdrant 버전과 이미지 버전이 다르면 기동에 실패할 수 있다.
> 로그(`docker logs qdrant-hanium`)에 버전 오류가 보이면 `qdrant/qdrant:v1.12.0` 등 구버전 이미지로 재시도.
> 그래도 안 되면 **3-B(로컬 파일 모드)** 로 진행한다.

### 2-2. `.env`

`backend/.env` (에디터로 직접 편집):

```
OPENAI_API_KEY=<새로 발급한 키>
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIM=3072
KNOWLEDGE_COLLECTION=knowledge_guidelines_reviews
CASE_COLLECTION=radiology_cases
QDRANT_URL=http://localhost:6333
```

`QDRANT_URL`이 비어 있으면 로컬 파일 모드(`qdrant_path`)로 동작한다. 서버를 쓰려면 반드시 채울 것.

### 2-3. 분류기 산출물 경로

```powershell
$env:GLASS_HANDOFF_DIR="C:\Users\byung\OneDrive\바탕 화면\병건\3-2\한이음\glass_agent_handoff_20260829\glass_agent_handoff_20260829"
```

이 폴더에 `predictions/test_image_predictions.csv`(26,489행)와
`reports/grounding_A3_final_cnn.json`(CAM 70건)이 있어야 한다.

---

## 3. 실행

### 3-A. 서버 모드 (권장)

```powershell
cd backend
python -m scripts.run_demo_cases --per-group 2
```

### 3-B. 로컬 파일 모드 (Docker 실패 시)

`.env`에서 `QDRANT_URL` 줄을 지우고 동일 명령 실행. **41분 이상 소요됨.**

### 출력 위치

```
backend/outputs/demo_cases/case_NN_<group>.json    사례별 전체 기록
backend/outputs/demo_cases/summary.json            요약
```

콘솔에도 표가 출력된다.

---

## 4. 확인할 것

### 4-1. 판정 분포

```
#  group               finding          prob  gt  판정
1  high_prob_with_cam  Pneumothorax    0.958   1  ACCEPT
...
```

**CAUTION이 한 건이라도 나오는지**가 이번 작업의 핵심이다.

### 4-2. CAUTION이 안 나오면 — 원인 진단

Case 근거가 반대편에 서려면 `agreement_ratio < 0.5`여야 한다
(`app/trust/normalize.py`의 `_verdict`, `POSITIVE_THRESHOLD = 0.5`).

다음을 확인해 원인을 특정할 것:

```python
# backend 에서 실행
import asyncio
from app.retrieval.case_rag import search as cs
items = asyncio.run(cs.search("Pneumothorax", "chest radiograph with Pneumothorax", top_k=8))
for it in items:
    print(it.metadata["agreement_ratio"], it.metadata["n_cases"], it.metadata["mean_similarity"])
```

- **Case 근거가 0건** → 검색 자체가 실패. 컬렉션명/차원/URL 확인
- **agreement_ratio가 항상 높음** → 유사 사례가 전부 같은 소견. 충돌이 구조적으로 안 생김
  → 이 경우 **분류기 확률은 높은데 유사 사례 일치율은 낮은 조합**을 찾아야 한다.
    `scripts/run_demo_cases.py`의 `pick_cases()`에 그런 후보를 탐색하는 그룹을 추가할 것.
- **충돌 판정은 되는데 verdict가 CAUTION이 아님** → `app/trust/resolver.py`의
  `CONFLICT_RATIO = 0.5` 기준 확인

> **주의:** CAUTION을 억지로 만들기 위해 임계값을 조작하지 말 것.
> 실제 데이터에서 안 나오면 "안 나왔다"가 결과다. 그 경우 논문에는 3종만 싣고
> 한계 절에 사유를 기재한다.

### 4-3. 논문에 넣을 값

다음을 정리해서 보고할 것:

| 항목 | 용도 |
|---|---|
| 판정별 사례 표 (조건 / 소견 / 확률 / 판정) | 논문 표 4 |
| CAUTION 사례의 지지·반대 근거 구성 | 논문 §4 본문 |
| `radiology_cases` 실제 포인트 수 | 논문 §3.2 (227,759 확인) |
| Knowledge RAG citation 예시 1건 (문헌명·기관·연도·페이지) | 논문 §3.2 |

---

## 5. 하지 말 것

- `app/trust/` 아래 파일 수정 금지 (판정 로직은 확정본)
- 임계값(`ACCEPT_THRESHOLD`, `CONFLICT_RATIO`, `POSITIVE_THRESHOLD`) 조작 금지
- 기존 테스트를 깨뜨리는 변경 금지 — 작업 후 `python -m pytest tests/ -q` 통과 확인
- `.env`, `data/` 커밋 금지

## 6. 작업 후 보고 형식

```
[환경]
 Qdrant 모드: 서버 / 로컬
 radiology_cases points: N
 소요 시간: N분

[결과]
 (콘솔 표 그대로 붙여넣기)

[CAUTION]
 발생 여부: Y / N
 발생했다면: 어느 사례에서, 지지 근거 X건(신뢰도 A) 대 반대 근거 Y건(신뢰도 B)
 안 났다면: 4-2 진단 결과

[테스트]
 pytest 결과
```
