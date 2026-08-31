# RAG 셋업 가이드

담당 A(Agent & Vision)가 Knowledge RAG / Case RAG를 로컬에서 동일하게 구동하기 위한 절차.

소요: Knowledge RAG 약 5분, Case RAG 약 40분(대부분 대기)

---

## 0. 사전 준비

| 항목 | 필요 여부 | 비고 |
|---|---|---|
| Python 3.11 | 필수 | 3.13 이상은 torch 휠이 없음 |
| Docker Desktop | 필수 | Qdrant 컨테이너 구동 |
| OpenAI API 키 | 필수 | 별도 전달. 저장소에 없음 |
| Knowledge PDF 17건 | 필수 | 공유 Drive `Knowledge_RAG_v1` |
| MIMIC-CXR 데이터 | Case RAG만 | PhysioNet 개인 승인 필요 |

**API 키는 메신저나 이슈에 붙이지 않는다.** 비밀번호 관리자나 1회용 링크로 전달한다.

---

## 1. 저장소와 의존성

```bash
git clone https://github.com/Hanium-proj/26_HC252.git
cd 26_HC252/backend

python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`sentence-transformers`가 torch를 끌어와 설치가 수 분 걸린다.

---

## 2. 환경 변수

```bash
cp .env.example .env
```

`.env`에 최소 다음 두 개를 채운다.

```
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
```

`.env`는 `.gitignore`에 있다. 절대 커밋하지 않는다.

---

## 3. Qdrant 실행

```bash
cd backend
docker compose up -d
curl http://localhost:6333/healthz     # 응답 있으면 정상
```

웹 UI는 http://localhost:6333/dashboard 에서 볼 수 있다.

---

## 4. Knowledge RAG 구축

Drive의 `Knowledge_RAG_v1` 폴더를 통째로 아래 경로에 둔다.

```
backend/data/knowledge_rag_v1/
├── 01_Knowledge_PDF/
└── 02_Metadata/sources.csv
```

```bash
python scripts/build_knowledge_index.py
```

정상 출력:

```
문서 17개, 페이지 647쪽
chunk 772개 (참고문헌 127개 제외), 537,905 토큰
772개 저장 · 컬렉션 count=772
```

임베딩 비용 약 0.07 USD, 소요 20초 내외.

---

## 5. Case RAG 구축 (선택)

**PhysioNet credentialed 승인자만.** 원본과 인덱스 모두 저장소에 올리지 않는다.

필요 파일:

```
MIMIC_CXR_Similar_Case_RAG_v1/
├── mimic-cxr-reports.zip
└── cxr-study-list.csv.gz
cxr/labels.csv
```

**5-1. 판독문 압축 해제**

```bash
mkdir -p data/mimic_cxr
unzip -q <경로>/mimic-cxr-reports.zip -d data/mimic_cxr/reports
```

**5-2. 공식 섹션 파서**

```bash
git clone --depth 1 https://github.com/MIT-LCP/mimic-cxr.git /tmp/mimic-cxr
mkdir -p data/mimic_cxr/sections
cd /tmp/mimic-cxr/txt
python create_section_files.py \
  --reports_path <절대경로>/backend/data/mimic_cxr/reports/files \
  --output_path  <절대경로>/backend/data/mimic_cxr/sections \
  --no_split
cd -
```

`mimic_cxr_sectioned.csv`가 **227,781행**이면 정상이다.

**5-3. 색인**

```bash
python scripts/build_case_index.py \
  --sections data/mimic_cxr/sections/mimic_cxr_sectioned.csv \
  --labels <경로>/cxr/labels.csv \
  --study-list <경로>/cxr-study-list.csv.gz
