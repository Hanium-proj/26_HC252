"""[담당 B] Knowledge RAG - PubMed/PMC 문헌 근거.

파이프라인: ingest -> parse -> chunk -> embed -> index -> search
각 단계를 파일로 분리해 둔 이유는 오프라인 배치(ingest~index)와
온라인 질의(search)의 실행 주기가 다르기 때문이다.
"""
