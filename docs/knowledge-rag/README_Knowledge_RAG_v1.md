# Knowledge RAG 인수인계 (v1)

## 1. 현재 전달본 상태

이 폴더는 흉부 X-ray 진단 에이전트의 **Knowledge RAG v1 corpus 및 구축 가이드**이다.

- Knowledge PDF: **17개**
- 구성: 공식 guideline + CXR/radiology review
- 목적: Knowledge RAG의 parsing / chunking / embedding / retrieval 구현 및 1차 검색 품질 평가
- Similar Case RAG: **별도 구축 예정**
- 현재 17개는 최종 고정 corpus가 아니라 **v1 seed corpus**이며, 검색 평가 후 부족한 영역만 추가 보완한다.

`sources.csv`에서 현재 17개 PDF는 모두:
- `status = seed_keep`
- `ingest_ready = yes`

로 표시되어 있다.

---

## 2. 프로젝트에서 RAG의 역할

```text
CXR + Clinical information
          │
          ▼
 Vision / Multimodal Model
          │
   predictions / CAM
 confidence / uncertainty
          │
          ▼
       LLM Agent
          │
       Tool Router
   ┌──────┼─────────┐
   ▼      ▼         ▼
Knowledge RAG   Case RAG   Web Search
   │              │
Guidelines      Similar radiology
+ Reviews       reports / cases
   └──────┬───────┘
          ▼
 Evidence synthesis
          │
          ▼
Explanation / references /
additional checks / guidance
```

### Knowledge RAG
현재 전달하는 17개 PDF를 사용한다.

주요 역할:
- 질환/영상 소견 설명
- 영상 소견의 임상적 의미
- 감별진단에 참고할 근거
- 추가 검사/확인사항
- 근거 문헌 및 출처 반환

### Similar Case RAG
Knowledge RAG와 **별도 corpus**로 구축한다.

후보:
1. MIMIC-CXR radiology reports
2. NLM Open-i Indiana Chest X-ray cases

MIMIC-CXR raw report는 credentialed/DUA 데이터이므로 공용 Drive에 단순 업로드하지 않고,
권한이 확인된 서버에서 별도 index를 구축하는 것을 권장한다.

---

## 3. 모델의 14개 observation

```text
Atelectasis
Cardiomegaly
Consolidation
Edema
Enlarged Cardiomediastinum
Fracture
Lung Lesion
Lung Opacity
No Finding
Pleural Effusion
Pleural Other
Pneumonia
Pneumothorax
Support Devices
```

주의:
- 14개가 모두 독립적인 질환은 아니다.
- `Lung Opacity`, `Consolidation`, `No Finding`, `Support Devices` 등은 radiographic observation/category에 가깝다.
- 따라서 라벨별 문서 수를 기계적으로 동일하게 맞추지 않는다.
- 한 문서가 여러 observation을 동시에 커버할 수 있다.

---

## 4. 권장 Drive 구조

```text
Knowledge_RAG_v1/
├── 00_README/
│   ├── README_Knowledge_RAG.md
│   └── RAG_ARCHITECTURE.txt
│
├── 01_Knowledge_PDF/
│   ├── 01_Guidelines/
│   └── 02_Reviews/
│
├── 02_Metadata/
│   └── sources.csv
│
└── 03_Cases/
    └── README_CASES_PENDING.txt
```

PDF는 원본 그대로 보존하고, 파싱 결과/임베딩 산출물은 별도 output 폴더에서 생성하는 것을 권장한다.

---

## 5. PDF ingestion 권장 규칙

PDF 전체를 하나의 embedding으로 넣지 않는다.

```text
PDF
 → text/layout parsing
 → section detection
 → semantic chunking
 → metadata attach
 → embedding
 → Vector DB
```

초기 권장값:
- chunk: 500–900 tokens
- overlap: 80–150 tokens
- 가능하면 heading / paragraph 경계 기준 분할
- page와 section metadata 보존

### chunk metadata 예시

