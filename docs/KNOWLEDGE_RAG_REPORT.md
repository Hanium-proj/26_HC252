# Knowledge RAG 구축 보고서

흉부 X-ray 진단 지원 에이전트 · Retrieval & Trust Pipeline
작성일 2026-08-30

---

## 1. 개요

Knowledge RAG는 영상 모델이 산출한 소견에 **외부 임상 근거를 결합**하는 구성요소다.
Vision 파이프라인이 "이 환자의 영상에서 흉수가 보인다"를 판정한다면,
Knowledge RAG는 "흉수가 보일 때 어떤 원인을 고려해야 하는가"에 대한
공신력 있는 문헌 근거와 출처를 제공한다.

담당 역할:

- 영상 소견의 임상적 의미 제공
- 감별진단 참고 근거 제공
- 추가 검사·확인사항 안내
- 근거 문헌 및 출처(citation) 반환

산출물은 `EvidenceItem(kind=LITERATURE)` 형태로 정규화되어
Trust & Conflict Resolver의 입력이 된다.

---

## 2. 코퍼스 구성

### 2.1 문헌 목록

공식 진료지침 8건과 영상의학 리뷰 9건, 총 17건으로 구성했다.

| 구분 | 건수 | 발행 기관 |
|---|---|---|
| Guideline | 8 | ACR, ATS/IDSA, British Thoracic Society, WHO |
| Review | 9 | PMC 등재 peer-reviewed |
| 합계 | 17 | |

발행 연도는 2009~2025년, 중앙값 2020년이다. 2건은 개정 이력 문서로 연도 미상이다.

### 2.2 코퍼스 규모

| 항목 | 값 |
|---|---|
| 문서 수 | 17 |
| 총 페이지 | 647 |
| 총 토큰 | 537,059 |
| 최소/최대 문서 | 7,751 토큰 (ACR Rib Fractures) / 115,772 토큰 (Imaging the Chest) |

전 문서가 텍스트 레이어를 보유하여 OCR 없이 추출 가능함을 사전 확인했다.
페이지당 평균 추출 문자 수는 1,495~6,001자 범위로, 스캔 이미지 기반 문서는 없다.

### 2.3 관측 소견 커버리지

영상 모델의 14개 observation(CheXpert 라벨 체계) 대비 문헌 커버리지를 측정했다.
매핑 근거는 `sources.csv`의 `target_coverage` 필드다.

| Observation | 문서 수 | Chunk 수 |
|---|---:|---:|
| Lung Opacity | 8 | 548 |
| Consolidation | 7 | 531 |
| Pleural Effusion | 5 | 126 |
| Edema | 4 | 234 |
| Lung Lesion | 4 | 276 |
| Pneumonia | 4 | 107 |
| Pneumothorax | 4 | 139 |
| Cardiomegaly | 3 | 223 |
| Pleural Other | 3 | 96 |
| Atelectasis | 2 | 204 |
| Support Devices | 1 | 38 |
| Enlarged Cardiomediastinum | 1 | 20 |
| Fracture | 1 | 10 |
| No Finding | 0 | 0 |

**커버리지 13/14.** `No Finding`은 소견의 부재를 뜻하는 라벨로 대응 문헌이
존재하지 않는 것이 정상이다.

다만 다음 세 항목은 근거 밀도가 낮아 **2차 문헌 보완이 필요한 영역**으로 식별했다.

- `Fracture` — 10 chunk (ACR Rib Fractures 단일 문서)
- `Enlarged Cardiomediastinum` — 20 chunk (ACR Mediastinal Masses 단일 문서)
- `Support Devices` — 38 chunk (PMC Chest X-ray Devices 단일 문서)

단일 문서에만 의존하는 소견은 해당 문서에서 검색이 실패할 경우
대체 근거가 없다는 위험이 있다.

---

## 3. 파이프라인 설계

```
PDF (17건)
  → 텍스트 추출 + 서지 메타 결합      parse.py
  → 토큰 기준 chunking + 메타 부착     chunk.py
  → 임베딩                            embed.py
  → 벡터 인덱스                       index.py
  → 검색 + citation 생성              search.py
  → EvidenceItem(kind=LITERATURE)
```

