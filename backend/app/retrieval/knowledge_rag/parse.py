"""[담당 B] 1단계 - PDF 파싱. 원문 PDF -> 페이지 단위 텍스트 + sources.csv 메타 결합.

인수인계 코퍼스(Knowledge_RAG_v1)는 이미 수집이 끝나 있으므로 ingest 단계는 건너뛴다.
여기서는 17개 PDF를 페이지 단위로 추출하고 sources.csv 의 서지 메타를 붙인다.

페이지 번호를 보존하는 이유: citation 이 "어느 문서 몇 쪽"까지 가리켜야
사용자가 원문에서 근거를 직접 확인할 수 있다. 문서 단위 인용만으로는
184쪽짜리 WHO 가이드라인에서 근거를 찾을 수 없다.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader


@dataclass
class DocumentMeta:
    """sources.csv 한 행. chunk metadata 의 원천."""

    doc_id: str
    file_name: str
    document_type: str          # guideline | review | review/reference
    topic: str
    organization: str
    year: int | None
    source_url: str
    target_coverage: list[str]  # 14개 observation 중 이 문서가 커버하는 것
    status: str
    ingest_ready: bool


@dataclass
class Page:
    page_no: int  # 1-based. PDF 뷰어에서 보이는 번호와 맞춘다
    text: str


@dataclass
class ParsedDocument:
    meta: DocumentMeta
    pages: list[Page] = field(default_factory=list)

    @property
    def n_chars(self) -> int:
        return sum(len(p.text) for p in self.pages)


def load_sources(csv_path: Path) -> list[DocumentMeta]:
    """sources.csv 를 읽어 ingest 대상 문서 메타를 반환한다.

    status 가 seed_keep 이고 ingest_ready 가 yes 인 행만 대상으로 한다.
    case_corpus (MIMIC / Open-i) 행은 별도 파이프라인이므로 여기서 제외된다.
    """
    metas: list[DocumentMeta] = []
    # utf-8-sig: 이 CSV 는 BOM 으로 시작한다. utf-8 로 읽으면 첫 컬럼명이 깨진다
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["ingest_ready"].strip().lower() != "yes":
                continue
            if row["status"].strip() != "seed_keep":
                continue

            year_raw = row["year"].strip()
            metas.append(
                DocumentMeta(
                    doc_id=row["doc_id"].strip(),
                    file_name=row["file_name_or_corpus"].strip(),
                    document_type=row["document_type"].strip(),
                    topic=row["topic"].strip(),
                    organization=row["organization"].strip(),
                    year=int(year_raw) if year_raw.isdigit() else None,
                    source_url=row["source_url"].strip(),
                    target_coverage=[
                        c.strip()
                        for c in row["target_coverage"].split(";")
                        if c.strip()
                    ],
                    status=row["status"].strip(),
                    ingest_ready=True,
                )
            )
    return metas


def _clean(text: str) -> str:
    """PDF 추출 텍스트의 흔한 잡음을 정리한다.

    - 하이픈 줄바꿈 복원: "pneumo-\nthorax" -> "pneumothorax"
      이걸 안 하면 검색에서 'pneumothorax' 가 매칭되지 않는다.
    - 단일 줄바꿈은 공백으로 (PDF 는 시각적 줄바꿈이라 문장 경계가 아니다)
    - 빈 줄 2개 이상은 문단 경계로 보존
    """
    text = text.replace("\x00", "")
    text = re.sub(r"-\n(?=[a-z])", "", text)        # 하이픈 분철 복원
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)     # 단일 줄바꿈 -> 공백
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf(pdf_path: Path, meta: DocumentMeta) -> ParsedDocument:
    """PDF 한 개를 페이지 단위로 추출한다."""
    reader = PdfReader(str(pdf_path))
    pages: list[Page] = []
    for i, page in enumerate(reader.pages, start=1):
        text = _clean(page.extract_text() or "")
        if len(text) < 50:
            # 표지 / 그림 전용 페이지. chunk 로 만들 가치가 없다
            continue
        pages.append(Page(page_no=i, text=text))
    return ParsedDocument(meta=meta, pages=pages)


def parse_corpus(corpus_dir: Path) -> list[ParsedDocument]:
    """코퍼스 전체를 파싱한다.

    sources.csv 에 있는데 실제 파일이 없으면 예외를 던진다. 조용히 건너뛰면
    문서 하나가 통째로 검색에서 빠진 걸 나중에 알아채기 어렵다.
    """
    metas = load_sources(corpus_dir / "02_Metadata" / "sources.csv")
    pdf_root = corpus_dir / "01_Knowledge_PDF"

    by_name = {p.name: p for p in pdf_root.rglob("*.pdf")}
    missing = [m.file_name for m in metas if m.file_name not in by_name]
    if missing:
        raise FileNotFoundError(
            f"sources.csv 에 있으나 PDF 가 없음: {missing}"
        )

    return [parse_pdf(by_name[m.file_name], m) for m in metas]
