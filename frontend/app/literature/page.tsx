"use client";
import { useWorkspace } from "@/lib/live/store";
import { useSessionValue, appendQuestionDraft } from "@/lib/live/session";
import { WorkflowLink as Link } from "@/components/workflow";
import { PageHeading, Select, Loading } from "@/components/controls";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/live/api";
import type { SearchResult } from "@/lib/live/types";
import {
  Card,
  StudySelect,
  ErrorBox,
  Sources,
  Limitations,
  buttonClass,
  inputClass,
} from "@/components/live";
export default function LiteraturePage() {
  const { selected } = useWorkspace();
  return <SearchPanel key={selected?.id ?? "general"} />;
}
function SearchPanel() {
  const { selected, studies, select } = useWorkspace();
  const context = selected?.id ?? "general";
  const [query, setQuery] = useSessionValue(`search-query:${context}`, "");
  const [scope, setScope] = useSessionValue(
    `search-scope:${context}`,
    "knowledge",
  );
  const [stored, setStored] = useSessionValue<{
    result: SearchResult;
    scope: string;
  } | null>(`search-result:${context}`, null);
  const result = stored?.result ?? null;
  const [, setQuestion] = useSessionValue(
    `question:${context}:${selected?.analysis?.completed_at ?? "pending"}`,
    "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setBusy(true);
    setError("");
    setStored(null);
    try {
      const response = await api<SearchResult>(
        `/${scope === "cases" || scope === "public-cases" ? "cases" : "literature"}/search?q=${encodeURIComponent(query.trim())}&top_k=5&public=${scope.startsWith("public")}`,
        { signal: ac.signal },
      );
      setStored({ result: response, scope });
    } catch (e) {
      if (!ac.signal.aborted)
        setError(e instanceof Error ? e.message : "검색 실패");
    } finally {
      if (!ac.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeading
        eyebrow="EVIDENCE LIBRARY"
        title="질문에 맞는 근거를 찾아보세요"
        description="가이드라인부터 유사 판독문까지, 출처가 있는 자료로 검토를 이어가세요."
      />
      <StudySelect studies={studies} selected={selected} onChange={select} />
      <div className="context-note">
        {selected
          ? `검사 ${selected.name}의 검토 흐름입니다. 문헌 검색은 입력한 검색어를 기준으로 진행합니다.`
          : "검사 없이도 일반 문헌 검색을 사용할 수 있습니다."}
      </div>
      <Card
        className="search-hero"
        title="문헌·증례 검색"
        sub="제공된 가이드라인·리뷰, 로컬 MIMIC 판독문 또는 공개 논문에서 실제 근거를 검색합니다."
      >
        <form onSubmit={search} className="space-y-3">
          <div className="flex gap-3">
            <input
              aria-label="문헌 검색 질문"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={1000}
              disabled={busy}
              placeholder="질환, 영상 소견 또는 궁금한 내용을 입력하세요"
              className={inputClass}
              required
              minLength={2}
            />
            <button className={`${buttonClass} shrink-0`} disabled={busy}>
              {busy ? "실제 문헌 검색 중…" : "검색"}
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span className="shrink-0">검색 대상</span>
            <div className="min-w-0 flex-1 max-w-md">
              <Select
                label="검색 대상"
                value={scope}
                onChange={setScope}
                disabled={busy}
                options={[
                  { value: "knowledge", label: "가이드라인·리뷰" },
                  { value: "cases", label: "MIMIC 유사 판독문" },
                  { value: "public", label: "공개 논문 · Europe PMC" },
                  {
                    value: "public-cases",
                    label: "공개 증례 보고 · Europe PMC",
                  },
                ]}
              />
            </div>
          </div>
          <div className="search-topics">
            {[
              "기흉의 흉부 X-ray 소견",
              "흉수와 폐부종의 감별",
              "폐렴의 영상 진단 기준",
            ].map((text) => (
              <button
                type="button"
                disabled={busy}
                className="topic-chip"
                key={text}
                onClick={() => setQuery(text)}
              >
                {text} ↗
              </button>
            ))}
          </div>
        </form>
      </Card>
      <ErrorBox message={error} />
      {busy && <Loading label="관련 문헌을 찾고 있습니다" />}
      {!busy && !result && (
        <div className="workflow-strip">
          {[
            ["01", "검색 범위 선택", "가이드라인, 판독문, 공개 논문"],
            ["02", "질문으로 검색", "한국어 또는 영어로 입력"],
            ["03", "원문과 대조", "출처와 본문을 직접 확인"],
          ].map(([n, t, d]) => (
            <div className="workflow-step" key={n}>
              <b>{n}</b>
              <div>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {result && (
        <>
          {(query.trim() !== result.query.trim() ||
            scope !== stored?.scope) && (
            <div className="flow-notice">
              <div>
                <strong>검색 조건이 변경되었습니다</strong>
                <p>
                  아래는 이전 검색 결과입니다. 검색 버튼을 눌러 변경한 조건으로
                  다시 검색하세요.
                </p>
              </div>
            </div>
          )}
          <div className="next-actions">
            <div>
              <strong>“{result.query}” 검색 결과</strong>
              <p>이 주제로 질문을 이어가면 AI가 문헌을 다시 확인해 답합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/agent"
                className="btn-primary"
                onClick={() =>
                  setQuestion((previous) =>
                    appendQuestionDraft(
                      previous,
                      `${result.query}에 대해 관련 문헌의 근거와 한계를 설명해줘.`,
                    ),
                  )
                }
              >
                이 주제로 AI에게 질문 →
              </Link>
              {selected && (
                <Link href="/analysis" className="btn-secondary">
                  검사로 돌아가기 →
                </Link>
              )}
            </div>
          </div>
          <Card
            title={`${result.hits.length}건의 실제 검색 결과`}
            sub={`영문 검색어: ${result.english_query} · 전체 검색 ${result.total?.toLocaleString() ?? "미집계"}건 · 후보 ${result.candidates}건 · ${result.cached ? "캐시 재사용" : `${(result.latency_ms / 1000).toFixed(2)}초`}`}
          >
            <Sources hits={result.hits} />
          </Card>
          <Card title="검색 범위와 한계" sub={result.method}>
            <Limitations items={result.limitations} />
          </Card>
        </>
      )}
    </div>
  );
}
