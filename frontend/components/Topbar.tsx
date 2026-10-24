"use client";
import { usePathname } from "next/navigation";
import { WorkflowLink as Link } from "@/components/workflow";
import { useWorkspace } from "@/lib/live/store";
export function Topbar() {
  const { error } = useWorkspace();
  const path = usePathname();
  const title =
    (
      {
        "/": "검사 대시보드",
        "/analysis": "영상 분석",
        "/agent": "AI 어시스턴트",
        "/evidence": "근거 시각화",
        "/literature": "문헌·증례 검색",
      } as Record<string, string>
    )[path] ?? "워크스페이스";
  return (
    <header className="topbar-veil sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-7 py-4">
      <p className="text-sm text-ink-2">
        Chest AI <span className="mx-2 text-ink-3">/</span>
        {title}
      </p>
      <span className="text-xs text-ink-3">
        {error ? "서버 연결 확인 필요" : "RESEARCH · 로컬 워크스페이스"}
      </span>
      <nav
        aria-label="모바일 메뉴"
        className="flex w-full gap-4 overflow-x-auto text-xs text-accent lg:hidden"
      >
        {[
          ["/", "대시보드"],
          ["/analysis", "분석"],
          ["/evidence", "근거"],
          ["/agent", "에이전트"],
          ["/literature", "문헌"],
        ].map(([href, name]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={path === href ? "font-bold text-accent" : "text-ink-2"}
          >
            {name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