```json
{
  "doc_id": "GL003",
  "title": "Diagnosis and Treatment of Adults with Community-acquired Pneumonia",
  "document_type": "guideline",
  "organization": "ATS/IDSA",
  "year": 2019,
  "topic": "community-acquired pneumonia",
  "target_coverage": ["Pneumonia", "Consolidation", "Lung Opacity"],
  "section": "Diagnosis",
  "page": 4,
  "source_url": "...",
  "chunk_id": "GL003_p004_c02"
}
```

---

## 6. Retrieval 구현 순서

처음부터 전체 Agentic RAG를 완성하기보다 단계적으로 구현한다.

### Phase 1 — MVP
- PDF parsing
- chunk + metadata
- embedding
- Qdrant dense retrieval
- metadata filtering
- top-k 5~8
- source/citation 반환

### Phase 2 — Retrieval 개선
- BM25 추가
- dense + sparse hybrid retrieval
- RRF fusion
- cross-encoder reranking

### Phase 3 — Agentic RAG
- query rewrite / decomposition
- sufficiency evaluation (CRAG)
- 부족 시 재검색
- 필요 시 Web Search fallback

보고서의 목표 구조인
`dense + BM25 → reranking → CRAG → Qdrant`
방향은 유지하되, MVP부터 검증한다.

---

## 7. 1차 검색 품질 평가

최소한 아래 질문으로 retrieval을 먼저 확인한다.

1. CXR에서 pneumothorax를 시사하는 주요 소견은?
2. Pleural effusion이 보이면 어떤 원인을 추가로 고려해야 하는가?
3. Pulmonary edema와 pneumonia를 영상 소견으로 어떻게 구분할 수 있는가?
4. CXR에서 indeterminate pulmonary nodule 발견 시 다음 영상검사는?
5. Support device 위치 이상에서 확인해야 할 합병증은?
6. Rib fracture가 의심될 때 적절한 영상검사는?
7. Cardiomegaly와 pulmonary edema가 함께 보일 때 어떤 임상 맥락을 고려할 수 있는가?
8. Mediastinal widening/enlargement가 의심될 때 다음 평가 단계는?

평가 항목:
- 관련 문서가 top-k에 포함되는가
- 질문과 무관한 chunk가 과도하게 검색되지 않는가
- citation이 실제 원문과 일치하는가
- 답변이 검색 근거를 넘어 과도하게 확장되지 않는가
- 여러 문서가 충돌할 때 source/year/authority를 보존하는가

---

## 8. 팀원이 바로 하면 되는 작업

1. `sources.csv`와 실제 PDF 파일명 매칭 확인
2. 17개 PDF parsing
3. section/chunk 생성
4. metadata 부착
5. Qdrant `knowledge_guidelines_reviews` collection 생성
6. embedding 및 indexing
7. simple retrieval API 구현
8. 위 test query로 retrieval 평가
9. 결과를 보고 부족한 문헌 영역만 추가 요청

### 아직 하지 않아도 되는 것
- MIMIC raw report를 Drive에서 ingestion
- 14개 label별 문헌 수를 동일하게 맞추기
- 수백 편의 논문 무작정 추가
- 처음부터 복잡한 CRAG/multi-agent를 완성하기

---

## 9. 권장 Qdrant 분리

```text
knowledge_guidelines_reviews
radiology_cases
```

Knowledge 문헌과 실제 patient/case report는 검색 목적과 metadata가 다르므로
하나의 collection에 무작정 섞지 않는 것을 권장한다.

---

## 10. 파일 관리

- 원본 PDF 이름은 가능하면 변경하지 않고 유지한다.
- `sources.csv`의 `file_name_or_corpus`와 실제 파일명이 정확히 일치해야 한다.
- PDF 추가/교체 시 `sources.csv`도 반드시 함께 수정한다.
- 문서 삭제 대신 status를 `exclude` 또는 `replace`로 남기면 변경 이력을 추적하기 쉽다.