오프라인 배치(parse~index)와 온라인 질의(search)를 분리했다. 실행 주기가 다르고,
배치는 API 서버와 독립적으로 재실행되어야 하기 때문이다.

### 3.1 텍스트 추출

페이지 단위로 추출하며 페이지 번호를 보존한다.

**페이지 번호를 보존한 이유:** citation이 "어느 문서 몇 쪽"까지 가리켜야
사용자가 원문에서 근거를 직접 확인할 수 있다. 문서 단위 인용만으로는
184쪽 분량의 WHO 결핵 진단 지침에서 해당 근거를 찾을 수 없다.

추출 텍스트에 대해 다음을 정규화했다.

- **하이픈 분철 복원** — `pneumo-\nthorax` → `pneumothorax`.
  미처리 시 해당 용어가 검색에서 영구히 누락된다.
- **단일 개행의 공백 치환** — PDF 개행은 시각적 줄바꿈이며 문장 경계가 아니다.
- **문단 경계 보존** — 연속 개행 2회 이상은 유지.

50자 미만 페이지(표지, 그림 전용 면)는 제외했다.

### 3.2 Chunking

| 파라미터 | 값 |
|---|---|
| Chunk 크기 | 700 토큰 |
| Overlap | 100 토큰 |
| 토크나이저 | cl100k_base |

페이지 경계를 넘어 chunk를 생성하되, 각 chunk의 시작 페이지를 기록한다.
페이지마다 절단하면 문단이 중간에서 끊긴 chunk가 대량 발생하기 때문이다.

**참고문헌 구간 제거.** 서지 나열은 지식이 아니라 메타데이터이며,
인덱스에 포함되면 검색 결과를 오염시킨다. 다음 패턴의 밀도를 길이로 정규화한
점수로 판별했다.

- `et al.` 출현
- `숫자. 대문자` 형태의 번호 매김 인용
- `연도;` / `연도:` 형태의 저널 표기

임계값 0.3에서 **899개 중 127개(14.1%)**를 제외하여 최종 **772 chunk**를 확보했다.
경계값 부근 표본을 육안 검증하여 본문 오탈락이 없음을 확인했다.

### 3.3 Chunk 메타데이터

각 chunk는 citation 생성에 필요한 정보를 모두 보유한다.

```json
{
  "chunk_id": "GL003_p0004_c002",
  "doc_id": "GL003",
  "title": "community-acquired pneumonia",
  "document_type": "guideline",
  "organization": "ATS / IDSA",
  "year": 2019,
  "target_coverage": ["Pneumonia", "Consolidation", "Lung Opacity"],
  "page": 4,
  "section": "Diagnosis",
  "source_url": "https://...",
  "n_tokens": 700
}
```

섹션 제목은 정규식 기반으로 탐지했으며 **899개 중 53개(5.9%)**에서만 식별되었다.
PDF는 heading을 구조적으로 표기하지 않아 탐지율이 낮다.
미탐지 시 `null`로 두었으며, 추정값으로 채우지 않았다. 잘못된 섹션명은
잘못된 citation으로 직결되기 때문이다.

### 3.4 임베딩

**모델: OpenAI text-embedding-3-large (3,072차원)**

의학 도메인 특화 모델인 MedCPT 대신 범용 모델을 채택했다. 근거:

1. MedCPT Article Encoder는 입력 512 토큰 한계로, 본 파이프라인의 700 토큰
   chunk가 절단된다.
2. MedCPT는 PubMed 초록 쌍으로 학습되어, 본 코퍼스인 진료지침 본문 산문과
   텍스트 분포가 다르다.
3. 코퍼스 규모가 작아(53.8만 토큰) 전량 임베딩 비용이 약 0.07 USD에 그친다.

Phase 2에서 MedCPT와 동일 평가셋으로 비교 측정할 예정이다.

**Rate limit 대응.** 계정 등급의 분당 토큰 한도(40,000 TPM)를 초과하여
초기 배치가 429로 실패했다. 다음을 적용해 해결했다.

- 배치를 chunk 개수가 아닌 **토큰 예산(30,000)** 기준으로 분할.
  개수 기준 분할은 chunk 길이 편차로 인해 단일 요청이 한도를 초과한다.
