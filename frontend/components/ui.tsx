import type { ReactNode } from "react";
import type { Level } from "@/lib/data";
import { IconCheck, IconAlert } from "@/components/icons";

/* ---------- containers ---------- */

export function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  return <Tag className={`panel ${className}`}>{children}</Tag>;
}

export function PanelHead({
  title,
  sub,
  action,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 pt-4 pb-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight text-ink">{title}</h2>
        {sub && <p className="mt-1 text-[12px] leading-snug text-ink-3">{sub}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* Latin-only micro label (11px mono uppercase) */
export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`microlabel ${className}`}>{children}</span>;
}

/* ---------- status ---------- */

const tone: Record<Level, { text: string; fill: string; wash: string }> = {
  critical: { text: "var(--critical-text)", fill: "var(--critical-fill)", wash: "var(--critical-wash)" },
  warning: { text: "var(--warning-text)", fill: "var(--warning-fill)", wash: "var(--warning-wash)" },
  ok: { text: "var(--ok-text)", fill: "var(--ok-fill)", wash: "var(--ok-wash)" },
  info: { text: "var(--info-text)", fill: "var(--info-fill)", wash: "var(--info-wash)" },
  neutral: { text: "var(--ink-2)", fill: "var(--ink-3)", wash: "rgba(90,100,114,0.08)" },
};

export function toneOf(level: Level) {
  return tone[level];
}

/* Status chip: 24px pill, dot + label, wash bg, no border. */
export function Chip({
  level,
  children,
  pulse,
}: {
  level: Level;
  children: ReactNode;
  pulse?: boolean;
}) {
  const t = tone[level];
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium"
      style={{ background: t.wash, color: t.text }}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${pulse ? "pulse-dot" : ""}`}
        style={{ background: t.fill }}
      />
      {children}
    </span>
  );
}

/* Quiet filled tag (metadata, not status) */
export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full bg-surface-2 px-2.5 text-[12px] font-medium text-ink-2 ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- data viz ---------- */

/*
 * Probability row: 4px track + operating-threshold tick. Integer % in mono.
 * Below threshold: muted fill + muted label. At/above: teal (critical: red).
 */
export function ProbBar({
  value,
  threshold,
  level = "neutral",
  className = "",
}: {
  value: number;
  threshold?: number;
  level?: Level;
  className?: string;
}) {
  const above = threshold === undefined || value >= threshold;
  const fill = !above
    ? "rgba(151,160,171,0.55)"
    : level === "critical"
      ? "var(--critical-fill)"
      : "var(--accent-fill)";
  return (
    <div className={`relative h-1 w-full rounded-sm bg-hairline ${className}`}>
      <div
        className="grow-bar absolute inset-y-0 left-0 rounded-sm"
        style={{ width: `${Math.round(value * 100)}%`, background: fill }}
      />
      {threshold !== undefined && (
        <span
          className="absolute top-1/2 h-2 w-px -translate-y-1/2"
          style={{ left: `${Math.round(threshold * 100)}%`, background: "var(--ink-3)" }}
        />
      )}
    </div>
  );
}

/* Neutral score number + colored status dot. Numbers are never colored. */
export function ScoreDot({
  value,
  level,
  size = "md",
}: {
  value: ReactNode;
  level: Level;
  size?: "md" | "sm";
}) {
  const t = tone[level];
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === "md" ? "text-[13px]" : "text-[12px]"}`}>
      <span className="mono font-semibold text-ink tnum">{value}</span>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fill }} />
    </span>
  );
}

/* ---------- callout ---------- */

export function Callout({
  level = "info",
  icon,
  children,
  className = "",
}: {
  level?: Level;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = tone[level];
  return (
    <div
      className={`flex gap-2.5 rounded-lg p-3.5 text-[13px] leading-relaxed text-ink-2 ${className}`}
      style={{ background: t.wash }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: t.text }}>
        {icon ?? (level === "ok" ? <IconCheck className="h-4 w-4" /> : <IconAlert className="h-4 w-4" />)}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ---------- regulatory chrome ---------- */

/* Model engraving on every AI output */
export function ModelStamp({ className = "" }: { className?: string }) {
  return (
    <p className={`mono text-right text-[11px] tracking-wide text-ink-3 ${className}`}>
      CXR-NET V2.4 · 2026-07-13 09:41
    </p>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-ink-3 ${className}`}>
      AI 생성 참고 정보입니다 — 최종 판단은 판독의의 몫입니다.
    </p>
  );
}

/* ---------- buttons ---------- */

/* Primary: exactly one per screen (teal budget). */
export function PrimaryButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent-fill px-4 text-[13px] font-semibold text-accent-ink shadow-accent transition-all duration-150 ease-out hover:bg-accent-strong active:scale-[0.97] ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-surface-2 px-3 text-[12.5px] font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-hover hover:text-ink active:scale-[0.97] ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- misc ---------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Dot({ level }: { level: Level }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: tone[level].fill }}
    />
  );
}

/* Evidence-grade badge for literature sources */
export function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, Level> = {
    가이드라인: "info",
    논문: "ok",
    "유사 사례": "warning",
  };
  return <Chip level={map[grade] ?? "neutral"}>{grade}</Chip>;
}

/* Citation chip: numbered pill or [영상] image-evidence deep link */
export function CiteChip({
  kind,
  label,
}: {
  kind: "paper" | "image";
  label: string;
}) {
  return (
    <a
      href={kind === "image" ? "/evidence" : "/literature"}
      className="mx-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1.5 align-[2px] text-[10.5px] font-semibold leading-none no-underline transition-colors duration-150"
      style={{
        background: kind === "image" ? "rgba(14,116,144,0.1)" : "var(--accent-wash)",
        color: kind === "image" ? "#0e7490" : "var(--accent-text)",
      }}
    >
      {label}
    </a>
  );
}
