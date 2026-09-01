"""[담당 B] 2단계 - Chunking. 페이지 텍스트 -> 검색 단위 chunk + metadata.

권장값: chunk 500-900 tokens, overlap 80-150, heading/paragraph 경계 존중.
여기서는 700 / 100 을 기본값으로 잡았다.

페이지 경계를 넘어 chunk 를 만드는 이유: PDF 페이지는 물리적 단위일 뿐이라
문단이 페이지 끝에서 잘린다. 페이지마다 끊으면 문맥이 절단된 chunk 가 대량 생긴다.
대신 각 chunk 가 시작한 페이지를 기록해 citation 을 유지한다.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

import tiktoken

from app.retrieval.knowledge_rag.parse import ParsedDocument

ENC = tiktoken.get_encoding("cl100k_base")

CHUNK_TOKENS = 700
OVERLAP_TOKENS = 100

# 가이드라인/리뷰에서 흔한 섹션 제목. 문서 구조를 알면 검색 필터로 쓸 수 있다.
_HEADING = re.compile(
    r"^\s*(?:\d+(?:\.\d+)*\.?\s+)?"
    r"(Abstract|Introduction|Background|Methods?|Materials and Methods|"
    r"Results?|Discussion|Conclusions?|Recommendations?|Summary|"
    r"Diagnosis|Diagnostic|Management|Treatment|Imaging|Epidemiology|"
    r"Clinical (?:Presentation|Features|Context)|Differential Diagnosis|"
    r"Complications?|Follow-?up|References)\b",
    re.IGNORECASE | re.MULTILINE,
)


# 참고문헌 목록 탐지용. 레퍼런스 chunk 는 지식이 아니라 서지 나열이라
# 인덱스에 넣으면 검색 결과만 오염시킨다. 실측상 코퍼스의 약 14% 를 차지한다.
_ETAL = re.compile(r"\bet al\b", re.IGNORECASE)
_NUMBERED_CITE = re.compile(r"(?:^|\s)\d{1,3}\.\s+[A-Z]")
_JOURNAL_YEAR = re.compile(r"\b(?:19|20)\d{2}\s*[;:.]")

REFERENCE_THRESHOLD = 0.3


def reference_score(text: str) -> float:
    """참고문헌 목록일 가능성. 길이로 정규화한 서지 패턴 밀도."""
    n = max(len(text), 1)
    return (
        len(_ETAL.findall(text)) * 120
        + len(_NUMBERED_CITE.findall(text)) * 60
        + len(_JOURNAL_YEAR.findall(text)) * 40
    ) / n


@dataclass
class Chunk:
    """Vector DB 에 들어가는 최소 단위. payload 가 곧 citation 재료다."""

    chunk_id: str
    doc_id: str
    text: str

    # 서지 메타 (sources.csv 유래)
    title: str
    document_type: str
    organization: str
    year: int | None
    topic: str
    source_url: str
    target_coverage: list[str] = field(default_factory=list)

    # 위치 메타
    page: int = 0
    section: str | None = None
    n_tokens: int = 0

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


def _detect_section(text: str) -> str | None:
    """chunk 앞부분에서 섹션 제목을 찾는다.

    PDF 는 heading 을 구조적으로 표시하지 않으므로 완벽할 수 없다.
    못 찾으면 None 을 둔다. 억지로 채우면 잘못된 citation 이 된다.
    """
    m = _HEADING.search(text[:300])
    return m.group(1).title() if m else None


def chunk_document(
    doc: ParsedDocument,
    chunk_tokens: int = CHUNK_TOKENS,
    overlap: int = OVERLAP_TOKENS,
) -> list[Chunk]:
    """문서 하나를 토큰 기준 슬라이딩 윈도우로 자른다."""
    # 토큰마다 원 페이지 번호를 따라다니게 해서 chunk 시작 페이지를 복원한다
    tokens: list[int] = []
    token_pages: list[int] = []
    for page in doc.pages:
        t = ENC.encode(page.text + "\n\n")
        tokens.extend(t)
        token_pages.extend([page.page_no] * len(t))

    meta = doc.meta
    title = meta.topic or meta.file_name.replace(".pdf", "").replace("_", " ")

    chunks: list[Chunk] = []
    step = chunk_tokens - overlap
    idx = 0
    for start in range(0, len(tokens), step):
        window = tokens[start : start + chunk_tokens]
        # 마지막 자투리가 overlap 보다 짧으면 직전 chunk 에 이미 포함돼 있다
        if len(window) < overlap:
            break

        text = ENC.decode(window).strip()
        if len(text) < 100:
            continue

        page = token_pages[start]
        idx += 1
        chunks.append(
            Chunk(
                chunk_id=f"{meta.doc_id}_p{page:04d}_c{idx:03d}",
                doc_id=meta.doc_id,
                text=text,
                title=title,
                document_type=meta.document_type,
                organization=meta.organization,
                year=meta.year,
                topic=meta.topic,
                source_url=meta.source_url,
                target_coverage=meta.target_coverage,
                page=page,
                section=_detect_section(text),
                n_tokens=len(window),
            )
        )
    return chunks


def chunk_corpus(
    docs: list[ParsedDocument], drop_references: bool = True, **kw
) -> tuple[list[Chunk], int]:
    """코퍼스 전체를 chunk 로 만든다.

    반환: (chunk 목록, 참고문헌으로 판정해 제외한 개수)
    제외 개수를 함께 돌려주는 이유는 필터가 과하게 걸리는지 확인해야 하기 때문이다.
    """
    out: list[Chunk] = []
    dropped = 0
    for d in docs:
        for c in chunk_document(d, **kw):
            if drop_references and reference_score(c.text) > REFERENCE_THRESHOLD:
                dropped += 1
                continue
            out.append(c)
    return out, dropped
