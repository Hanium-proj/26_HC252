"use client";

import { usePathname } from "next/navigation";
import { IconBell, IconSearch } from "@/components/icons";
import { Kbd } from "@/components/ui";

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
  return (
    <header className="topbar-veil sticky top-0 z-10 flex h-[56px] items-center justify-between gap-6 px-7">
      {/* breadcrumb: only the current segment carries full ink */}
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="shrink-0 text-ink-3">Chest AI</span>
        <span className="shrink-0 text-ink-3">/</span>
        <span className="truncate font-medium text-ink">{current}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          className="hidden h-8 w-[220px] items-center gap-2 rounded-lg bg-surface-1 px-2.5 text-[12.5px] text-ink-3 shadow-e1 transition-shadow duration-150 ease-out hover:shadow-e2 md:flex"
        >
          <IconSearch className="h-4 w-4" />
          <span className="flex-1 text-left">환자 · 검사 검색</span>
          <Kbd>⌘K</Kbd>
        </button>

        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-surface-1 text-ink-2 shadow-e1 transition-shadow duration-150 ease-out hover:shadow-e2 hover:text-ink"
        >
          <IconBell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-critical-fill" />
        </button>

        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-1 text-[11px] font-semibold text-ink-2 shadow-e1">
          JK
        </span>
      </div>
    </header>
  );
}
