"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Panel,
  PanelHead,
  Chip,
  Tag,
  ProbBar,
  MicroLabel,
  Callout,
  ModelStamp,
  GradeBadge,
  GhostButton,
} from "@/components/ui";
import { Rich } from "@/components/rich";
import { IconSearch, IconArrowUpRight, IconChevronRight, IconCheck, IconDoc } from "@/components/icons";
import { retrievalStages } from "@/lib/data";
import { useDemo, useCurrentCase } from "@/lib/demo/store";
import { searchLiterature } from "@/lib/demo/api";
import { Aborted } from "@/lib/demo/delay";
import { pickLiterature, type LiteratureResult, type Source } from "@/lib/demo/literature-script";

type StageState = "waiting" | "active" | "done";
type Stage = { state: StageState; result?: string };

export default function LiteraturePage() {
  const { state, actions } = useDemo();
  const { c } = useCurrentCase();

  const initialQuery = state.literature[c.id] ?? c.literatureQuery;
  const [query, setQuery] = useState(initialQuery);
  const [stages, setStages] = useState<Stage[] | null>(null); // non-null while searching
  const [result, setResult] = useState<LiteratureResult | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const searching = stages !== null;

  async function search(q: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStages(retrievalStages.map(() => ({ state: "waiting" })));
    setResult(null);
    try {
      for await (const ev of searchLiterature(q, ac.signal)) {
        if (ev.event === "stage") {
          setStages((s) => s && s.map((st, i) => (i === ev.index ? { state: ev.status === "start" ? "active" : "done", result: ev.result } : st)));
        } else {
          setResult(ev.result);
          setRevealKey((k) => k + 1);
          actions.setLiterature(c.id, q);
        }
      }
    } catch (e) {
      if (!(e instanceof Aborted)) throw e;
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
        setStages(null);
      }
    }
  }

  /* the screen opens by running the case query once, so arriving from the
     dashboard or the agent rail shows the pipeline working, not a static list */
  useEffect(() => {
    const t = setTimeout(() => search(initialQuery), 200);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && query.trim()) search(query.trim());
  }

  const shown = result ?? (searching ? null : pickLiterature(initialQuery));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* ---- query + retrieval pipeline ---- */}
      <Panel className="anim-rise">
        <PanelHead
          title="문헌 · 사례 검색"
          sub="진단 맥락에서 자동 생성된 질문 — 직접 수정할 수 있습니다"
          action={<Tag className="mono !text-[11px]">INDEX 12,480</Tag>}
        />
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 transition-shadow duration-150 focus-within:shadow-e2">
            <IconSearch className={`h-[18px] w-[18px] shrink-0 ${searching ? "pulse-dot text-accent" : "text-ink-3"}`} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="검색할 임상 질문을 입력하세요"
              className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus:shadow-none"
            />
            <button type="button" onClick={() => query.trim() && search(query.trim())} className="kbd hidden sm:inline" aria-label="검색">
              ⏎
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {retrievalStages.map((s, i) => {
              const st = stages?.[i];
              const done = st ? st.state === "done" : !!shown;
              const active = st?.state === "active";
              const resultText = st?.result ?? (shown ? shown.stageResults[i] : undefined);
              return (
                <div
                  key={s.n}
                  className="relative rounded-xl bg-surface-2 px-4 py-3.5 transition-colors duration-300"
                  style={active ? { background: "var(--accent-wash)" } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <MicroLabel className={active ? "!text-accent" : ""}>{`STEP ${s.n}`}</MicroLabel>
                    {i < retrievalStages.length - 1 && <IconChevronRight className="hidden h-3.5 w-3.5 text-ink-3 lg:block" />}
                  </div>
                  <p className={`mt-2 text-[13px] font-semibold leading-tight ${active ? "shimmer-text" : done ? "text-ink" : "text-ink-3"}`}>
                    {s.name}
                    {active && "…"}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{s.desc}</p>
                  <p className="mono mt-2.5 h-4 text-[11px] font-semibold text-accent">
                    {done && resultText ? <span className="anim-rise inline-block">{resultText}</span> : active ? <span className="text-ink-3">실행 중</span> : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* ---- results + verification ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Panel className="anim-rise">
          <PanelHead
            title="검색 결과"
            sub="근거 적합도 순 · 모든 결과에 출처 연결"
            action={
              shown ? (
                <Chip level={shown.synthesis.level}>{shown.synthesis.adopted}건 채택</Chip>
              ) : (
                <Chip level="info" pulse>
                  검색 중
                </Chip>
              )
            }
          />
          <div className="flex flex-col gap-2.5 px-5 pb-5">
            {shown ? (
              shown.sources.map((r, i) => <SourceCard key={`${revealKey}-${r.n}`} r={r} delay={i * 90} />)
            ) : (
              [0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-surface-2 p-4" aria-hidden="true">
                  <span className="pulse-dot block h-3 w-1/3 rounded-sm bg-surface-hover" style={{ animationDelay: `${i * 120}ms` }} />
                  <span className="pulse-dot mt-3 block h-3.5 w-3/4 rounded-sm bg-surface-hover" style={{ animationDelay: `${i * 120 + 60}ms` }} />
                  <span className="pulse-dot mt-2 block h-3 w-full rounded-sm bg-surface-hover" style={{ animationDelay: `${i * 120 + 120}ms` }} />
                </div>
              ))
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="anim-rise">
            <PanelHead title="답변 신뢰도 검증" sub="검색부터 답변까지 3중 점검" />
            <div className="flex flex-col gap-4 px-5 pb-5">
              {(shown?.reliability ?? [
                { ko: "검색 관련성", en: "RELEVANCE", v: 0 },
                { ko: "추론 일관성", en: "CONSISTENCY", v: 0 },
                { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0 },
              ]).map((r, i) => (
                <div key={r.ko}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-ink">{r.ko}</span>
                      <MicroLabel className="hidden md:inline">{r.en}</MicroLabel>
                    </span>
                    <span className="mono text-[13px] font-semibold text-ink tnum">{shown ? r.v.toFixed(2) : "—"}</span>
                  </div>
                  <ProbBar key={revealKey} value={shown ? r.v : 0} threshold={0.8} delay={i * 80} />
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-3">기준값 0.80 미만이면 해당 답변은 자동으로 보류되고 판독의에게 표시되지 않습니다.</p>
            </div>
          </Panel>

          <Panel className="anim-rise flex flex-col">
            <PanelHead title="근거 종합" sub="검색 결과가 진단 방향을 지지하는지" />
            <div className="flex flex-1 flex-col px-5 pb-5">
              {shown ? (
                <div key={revealKey} className="anim-rise">
                  <Callout level={shown.synthesis.level} icon={shown.synthesis.level === "ok" ? <IconCheck className="h-4 w-4" /> : undefined}>
                    <Rich text={shown.synthesis.text} />
                  </Callout>
                  <div className="mt-4 flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
                    <span className="text-[12.5px] text-ink-2">평균 근거 적합도</span>
                    <span className="mono text-[12.5px] font-semibold text-ink tnum">{shown.synthesis.avg.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="shimmer-text text-[12.5px] font-medium">근거 충분성 점검 중…</p>
              )}
              <ModelStamp className="mt-auto pt-4" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ r, delay }: { r: Source; delay: number }) {
  const [open, setOpen] = useState(false);
  const pubmed = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(r.title)}`;
  return (
    <article className="panel-interactive anim-rise rounded-xl bg-surface-2 p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="mono flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent-wash text-[10.5px] font-semibold text-accent">{r.n}</span>
          <GradeBadge grade={r.grade} />
          <span className="mono text-[11px] text-ink-3 tnum">{r.year}</span>
        </div>
        <div className="flex w-24 shrink-0 items-center gap-2">
          <ProbBar value={r.relevance} className="flex-1" delay={delay} />
          <span className="mono text-[11.5px] font-semibold text-ink tnum">{r.relevance.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-2.5 flex items-start gap-3.5">
        {r.grade === "유사 사례" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/xray/case-similar.jpg" alt="유사 사례 흉부 X-ray" className="h-16 w-14 shrink-0 rounded-md bg-film object-cover grayscale" />
        )}
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-snug text-ink">{r.title}</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{r.snippet}</p>
          {open && (
            <div className="anim-rise mt-3 rounded-lg bg-surface-1 px-3.5 py-3 shadow-e1">
              <MicroLabel>CITATION</MicroLabel>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                {r.title}. {r.source} ({r.year}). 근거 등급 {r.grade} · 적합도 {r.relevance.toFixed(2)}.
              </p>
              {r.grade !== "유사 사례" && (
                <a
                  href={pubmed}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:text-accent-strong"
                >
                  PubMed에서 열기
                  <IconArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="mono flex items-center gap-1.5 text-[11px] tracking-wide text-ink-3">
          <IconDoc className="h-3.5 w-3.5" />
          {r.source}
        </span>
        <GhostButton className="!h-7 !bg-surface-1 shadow-e1" onClick={() => setOpen((v) => !v)} active={open}>
          {open ? "닫기" : "원문 열기"}
          <IconArrowUpRight className="h-3 w-3" />
        </GhostButton>
      </div>
    </article>
  );
}
