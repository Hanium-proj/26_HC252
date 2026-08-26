"""[담당 B] 1단계 - PubMed / PMC 원문 수집 (오프라인 배치)."""

from __future__ import annotations

from pathlib import Path


def fetch(query: str, max_results: int, out_dir: Path) -> list[Path]:
    """Entrez E-utilities 로 검색하고 원문을 내려받는다.

    주의:
      - NCBI rate limit: API key 없으면 3 req/s, 있으면 10 req/s
      - PMC Open Access subset 만 전문 사용 가능. 나머지는 abstract 만
      - API key 는 .env 의 NCBI_API_KEY 로만 참조 (하드코딩 금지)
    """
    raise NotImplementedError("담당 B: PubMed/PMC 수집 구현")
