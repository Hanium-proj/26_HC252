"use client";
import { WorkflowLink as Link } from "@/components/workflow";
import { usePathname } from "next/navigation";
import {
  BrandMark,
  IconGrid,
  IconClassify,
  IconCrosshair,
  IconConsult,
  IconBook,
} from "@/components/icons";
const items = [
  { href: "/", name: "검사 대시보드", Icon: IconGrid },
  { href: "/analysis", name: "영상 분석", Icon: IconClassify },
  { href: "/evidence", name: "근거 시각화", Icon: IconCrosshair },
  { href: "/agent", name: "AI 어시스턴트", Icon: IconConsult },
  { href: "/literature", name: "문헌·증례 검색", Icon: IconBook },
];
export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="app-sidebar sticky top-0 z-20 hidden h-screen shrink-0 flex-col lg:flex">
      <div className="mb-10 flex items-center gap-3">
        <BrandMark />
        <div>
          <p className="font-semibold">Chest AI</p>
          <p className="microlabel mt-1">IMAGING WORKSPACE</p>
        </div>
      </div>
      <p className="microlabel mb-3 px-2">WORKSPACE</p>
      <nav className="space-y-1">
        {items.map(({ href, name, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${path === href ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2"}`}
          >
            <Icon className="h-5 w-5" />
            {name}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        연구용 진단 지원 프로토타입
        <br />
        실제 업로드 · 실제 모델 · 실제 문헌
        <br />
        <span className="text-warning">
          임상 성능 검증 전 · 판독의 검토 필요
        </span>
      </div>
    </aside>
  );
}