```

227,759건 색인, 약 16분, 임베딩 비용 약 2.6 USD.

파이프라인만 확인하려면 `--split validate`를 붙인다 (2,991건, 1분 내외).

---

## 6. API 실행

```bash
uvicorn app.main:app --reload --port 8000
```

http://localhost:8000/docs 에서 전체 API를 확인할 수 있다.

---

## 7. 사용법

### 문헌 검색

```bash
curl "http://localhost:8000/literature/search?q=기흉을 시사하는 영상 소견은&top_k=5"
```

**한국어로 물어도 된다.** 내부에서 영문 번역 후 검색한다. 번역을 빼면
Hit@8이 1.000에서 0.750으로 떨어진다.

응답:

```json
[{
  "score": 0.0164,
  "quality": 0.68,
  "text": "...",
  "citation": {
    "doc_id": "RV007", "title": "Pleural imaging",
    "organization": "PMC / peer-reviewed", "year": 2024,
    "page": 7, "source_url": "https://..."
  }
}]
```

파라미터

| 이름 | 기본값 | 설명 |
|---|---|---|
| `q` | 필수 | 질의. 한국어 가능 |
| `top_k` | 5 | 1~20 |
| `coverage` | 없음 | observation으로 범위 제한 |
| `bm25` | false | 평가상 성능 하락하여 기본 비활성 |
| `rerank` | false | 동일 사유 |

### 증례 검색

```bash
curl "http://localhost:8000/cases/search?q=Right apical pneumothorax&top_k=10&claim=Pneumothorax"
```

응답:

```json
{
  "n_cases": 10,
  "agreement_ratio": 0.9,
  "quality": 0.5,
  "mean_similarity": 0.78,
  "hits": [{"case_id": "s50414267", "text": "...", "positive_findings": ["Pneumothorax"]}]
}
```

**`agreement_ratio`가 핵심이다.** 개별 사례가 아니라 집계가 근거이기 때문이다.
환자 1인의 소견은 근거가 될 수 없고, "유사 사례 10건 중 9건에서 관찰됨"이 근거다.

`claim`에 observation 이름을 넣어야 이 값이 계산된다.

### Python에서 직접 호출

API를 거치지 않고 모듈을 쓸 수도 있다.

```python
from app.retrieval.knowledge_rag.search import search       # EvidenceItem 반환
from app.retrieval.case_rag.search import search as case_search
from app.retrieval.crag import crag_search                   # 충분성 평가 포함

items = await search(claim="pleural_effusion", query="흉수의 원인은?")
```

`search()`는 `EvidenceItem`을 반환하므로 Evidence Packet에 그대로 넣을 수 있다.

---

## 8. 확인

```bash
pytest                                  # 45개 통과해야 함
python scripts/eval_retrieval.py        # Knowledge RAG 품질
python scripts/eval_case_retrieval.py   # Case RAG 품질
python scripts/eval_phase2.py           # 단계별 기여도
```

기대값

| 항목 | 값 |
|---|---|
| Knowledge RAG 한국어 Hit@8 | 1.000 |
| Knowledge RAG 영어 Hit@8 | 1.000 |
| Case RAG 평균 일치율 | 73.8% (기저 대비 13.6배) |

---

## 9. 자주 막히는 곳

**`pydantic-core` 빌드 실패**
Python 3.13 이상이다. 3.11로 가상환경을 다시 만든다.

**`BM25 인덱스 원본이 없다`**
`build_knowledge_index.py`를 먼저 실행한다. `data/knowledge_chunks.json`을 생성한다.

**검색이 10분 넘게 걸림**
`QDRANT_URL`이 비어 로컬 파일 모드로 동작 중이다. 22만 건 규모에서는 사용할 수 없다.
`.env`에 `QDRANT_URL=http://localhost:6333`을 넣고 Docker 컨테이너를 확인한다.

**429 rate limit**
OpenAI 계정 등급의 분당 토큰 한도다. 코드가 헤더 기반으로 속도를 조절하지만
한도가 낮으면 오래 걸린다. Case RAG는 한도가 낮을 경우 몇 시간이 걸릴 수 있다.

**`sources.csv에 있으나 PDF가 없음`**
Drive에서 PDF 17건을 모두 받았는지 확인한다. 파일명이 정확히 일치해야 한다.

---

## 10. 데이터 취급

- MIMIC-CXR / MIMIC-IV-ED는 PhysioNet credentialed 데이터다. 재배포가 금지된다.
- 원본, 파생 인덱스, 임베딩 캐시 모두 저장소에 올리지 않는다. `.gitignore`에 등록되어 있다.
- 배포 시 `.env`에 `API_KEY`를 설정한다. `/cases`에 헤더 검사가 걸린다.

```bash
curl -H "X-API-Key: <키>" "http://.../cases/search?q=..."
```

- 인덱스를 이미지에 굽지 않는다. 이미지 배포가 곧 데이터 재배포가 된다.
