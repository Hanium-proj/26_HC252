"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PanelHead, Chip, ProbBar, MicroLabel, GhostButton, ModelStamp, Dot } from "@/components/ui";
import { Film } from "@/components/film";
import { Rich } from "@/components/rich";
import { LocatorGlyph, IconArrowUpRight, IconConsult, IconCrosshair } from "@/components/icons";
import { kpis } from "@/lib/data";
import type { Level } from "@/lib/data";
import { CASES, DEFAULT_CASE_ID, WORKLIST_ORDER, filmCorners, getCase, topFinding } from "@/lib/demo/cases";
import { useDemo } from "@/lib/demo/store";

type Row = { id: string; patient: string; study: string; finding: string; score: number; level: Level; status: string; time: string };

export default function Dashboard() {
  const router = useRouter();
  const { state, actions } = useDemo();

  /* worklist rows come from the store: a case that has not been analyzed
     yet still shows "분석 중" until the presenter runs it */
  const rows: Row[] = WORKLIST_ORDER.map((id) => {
    const c = CASES[id];
    return state.analyzed[id]
      ? { id, ...c.row }
      : { id, patient: c.row.patient, study: c.row.study, finding: "분석 중", score: -1, level: "info", status: "분석 중", time: c.row.time };
  });
  const priority = rows.filter((r) => r.level === "critical").length;

  /* featured card follows the selection when that case has results */
  const featured = state.analyzed[state.selectedCaseId] ? getCase(state.selectedCaseId) : CASES[DEFAULT_CASE_ID];
  const top = topFinding(featured);
  const regions = featured.regions[top.en] ?? [];

  function open(id: string) {
    actions.selectCase(id);
    router.push("/analysis");
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k, i) => {
          const value = i === 2 ? String(priority) : k.value;
          return (
            <div key={k.label} className="panel anim-rise px-5 py-4" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink-2">{k.label}</span>
                {i === 0 && <Sparkline />}
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="mono text-[28px] font-semibold leading-none tracking-tight text-ink tnum">{value}</span>
                <span className="text-[12px] text-ink-3">{k.unit}</span>
                <span
                  className="ml-auto inline-flex h-[18px] items-center rounded-full px-2 text-[11px] font-medium"
                  style={{ background: `var(--${k.deltaTone}-wash)`, color: `var(--${k.deltaTone}-text)` }}
                >
                  {k.delta}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-ink-3">{k.caption}</p>
            </div>
          );
        })}
      </div>

      {/* ---- featured case: 영상 · 예측 · 근거 · 에이전트 통합 ---- */}
      <Panel key={featured.id} className="anim-rise">
        <PanelHead
          title="우선 확인 케이스"
          sub={`${featured.patient.name} · ${featured.patient.study}`}
          action={
            <>
              <span className="mono hidden text-[11px] tracking-wide text-ink-3 sm:inline">{featured.id}</span>
              <Chip level={featured.findings[0].level === "neutral" ? "ok" : featured.findings[0].level}>{featured.chip}</Chip>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[minmax(320px,380px)_1fr_minmax(280px,320px)]">
          <div className="grid grid-cols-2 gap-2">
            <Film src={state.uploads[featured.id]?.url ?? "/xray/pa.png"} label="PA" outline={regions.length > 0} regions={regions} corners={false} ratio="4 / 5" corner={filmCorners(featured)} />
            <Film
              src={state.uploads[featured.id]?.url ?? "/xray/pa.png"}
              label="GRAD-CAM"
              variant={regions.length > 0 ? "gradcam" : "plain"}
              regions={regions}
              corners={false}
              ratio="4 / 5"
              swatch="jet"
            />
          </div>

          <div className="min-w-0">
            <MicroLabel>AI FINDINGS · TOP 5</MicroLabel>
            <div className="mt-3 flex flex-col gap-[18px]">
              {featured.findings.slice(0, 5).map((f, i) => (
                <div key={f.en}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <LocatorGlyph loc={f.loc} className="h-5 w-5 shrink-0 text-ink-3" tone="var(--ink-2)" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{f.ko}</span>
                    <span className="mono text-[13px] font-semibold text-ink tnum">{Math.round(f.prob * 100)}%</span>
                  </div>
                  <ProbBar value={f.prob} threshold={f.threshold} level={f.level} delay={i * 50} />
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center justify-between text-[11px] text-ink-3">
              <span>세로선 = 운영 임계값 · 임계값 이상 소견만 강조</span>
              <button type="button" onClick={() => open(featured.id)} className="font-medium text-ink-2 transition-colors hover:text-accent">
                소견 9개 더 보기
              </button>
            </p>
          </div>

          <div className="flex min-w-0 flex-col rounded-lg bg-surface-2 p-4">
            <MicroLabel>AGENT SUMMARY</MicroLabel>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
              <Rich text={featured.agentSummary} />
            </p>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="flex gap-2">
                <Link href="/evidence" className="flex-1" onClick={() => actions.selectCase(featured.id)}>
                  <GhostButton className="w-full">
                    <IconCrosshair className="h-4 w-4" />
                    근거 보기
                  </GhostButton>
                </Link>
                <Link href="/agent" className="flex-1" onClick={() => actions.selectCase(featured.id)}>
                  <GhostButton className="w-full">
                    <IconConsult className="h-4 w-4" />
                    에이전트
                  </GhostButton>
                </Link>
              </div>
              <ModelStamp />
            </div>
          </div>
        </div>
      </Panel>

      {/* ---- worklist ---- */}
      <Panel className="anim-rise">
        <PanelHead
          title="판독 워크리스트"
          sub="오늘 접수 · AI 스코어 내림차순"
          action={
            <GhostButton>
              전체 보기
              <IconArrowUpRight className="h-3.5 w-3.5" />
            </GhostButton>
          }
        />
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-hairline">
                <Th className="pl-5">검사 ID</Th>
                <Th>환자</Th>
                <Th>촬영</Th>
                <Th>AI 소견</Th>
                <Th className="text-right">스코어</Th>
                <Th>상태</Th>
                <Th className="pr-5 text-right">접수</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const selected = w.id === state.selectedCaseId;
                return (
                  <tr
                    key={w.id}
                    onClick={() => open(w.id)}
                    className="group h-9 cursor-pointer border-b border-hairline transition-colors duration-150 last:border-b-0 hover:bg-surface-2"
                    style={selected ? { background: "var(--accent-wash)" } : undefined}
                  >
                    <td className="mono whitespace-nowrap pl-5 pr-3 text-[12px] tracking-wide text-ink-2 group-hover:text-ink">{w.id}</td>
                    <td className="whitespace-nowrap pr-3 text-[13px] text-ink">
                      <span className="inline-flex items-center gap-2">
                        {w.level === "critical" && <Dot level="critical" />}
                        {w.patient}
                      </span>
                    </td>
                    <td className="mono whitespace-nowrap pr-3 text-[12px] text-ink-2">{w.study}</td>
                    <td className="whitespace-nowrap pr-3 text-[13px] text-ink-2">{w.finding}</td>
                    <td className="mono whitespace-nowrap pr-3 text-right text-[13px] font-semibold text-ink tnum">{w.score >= 0 ? w.score : "—"}</td>
                    <td className="whitespace-nowrap pr-3">
                      <Chip level={w.level} pulse={w.level === "info"}>
                        {w.status}
                      </Chip>
                    </td>
                    <td className="mono whitespace-nowrap pr-5 text-right text-[12px] text-ink-3 tnum">{w.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`h-9 whitespace-nowrap pr-3 text-left text-[12px] font-medium text-ink-2 ${className}`}>{children}</th>;
}

/* 32px single-stroke sparkline, no axes */
function Sparkline() {
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" fill="none" className="text-ink-3">
      <path d="M2 18 L10 15 L18 16 L26 11 L34 13 L42 8 L50 10 L62 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="62" cy="4" r="2" fill="var(--accent-text)" />
    </svg>
  );
}
