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
import {
  IconSearch,
  IconArrowUpRight,
  IconChevronRight,
  IconCheck,
  IconDoc,
} from "@/components/icons";
import { sources, retrievalStages, reliabilityChecks } from "@/lib/data";

export default function LiteraturePage() {
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
          {/* search field */}
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 transition-shadow duration-150 focus-within:shadow-e2">
            <IconSearch className="h-[18px] w-[18px] shrink-0 text-ink-3" />
            <span className="flex-1 text-[13.5px] text-ink">
              우하엽 음영 · 발열 동반 성인, 지역사회획득 폐렴 감별과 관리 근거
            </span>
            <span className="kbd hidden sm:inline">⏎</span>
          </div>

          {/* pipeline: 4 steps connected by chevrons, not divider boxes */}
          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {retrievalStages.map((s, i) => (
              <div key={s.n} className="relative rounded-xl bg-surface-2 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <MicroLabel>{`STEP ${s.n}`}</MicroLabel>
                  {i < retrievalStages.length - 1 && (
                    <IconChevronRight className="hidden h-3.5 w-3.5 text-ink-3 lg:block" />
                  )}
                </div>
                <p className="mt-2 text-[13px] font-semibold leading-tight text-ink">{s.name}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{s.desc}</p>
                <p className="mono mt-2.5 text-[11px] font-semibold text-accent">{s.result}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* ---- results + verification ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Panel className="anim-rise">
          <PanelHead
            title="검색 결과"
            sub="근거 적합도 순 · 모든 결과에 출처 연결"
            action={<Chip level="ok">3건 채택</Chip>}
          />
          <div className="flex flex-col gap-2.5 px-5 pb-5">
            {sources.map((r) => (
              <article
                key={r.n}
                className="panel-interactive rounded-xl bg-surface-2 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="mono flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent-wash text-[10.5px] font-semibold text-accent">
                      {r.n}
                    </span>
                    <GradeBadge grade={r.grade} />
                    <span className="mono text-[11px] text-ink-3 tnum">{r.year}</span>
                  </div>
                  <div className="flex w-24 shrink-0 items-center gap-2">
                    <ProbBar value={r.relevance} className="flex-1" />
                    <span className="mono text-[11.5px] font-semibold text-ink tnum">
                      {r.relevance.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-start gap-3.5">
                  {r.grade === "유사 사례" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/xray/case-similar.jpg"
                      alt="유사 사례 흉부 X-ray"
                      className="h-16 w-14 shrink-0 rounded-md bg-film object-cover grayscale"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold leading-snug text-ink">{r.title}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{r.snippet}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="mono flex items-center gap-1.5 text-[11px] tracking-wide text-ink-3">
                    <IconDoc className="h-3.5 w-3.5" />
                    {r.source}
                  </span>
                  <GhostButton className="!h-7 !bg-surface-1 shadow-e1">
                    원문 열기
                    <IconArrowUpRight className="h-3 w-3" />
                  </GhostButton>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="anim-rise">
            <PanelHead title="답변 신뢰도 검증" sub="검색부터 답변까지 3중 점검" />
            <div className="flex flex-col gap-4 px-5 pb-5">
              {reliabilityChecks.map((c) => (
                <div key={c.ko}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-ink">{c.ko}</span>
                      <MicroLabel className="hidden md:inline">{c.en}</MicroLabel>
                    </span>
                    <span className="mono text-[13px] font-semibold text-ink tnum">
                      {c.v.toFixed(2)}
                    </span>
                  </div>
                  <ProbBar value={c.v} threshold={0.8} />
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-3">
                기준값 0.80 미만이면 해당 답변은 자동으로 보류되고 판독의에게 표시되지 않습니다.
              </p>
            </div>
          </Panel>

          <Panel className="anim-rise flex flex-col">
            <PanelHead title="근거 종합" sub="검색 결과가 진단 방향을 지지하는지" />
            <div className="flex flex-1 flex-col px-5 pb-5">
              <Callout level="ok" icon={<IconCheck className="h-4 w-4" />}>
                3개 출처가 <b className="font-semibold text-ink">폐렴 감별 방향을 일관되게 지지</b>
                합니다. 근거 충분성 점검을 통과해 웹 검색 보강 없이 답변을 구성했습니다.
              </Callout>
              <div className="mt-4 flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
                <span className="text-[12.5px] text-ink-2">평균 근거 적합도</span>
                <span className="mono text-[12.5px] font-semibold text-ink tnum">0.88</span>
              </div>
              <ModelStamp className="mt-auto pt-4" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
