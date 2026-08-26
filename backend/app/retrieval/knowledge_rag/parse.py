"""[담당 B] 2단계 - 원문 파싱. XML/PDF -> 섹션 구조 텍스트."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def parse(path: Path) -> dict[str, Any]:
    """JATS XML 또는 PDF 를 섹션(abstract/methods/results/discussion)으로 분해한다.

    메타데이터(제목, 저자, 저널, 연도, PMID/PMCID)를 함께 뽑아야 한다.
    이 메타데이터가 나중에 Trust 의 신선도/권위 가중치 입력이 된다.
    """
    raise NotImplementedError("담당 B: 파싱 구현")
