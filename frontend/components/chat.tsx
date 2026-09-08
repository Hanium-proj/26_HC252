"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AgentBlock, AgentStep, ChatMsg } from "@/lib/data";
import { CiteChip, toneOf } from "@/components/ui";
import {
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChevronDown,
  IconConsult,
  IconPaperclip,
  IconSend,
} from "@/components/icons";

/* ---------- message ---------- */

export function Message({ m, onFollowup }: { m: ChatMsg; onFollowup?: (q: string) => void }) {
  const [open, setOpen] = useState(false);

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="anim-rise rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[13.5px] leading-relaxed text-ink">
            {m.text}
          </div>
          <p className="mono mt-1.5 pr-1 text-right text-[10.5px] text-ink-3">{m.time}</p>
        </div>
      </div>
    );
  }

  const showSteps = !!m.steps?.length && (m.streaming || open);

  return (
    <div className="max-w-full">
      {/* step receipt — collapsed audit trail, click to expand */}
      {m.receipt && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="anim-rise mb-3 flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-2.5 pr-3 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-hover"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-wash text-ok">
            <IconCheck className="h-3 w-3" />
          </span>
          {m.receipt}
          <IconChevronDown className={`h-3.5 w-3.5 text-ink-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* live working steps */}
      {showSteps && (
        <div className="mb-3 flex flex-col gap-2.5 py-1">
          {m.steps!.map((s) => (
            <StepRow key={s.name} s={s} />
          ))}
        </div>
      )}

      {/* flat full-width prose — no avatar, no bot bubble */}
      <div className="flex flex-col gap-4">
        {m.blocks.map((b, i) => (
          <Block key={i} b={b} streaming={!!m.streaming && i === m.blocks.length - 1} />
        ))}
      </div>

      {m.followups && !m.streaming && (
        <div className="anim-rise mt-4 flex flex-wrap gap-2">
          {m.followups.map((f) => {
            const lit = f.startsWith("문헌 검색:");
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFollowup?.(f)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-colors"
                style={lit ? { background: "var(--accent-wash)", color: "var(--accent-strong)" } : undefined}
                {...(lit ? {} : { className: "inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink" })}
              >
                {lit ? <IconBook className="h-3.5 w-3.5" /> : <IconConsult className="h-3.5 w-3.5 text-ink-3" />}
                {lit ? f.replace(/^문헌 검색\s*[:：]\s*/, "문헌에서 찾기 · ") : f}
              </button>
            );
          })}
        </div>
      )}

      {!m.streaming && m.blocks.length > 0 && (
        <p className="mono mt-3 text-[10.5px] text-ink-3">{m.time} · CXR-NET V2.4</p>
      )}
    </div>
  );
}

function StepRow({ s }: { s: AgentStep }) {
  return (
    <div className="anim-rise flex items-center gap-2.5">
      {s.state === "done" ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-wash text-ok">
          <IconCheck className="h-3 w-3" />
        </span>
      ) : s.state === "active" ? (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <span className="pulse-dot h-2 w-2 rounded-full bg-accent-fill" />
        </span>
      ) : (
        <span className="flex h-4 w-4 items-center justify-center">
          <span className="h-2 w-2 rounded-full border border-line-strong" />
        </span>
      )}
      <span
        className={
          s.state === "active"
            ? "shimmer-text text-[13px] font-medium"
            : s.state === "done"
              ? "text-[13px] text-ink-3"
              : "text-[13px] text-ink-3 opacity-60"
        }
      >
        {s.name}
        {s.state === "active" && "…"}
      </span>
      {s.state === "done" && s.detail && (
        <span className="truncate text-[11.5px] text-ink-3">· {s.detail}</span>
      )}
    </div>
  );
}

function Block({ b, streaming }: { b: AgentBlock; streaming: boolean }) {
  if (b.type === "p") {
    return (
      <p className="text-[13.5px] leading-[1.65] text-ink">
        {b.text}
        {streaming ? (
          <span className="caret" aria-hidden="true" />
        ) : (
          b.cites?.map((c, i) => <CiteChip key={i} kind={c.kind} label={c.label} />)
        )}
      </p>
    );
  }

  if (b.type === "ddx") {
    return (
      <div className="anim-rise flex flex-col gap-2">
        {b.buckets.map((bucket) => {
          const t = toneOf(bucket.tone);
          return (
            <div key={bucket.title} className="rounded-xl bg-surface-2 px-4 py-3">
              <p className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: t.text }}>
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
    <div className="anim-rise">
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

/* ---------- composer ---------- */

export function Composer({
  contextLabel,
  disabled,
  onSend,
}: {
  contextLabel: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  /* single line that grows with the question, capped at ~5 lines */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const canSend = !disabled && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="rounded-2xl bg-surface-2 p-2 transition-shadow duration-150 focus-within:shadow-e2">
      <div className="flex items-center gap-1.5 px-1.5 pb-2 pt-1">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-1 px-2.5 text-[11px] font-medium text-ink-2 shadow-e1">
          <span className="h-1.5 w-1.5 rounded-full bg-ok-fill" />
          {contextLabel}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink-2"
          aria-label="파일 첨부"
        >
          <IconPaperclip className="h-[18px] w-[18px]" />
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={disabled ? "답변을 작성하는 중입니다…" : "이 검사에 대해 질문하세요 — 근거와 출처를 함께 답합니다"}
          className="max-h-[120px] flex-1 resize-none bg-transparent py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:shadow-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="전송"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-fill text-accent-ink shadow-accent transition-all duration-150 hover:bg-accent-strong active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <IconSend className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
