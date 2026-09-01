# Knowledge RAG v1 자료 수집 상태

## 완료

기존 11개 PDF + 보완 6개 PDF = **총 17개 Knowledge 문헌 확보 완료**

보완한 주요 영역:
- Fracture
- Enlarged Cardiomediastinum / mediastinal abnormality
- Cardiomegaly / heart failure context
- Pleural disease
- Pneumothorax
- General chest radiograph interpretation

이제 문헌을 더 무작정 추가하기보다,
**17개로 retrieval MVP를 구축하고 검색 실패 사례를 기준으로 다음 문헌을 추가**하는 것을 권장한다.

## 다음 단계

1. PDF parsing
2. chunking
3. metadata attach
4. embedding
5. Qdrant indexing
6. retrieval test
7. disease/finding coverage gap 재평가
8. 필요한 문헌만 2차 추가

Similar Case RAG는 별도 corpus로 구축한다.
