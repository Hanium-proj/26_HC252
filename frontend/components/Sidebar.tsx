"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "@/lib/demo/store";
import {
  IconGrid,
  IconClassify,
  IconCrosshair,
  IconConsult,
  IconBook,
  IconHistory,
  IconShieldCheck,
  BrandMark,
} from "@/components/icons";

const groups: {
  label: string;
  items: { href: string; label: string; Icon: (p: { className?: string }) => JSX.Element; badge?: string }[];
}[] = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/", label: "진단 대시보드", Icon: IconGrid },
      { href: "/analysis", label: "분류 분석", Icon: IconClassify },
      { href: "/evidence", label: "근거 시각화", Icon: IconCrosshair },
    ],
  },
  {
    label: "ASSIST",
    items: [
      { href: "/agent", label: "진단 에이전트", Icon: IconConsult, badge: "2" },
      { href: "/literature", label: "문헌 검색", Icon: IconBook },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { actions } = useDemo();

  /* back to the opening state for another take: selection, analyses,
     transcripts, uploads and tool counters all clear */
  function resetDemo() {
    actions.reset();
    router.push("/");
  }

  return (
    /* white sheet lifted off the canvas — depth instead of a border line */
    <aside className="sticky top-0 z-20 hidden h-screen w-60 shrink-0 flex-col bg-surface-1 shadow-sidebar lg:flex">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-4 pb-6 pt-5">
        <BrandMark />
        <div>
          <p className="text-[14px] font-semibold leading-none tracking-tight text-ink">Chest AI</p>
          <p className="microlabel mt-1.5 block leading-none">READING ROOM</p>
        </div>
      </div>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-6 px-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="microlabel px-2 pb-2">{g.label}</p>
            <div className="flex flex-col gap-0.5">
              {g.items.map(({ href, label, Icon, badge }) => {
                const active = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 transition-all duration-150 ease-out ${
                      active
                        ? "text-accent-strong shadow-[0_1px_2px_rgba(15,118,110,0.08)]"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                    style={active ? { background: "var(--accent-wash)" } : undefined}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-colors duration-150 ${
                        active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-none">
                      {label}
                    </span>
                    {badge && (
                      <span
                        className="mono flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold leading-none"
                        style={{ background: "var(--critical-wash)", color: "var(--critical-text)" }}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="microlabel px-2 pb-2">RECORDS</p>
          <div className="flex flex-col gap-0.5">
            <span className="flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-ink-3">
              <IconHistory className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-[13px] font-medium leading-none">판독 이력</span>
            </span>
            <span className="flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-ink-3">
              <IconShieldCheck className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-[13px] font-medium leading-none">품질 관리</span>
            </span>
          </div>
        </div>
      </nav>

      {/* user + model version — separated by air, not a line */}
      <div className="mx-3 mb-4 mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-2">
            JK
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[12.5px] font-medium text-ink">정경훈</span>
            <span className="block truncate text-[11px] text-ink-3">영상의학과 · 판독의</span>
          </span>
        </div>
        <div className="mx-1 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
          <span className="mono text-[10.5px] tracking-wide text-ink-2">CXR-NET V2.4</span>
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-ok-fill" />
            검증됨
          </span>
        </div>
        <button
          type="button"
          onClick={resetDemo}
          className="mx-1 self-start px-2 py-1 text-[10.5px] text-ink-3 transition-colors hover:text-ink-2"
        >
          세션 초기화
        </button>
      </div>
    </aside>
  );
}