- 60초 롤링 윈도우 **토큰 버킷**으로 송신 속도를 사전 조절.
- 잔여 429에 대한 지수 백오프 재시도(최대 5회).

배치 응답은 `index` 필드로 재정렬한다. 순서가 어긋나면 chunk와 벡터가
불일치하여 **오류 없이 잘못된 검색 결과**가 반환되기 때문이다.

### 3.5 인덱스

**Qdrant, 코사인 거리.** 컬렉션을 두 개로 분리했다.

- `knowledge_guidelines_reviews` — 문헌
- `radiology_cases` — 증례 (별도 구축)

검색 목적과 메타데이터 스키마가 상이하여 단일 컬렉션에 혼재시키지 않았다.

로컬 파일 모드로 구성하되, `QDRANT_URL` 환경변수만 지정하면 서버 모드로
전환되도록 클라이언트를 추상화했다. 배포 시 코드 변경이 없다.

재색인은 컬렉션 전체 삭제 후 재생성한다. 부분 갱신은 `chunk_id` 변경 시
구 벡터가 잔존하여 검색 결과에 유령 문서로 노출된다.

### 3.6 검색 및 품질 점수

Phase 1은 dense 검색 단독으로 구성했다. 메타데이터 필터로
observation 및 문서 유형 기준 범위 제한을 지원한다.

검색 결과는 `EvidenceItem`으로 변환되며, `quality` 필드를 다음으로 산출한다.

```
quality = 권위도(문서 유형) × 신선도(발행 연도)
```

| 문서 유형 | 권위도 |
|---|---|
| guideline | 1.00 |
| review | 0.85 |
| review/reference | 0.80 |

신선도는 반감기 12년의 지수 감쇠(하한 0.3)를 적용했다.
2009년 리뷰와 2024년 진료지침을 동일 가중으로 처리하면
Trust 계산이 성립하지 않는다. 연도 미상 문서는 0.7로 두었으며,
최신 문서와 동일하게 취급하지 않았다.

---

## 4. 검증

### 4.1 단위 테스트

17개 테스트를 작성해 전량 통과했다. 검증 항목:

- 하이픈 분철 복원, 개행 정규화, 문단 경계 보존
- 참고문헌 판별의 양성/음성 케이스
- Chunk 토큰 예산 준수, 페이지 추적, 메타데이터 전파
- 품질 점수의 단조성 — guideline > review, 최신 > 과거, 연도미상 < 최신
- citation 필수 필드 존재

### 4.2 검색 품질 평가

<!-- RESULTS_PLACEHOLDER -->

---

## 5. 한계 및 다음 단계

### 5.1 현재 한계

- **섹션 탐지율 5.9%** — PDF 구조 정보 부재. 레이아웃 기반 파서 도입 시 개선 여지.
- **단일 문서 의존 소견 3건** — Fracture, Enlarged Cardiomediastinum, Support Devices.
- **Dense 검색 단독** — 의학 약어 및 고유명사에 대해 sparse 검색이 우월한 영역이 존재.

### 5.2 Phase 2 계획

- BM25 sparse 검색 추가
- RRF(Reciprocal Rank Fusion) 융합
- Cross-encoder reranking
- MedCPT 대비 임베딩 성능 비교 측정

### 5.3 Phase 3 계획

- Query rewrite / decomposition
- 근거 충분성 평가(CRAG) 및 재검색
- Web search fallback

### 5.4 Case RAG

별도 corpus로 구축한다. 현 시점 상태:

| 후보 | 상태 |
|---|---|
| MIMIC-CXR reports | PhysioNet credentialed/DUA 데이터. **승인 대기** |
| NLM Open-i Indiana CXR | 공개 데이터. 프로토타입 구축 대상 |

MIMIC-CXR은 이용 승인 절차가 필요하므로, 공개 데이터인 Open-i로
프로토타입을 우선 구축하고 승인 후 확장한다.

---

## 부록. 재현 방법

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # OPENAI_API_KEY 입력

python scripts/build_knowledge_index.py   # 인덱스 구축
python scripts/eval_retrieval.py          # 검색 품질 평가
pytest                                    # 단위 테스트
```
