"use client";
import { useEffect, useSyncExternalStore } from "react";
import { WorkflowLink as Link } from "@/components/workflow";
import { usePathname } from "next/navigation";
import { BrandMark, IconGrid, IconClassify, IconCrosshair, IconConsult, IconBook } from "@/components/icons";

const preferenceKey = "chest-ai:sidebar-collapsed";
const preferenceEvent = "chest-ai:sidebar-change";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(preferenceEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(preferenceEvent, callback);
  };
}
let temporaryPreference = false;
function snapshot() {
  try { return localStorage.getItem(preferenceKey) === "true"; } catch { return temporaryPreference; }
}
function togglePreference() {
  temporaryPreference = !snapshot();
  try { localStorage.setItem(preferenceKey, String(temporaryPreference)); } catch { /* Private storage may be unavailable. */ }
  window.dispatchEvent(new Event(preferenceEvent));
}
const items = [
  { href: "/", name: "검사 대시보드", Icon: IconGrid },
  { href: "/analysis", name: "영상 분석", Icon: IconClassify },
  { href: "/evidence", name: "근거 시각화", Icon: IconCrosshair },
  { href: "/agent", name: "AI 어시스턴트", Icon: IconConsult },
  { href: "/literature", name: "문헌·증례 검색", Icon: IconBook },
];
export function Sidebar() {
  const path = usePathname();
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b" || event.repeat || event.altKey || event.shiftKey) return;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=textbox]")) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      event.preventDefault();
      togglePreference();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  return (
    <aside className={`app-sidebar sticky top-0 z-40 hidden h-screen shrink-0 flex-col lg:flex ${collapsed ? "is-collapsed" : ""}`} aria-label="주 메뉴">
      <Link href="/" className="brand-lockup" aria-label="Chest AI 검사 대시보드">
        <BrandMark />
        {!collapsed && <span className="brand-wordmark"><strong>Chest<span>AI</span></strong><small>영상과 근거를 잇다</small></span>}
      </Link>
      <button className="sidebar-toggle" type="button" onClick={togglePreference} aria-expanded={!collapsed} aria-controls="workspace-navigation" aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"} title={`${collapsed ? "펼치기" : "접기"} · ⌘ / Ctrl + B`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16"/><path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"}/></svg>
        {!collapsed && <><span>사이드바 접기</span><kbd>⌘ / Ctrl B</kbd></>}
      </button>
      <nav id="workspace-navigation" aria-label="워크스페이스 메뉴">
        {items.map(({ href, name, Icon }) => (
          <Link key={href} href={href} aria-label={name} aria-current={path === href ? "page" : undefined} className="sidebar-link">
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="sidebar-link-label">{name}</span>}
            {collapsed && <span className="sidebar-tooltip" aria-hidden="true">{name}</span>}
            {path === href && <span className="nav-current-dot" aria-hidden="true"/>}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footnote">
        <span className="research-seal" title="연구용 · 의료진의 검토가 필요합니다" aria-label="연구용 · 의료진의 검토가 필요합니다" tabIndex={collapsed ? 0 : undefined}>R</span>
        {!collapsed && <div><strong>Research workspace</strong><p>AI 결과는 검토용 초안입니다.<br/>의료진의 확인이 필요합니다.</p></div>}
      </div>
    </aside>
  );
}
