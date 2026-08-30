"""Knowledge RAG 파이프라인 테스트.

임베딩/Qdrant 를 타지 않는 순수 로직(파싱 정리, chunking, 품질 점수)만 검증한다.
외부 API 를 부르는 테스트는 CI 에서 불안정해진다.
"""

from app.retrieval.knowledge_rag.chunk import (
    REFERENCE_THRESHOLD,
    Chunk,
    chunk_document,
    reference_score,
)
from app.retrieval.knowledge_rag.parse import DocumentMeta, Page, ParsedDocument, _clean
from app.retrieval.knowledge_rag.search import quality_score


def _meta(**kw) -> DocumentMeta:
    base = dict(
        doc_id="GL001",
        file_name="test.pdf",
        document_type="guideline",
        topic="pneumothorax",
        organization="ACR",
        year=2024,
        source_url="https://example.org",
        target_coverage=["Pneumothorax"],
        status="seed_keep",
        ingest_ready=True,
    )
    base.update(kw)
    return DocumentMeta(**base)


class TestClean:
    def test_rejoins_hyphenated_linebreak(self):
        """'pneumo-\\nthorax' 가 붙지 않으면 검색에서 영영 안 잡힌다."""
        assert "pneumothorax" in _clean("pneumo-\nthorax was seen")

    def test_single_newline_becomes_space(self):
        # PDF 의 줄바꿈은 시각적 개행일 뿐 문장 경계가 아니다
        assert _clean("chest\nradiograph") == "chest radiograph"

    def test_paragraph_break_preserved(self):
        assert "\n\n" in _clean("First para.\n\nSecond para.")


class TestReferenceDetection:
    def test_bibliography_scores_high(self):
        text = (
            "1. Smith J, Lee K, et al. Imaging of pneumothorax. Radiology. 2021;45:1-9. "
            "2. Park H, Kim S, et al. Pleural disease review. Thorax. 2023;12:33-41. "
            "3. Chen L, Wu M, et al. CXR interpretation. Chest. 2019;88:12-20."
        )
        assert reference_score(text) > REFERENCE_THRESHOLD

    def test_body_text_scores_low(self):
        text = (
            "A pneumothorax appears as a visceral pleural line with absent lung "
            "markings peripherally. On an upright chest radiograph the air collects "
            "in the apex, whereas on a supine film it accumulates anteriorly, "
            "producing the deep sulcus sign."
        )
        assert reference_score(text) < REFERENCE_THRESHOLD


class TestChunking:
    def _doc(self, pages: int, words_per_page: int = 600) -> ParsedDocument:
        return ParsedDocument(
            meta=_meta(),
            pages=[
                Page(page_no=i, text=" ".join(["finding"] * words_per_page))
                for i in range(1, pages + 1)
            ],
        )

    def test_respects_token_budget(self):
        chunks = chunk_document(self._doc(4), chunk_tokens=300, overlap=50)
        assert chunks
        assert all(c.n_tokens <= 300 for c in chunks)

    def test_chunk_id_encodes_doc_and_page(self):
        c = chunk_document(self._doc(3))[0]
        assert c.chunk_id.startswith("GL001_p0001_c")

    def test_page_is_tracked_across_pages(self):
        """citation 이 쪽수를 가리키려면 chunk 가 시작 페이지를 알아야 한다."""
        chunks = chunk_document(self._doc(6), chunk_tokens=300, overlap=50)
        assert len({c.page for c in chunks}) > 1
        assert all(1 <= c.page <= 6 for c in chunks)

    def test_metadata_propagates_from_sources_csv(self):
        c = chunk_document(self._doc(2))[0]
        assert c.target_coverage == ["Pneumothorax"]
        assert c.organization == "ACR"
        assert c.year == 2024

    def test_overlap_creates_shared_context(self):
        chunks = chunk_document(self._doc(4), chunk_tokens=300, overlap=100)
        assert len(chunks) >= 2


class TestQualityScore:
    def _payload(self, **kw):
        base = {"document_type": "guideline", "year": 2024}
        base.update(kw)
        return base

    def test_in_unit_range(self):
        assert 0.0 <= quality_score(self._payload()) <= 1.0

    def test_guideline_outranks_review_same_year(self):
        gl = quality_score(self._payload(document_type="guideline"))
        rv = quality_score(self._payload(document_type="review"))
        assert gl > rv

    def test_recent_outranks_old_same_type(self):
        new = quality_score(self._payload(year=2024))
        old = quality_score(self._payload(year=2009))
        assert new > old

    def test_missing_year_does_not_get_top_score(self):
        """연도 미상을 최신처럼 취급하면 Trust 계산이 왜곡된다."""
        unknown = quality_score(self._payload(year=None))
        assert unknown < quality_score(self._payload(year=2024))


class TestChunkPayload:
    def test_payload_carries_citation_fields(self):
        c = Chunk(
            chunk_id="GL001_p0004_c002",
            doc_id="GL001",
            text="body",
            title="pneumothorax",
            document_type="guideline",
            organization="ACR",
            year=2024,
            topic="pneumothorax",
            source_url="https://example.org",
            page=4,
        )
        p = c.to_payload()
        for field in ("chunk_id", "doc_id", "title", "organization", "year", "page", "source_url"):
            assert field in p
