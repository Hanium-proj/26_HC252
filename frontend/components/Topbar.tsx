"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconBell, IconSearch, IconArrowRight } from "@/components/icons";
import { Kbd, Chip, Dot, MicroLabel } from "@/components/ui";
import { CASES, WORKLIST_ORDER } from "@/lib/demo/cases";
import { useDemo } from "@/lib/demo/store";

const titles: Record<string, string> = {
  "/": "진단 대시보드",
  "/analysis": "분류 분석",
  "/evidence": "근거 시각화",
  "/agent": "진단 에이전트",
  "/literature": "문헌 검색",
};

export function Topbar() {
  const path = usePathname();
  const current = titles[path] ?? titles["/"];
  const [palette, setPalette] = useState(false);
  const [bell, setBell] = useState(false);

  /* ⌘K / Ctrl+K opens the case search anywhere */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar-veil sticky top-0 z-30 flex h-[56px] items-center justify-between gap-6 px-7">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="shrink-0 text-ink-3">Chest AI</span>
        <span className="shrink-0 text-ink-3">/</span>
        <span className="truncate font-medium text-ink">{current}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="hidden h-8 w-[220px] items-center gap-2 rounded-lg bg-surface-1 px-2.5 text-[12.5px] text-ink-3 shadow-e1 transition-shadow duration-150 ease-out hover:shadow-e2 md:flex"
        >
          <IconSearch className="h-4 w-4" />
          <span className="flex-1 text-left">환자 · 검사 검색</span>
          <Kbd>⌘K</Kbd>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setBell((v) => !v)}
            aria-expanded={bell}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-surface-1 text-ink-2 shadow-e1 transition-shadow duration-150 ease-out hover:shadow-e2 hover:text-ink"
          >
            <IconBell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-critical-fill" />
          </button>
          {bell && <Notifications onClose={() => setBell(false)} />}
        </div>

        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-1 text-[11px] font-semibold text-ink-2 shadow-e1">JK</span>
      </div>

      {palette && <CasePalette onClose={() => setPalette(false)} />}
    </header>
  );
}

/* ---------- ⌘K case search ---------- */

function CasePalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { state, actions } = useDemo();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const needle = q.trim().toLowerCase();
  const hits = WORKLIST_ORDER.map((id) => CASES[id]).filter((c) => {
    if (!needle) return true;
    const hay = `${c.id} ${c.patient.name} ${c.patient.masked} ${c.row.finding} ${c.row.patient}`.toLowerCase();
    return hay.includes(needle);
  });

  function pick(id: string) {
    actions.selectCase(id);
    onClose();
    router.push("/analysis");
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") setCursor((c) => Math.min(hits.length - 1, c + 1));
    if (e.key === "ArrowUp") setCursor((c) => Math.max(0, c - 1));
    if (e.key === "Enter" && !e.nativeEvent.isComposing && hits[cursor]) pick(hits[cursor].id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(22,24,29,0.28)] backdrop-blur-[3px]" />
      <div className="anim-rise relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-surface-1 shadow-e3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3">
          <IconSearch className="h-[18px] w-[18px] shrink-0 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKey}
            placeholder="검사 ID · 환자 · 소견으로 검색"
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3 focus:shadow-none"
          />
          <Kbd>ESC</Kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto px-2 pb-2">
          <MicroLabel className="block px-2 pb-1.5 pt-1">TODAY · {hits.length} STUDIES</MicroLabel>
          {hits.length === 0 && <p className="px-2 py-4 text-[13px] text-ink-3">일치하는 검사가 없습니다.</p>}
          {hits.map((c, i) => {
            const analyzed = state.analyzed[c.id];
            const on = i === cursor;
            return (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(c.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100"
                style={on ? { background: "var(--accent-wash)" } : undefined}
              >
                <span className="mono w-[118px] shrink-0 text-[12px] tracking-wide text-ink-2">{c.id}</span>
                <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-ink">
                  {analyzed && c.row.level === "critical" && <Dot level="critical" />}
                  <span className="truncate">{c.patient.name}</span>
                  <span className="truncate text-ink-3">{analyzed ? c.row.finding : "분석 중"}</span>
                </span>
                <span className="mono shrink-0 text-[12px] text-ink-3 tnum">{c.row.time}</span>
                {on && <IconArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- notifications ---------- */

function Notifications({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { state, actions } = useDemo();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const items = [
    { id: "PX-2026-0142", title: "우선 확인 케이스 도착", body: "폐렴 의심 47% · 김성** 여성 58세", time: "09:41", level: "critical" as const },
    state.analyzed["PX-2026-0125"]
      ? { id: "PX-2026-0125", title: "분석 완료", body: "폐렴 의심 62% · 한지** 남성 52세", time: "방금", level: "critical" as const }
      : { id: "PX-2026-0125", title: "분석 대기", body: "한지** 남성 52세 · 임상 정보 확인 필요", time: "08:02", level: "info" as const },
    { id: "PX-2026-0128", title: "검토 필요", body: "흉수 의심 71% · 박정** 여성 67세", time: "08:10", level: "warning" as const },
  ];

  return (
    <div ref={ref} className="anim-rise absolute right-0 top-10 z-40 w-[340px] overflow-hidden rounded-xl bg-surface-1 shadow-e3">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-[13px] font-semibold text-ink">알림</span>
        <Chip level="critical">{items.filter((i) => i.level === "critical").length}건 우선</Chip>
      </div>
      <div className="flex flex-col px-2 pb-2">
        {items.map((n) => (
          <button
            key={n.title + n.id}
            type="button"
            onClick={() => {
              actions.selectCase(n.id);
              onClose();
              router.push("/analysis");
            }}
            className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <span className="mt-1.5">
              <Dot level={n.level} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-ink">{n.title}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{n.body}</span>
            </span>
            <span className="mono shrink-0 text-[10.5px] text-ink-3 tnum">{n.time}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
