import {
  Panel,
  PanelHead,
  Chip,
  Tag,
  Callout,
  CiteChip,
  Disclaimer,
  toneOf,
} from "@/components/ui";
import {
  IconCheck,
  IconChevronDown,
  IconSend,
  IconPaperclip,
  IconArrowRight,
  IconConsult,
} from "@/components/icons";
import { chat, agentTools, sources, patient } from "@/lib/data";
import type { AgentBlock, ChatMsg } from "@/lib/data";

export default function AgentPage() {
  return (
    <div className="mx-auto grid h-[calc(100vh-104px)] min-h-[560px] max-w-[1400px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
      {/* ================= chat: fixed shell, messages scroll inside ================= */}
      <Panel className="anim-rise flex h-full min-h-0 flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-ink">진단 에이전트</h2>
            <p className="mt-1 text-[12px] text-ink-3">
              영상 · 임상 정보 · 문헌을 근거로 답하는 판독 보조 대화
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tag className="mono !text-[11px]">{patient.id}</Tag>
            <Chip level="ok">근거 연결됨</Chip>
          </div>
        </div>

        {/* messages */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
          {/* context divider — air + microlabel, not a line */}
          <p className="microlabel text-center">CHEST PA · 2026-07-13 · CONNECTED</p>

          {chat.map((m, i) => (
            <Message key={i} m={m} />
          ))}
        </div>

        {/* composer */}
        <div className="px-5 pb-4">
          <div className="rounded-2xl bg-surface-2 p-2 transition-shadow duration-150 focus-within:shadow-e2">
            <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-1">
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-1 px-2.5 text-[11px] font-medium text-ink-2 shadow-e1">
                <span className="h-1.5 w-1.5 rounded-full bg-ok-fill" />
                흉부 PA · {patient.id}
                <span className="cursor-pointer text-ink-3">×</span>
              </span>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink-2"
              >
                <IconPaperclip className="h-[18px] w-[18px]" />
              </button>
              <p className="flex-1 select-none py-2 text-[13.5px] text-ink-3">
                이 검사에 대해 질문하세요 — 근거와 출처를 함께 답합니다
              </p>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-fill text-accent-ink shadow-accent transition-all duration-150 hover:bg-accent-strong active:scale-[0.97]"
              >
                <IconSend className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <Disclaimer className="mt-2 text-center" />
        </div>
      </Panel>

      {/* ================= right rail (scrolls independently) ================= */}
      <div className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
        <Panel className="anim-rise">
          <PanelHead title="도구 실행 현황" sub="이 대화에서 에이전트가 사용한 도구" />
          <div className="flex flex-col gap-1 px-3 pb-4">
            {agentTools.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{t.name}</p>
                  <p className="truncate text-[11.5px] text-ink-3">{t.desc}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="mono text-[12px] text-ink-2 tnum">{t.calls}회</span>
                  <Chip level={t.state === "완료" ? "ok" : "neutral"}>{t.state}</Chip>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="anim-rise">
          <PanelHead title="확신도 점검" sub="답변 신뢰 수준을 함께 표시" />
          <div className="flex flex-col gap-2 px-5 pb-5">
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
              <span className="text-[12.5px] text-ink-2">여러 모델 간 합의</span>
              <span className="mono text-[12.5px] font-semibold text-ink tnum">0.62</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
              <span className="text-[12.5px] text-ink-2">판독자 간 일치도</span>
              <span className="text-[12.5px] font-medium text-warning">낮음</span>
            </div>
            <Callout level="warning" className="mt-1">
              판독자 간 일치도가 낮은 소견이 포함되어{" "}
              <b className="font-semibold text-ink">판독의 확인 권고</b>로 전환되었습니다.
            </Callout>
          </div>
        </Panel>

        <Panel className="anim-rise">
          <PanelHead title="이 대화의 근거" sub="번호는 답변 속 인용과 연결" />
          <div className="flex flex-col gap-1 px-3 pb-4">
            {sources.map((s) => (
              <a
                key={s.n}
                href="/literature"
                className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2"
              >
                <span className="mono mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-wash text-[10.5px] font-semibold text-accent">
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium leading-snug text-ink group-hover:text-accent-strong">
                    {s.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] text-ink-3">{s.grade}</span>
                    <span className="mono text-[10.5px] text-ink-3 tnum">{s.year}</span>
                  </span>
                </span>
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- message renderers ---------- */

function Message({ m }: { m: ChatMsg }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[13.5px] leading-relaxed text-ink">
            {m.text}
          </div>
          <p className="mono mt-1.5 pr-1 text-right text-[10.5px] text-ink-3">{m.time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {/* step receipt — collapsed audit trail */}
      {m.receipt && (
        <button
          type="button"
          className="mb-3 flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-2.5 pr-3 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-hover"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-wash text-ok">
            <IconCheck className="h-3 w-3" />
          </span>
          {m.receipt}
          <IconChevronDown className="h-3.5 w-3.5 text-ink-3" />
        </button>
      )}

      {/* live working steps */}
      {m.steps && (
        <div className="mb-1 flex flex-col gap-2.5 py-1">
          {m.steps.map((s) => (
            <div key={s.name} className="flex items-center gap-2.5">
              {s.state === "done" ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-wash text-ok">
                  <IconCheck className="h-3 w-3" />
                </span>
              ) : (
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-accent-fill" />
                </span>
              )}
              <span
                className={
                  s.state === "active"
                    ? "shimmer-text text-[13px] font-medium"
                    : "text-[13px] text-ink-3"
                }
              >
                {s.name}
                {s.state === "active" && "…"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* flat full-width prose — no avatar, no bot bubble */}
      <div className="flex flex-col gap-4">
        {m.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
      </div>

      {m.followups && (
        <div className="mt-4 flex flex-wrap gap-2">
          {m.followups.map((f) => (
            <button
              key={f}
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <IconConsult className="h-3.5 w-3.5 text-ink-3" />
              {f}
            </button>
          ))}
        </div>
      )}

      {!m.streaming && m.blocks.length > 0 && (
        <p className="mono mt-3 text-[10.5px] text-ink-3">{m.time} · CXR-NET V2.4</p>
      )}
    </div>
  );
}

function Block({ b }: { b: AgentBlock }) {
  if (b.type === "p") {
    return (
      <p className="text-[13.5px] leading-[1.65] text-ink">
        {b.text}
        {b.cites?.map((c, i) => (
          <CiteChip key={i} kind={c.kind} label={c.label} />
        ))}
      </p>
    );
  }

  if (b.type === "ddx") {
    return (
      <div className="flex flex-col gap-2">
        {b.buckets.map((bucket) => {
          const t = toneOf(bucket.tone);
          return (
            <div key={bucket.title} className="rounded-xl bg-surface-2 px-4 py-3">
              <p
                className="flex items-center gap-2 text-[11.5px] font-semibold"
                style={{ color: t.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fill }} />
                {bucket.title}
              </p>
              {bucket.items.map((item) => (
                <div key={item.name} className="mt-1.5">
                  <p className="text-[13.5px] font-semibold text-ink">
                    {item.name}
                    {item.cites?.map((c, i) => (
                      <CiteChip key={i} kind={c.kind} label={c.label} />
                    ))}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{item.reason}</p>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-semibold text-ink-2">{b.title}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {b.items.map((x) => (
          <li key={x} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
            <IconArrowRight className="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
