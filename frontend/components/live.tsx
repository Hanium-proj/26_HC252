"use client";
import { useState, type ReactNode } from "react";
import { useWorkspace } from "@/lib/live/store";
import { Select, Disclosure } from "./controls";
import type { Source, Study } from "@/lib/live/types";

export const buttonClass = "btn-primary";
export const inputClass = "field-input";
export function Card({
  title,
  sub,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-card ${className}`}>
      <h2 className="card-title">{title}</h2>
      {sub && <p className="card-description">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-lg bg-critical-wash px-4 py-3 text-sm text-critical"
    >
      {message}
    </p>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function StudySelect({
  studies,
  selected,
  onChange,
}: {
  studies: Study[];
  selected: Study | null;
  onChange: (id: string) => void;
}) {
  const { jobs } = useWorkspace();
  const running = !!selected && jobs[selected.id]?.status === "running";
  return (
    <div className="study-bar">
      <div className="study-label">
        <span className="study-icon" aria-hidden="true">
          ▣
        </span>
        <div>
          <span className="eyebrow">CURRENT STUDY</span>
          <p>현재 검사</p>
        </div>
      </div>
      <div className="study-picker">
        <Select
          label="현재 검사"
          value={selected?.id ?? ""}
          onChange={onChange}
          placeholder="검사를 먼저 업로드하세요"
          options={studies.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
      {selected && (
        <span
          className={`status-pill ${selected.analysis ? "is-complete" : ""}`}
        >
          <span />
          {running
            ? "분석 진행 중"
            : selected.analysis
              ? "분석 완료 · 검토 필요"
              : "분석 대기"}
        </span>
      )}
    </div>
  );
}
export function Viewer({ study, cam }: { study: Study; cam?: string | null }) {
  const [opacity, setOpacity] = useState(0.6);
  const [zoom, setZoom] = useState(1);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 pb-3 text-xs text-ink-2">
        <label>
          확대 {Math.round(zoom * 100)}%{" "}
          <input
            aria-label="영상 확대"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        {cam && (
          <label>
            레이어 {Math.round(opacity * 100)}%{" "}
            <input
              aria-label="레이어 불투명도"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
        )}
        <button
          type="button"
          className="ml-auto rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2"
          onClick={() => {
            setZoom(1);
            setOpacity(0.6);
          }}
        >
          보기 초기화 ↺
        </button>
      </div>
      <div
        className="overflow-auto rounded-xl bg-[#11161c]"
        style={{ maxHeight: 540 }}
      >
        <div
          className="relative mx-auto"
          style={{
            width: `${zoom * 100}%`,
            maxWidth: `${(zoom * 540 * study.width) / study.height}px`,
          }}
        >
          <img
            src={study.image_url}
            alt={`${study.name} 원본 흉부 영상`}
            className="block h-auto w-full"
          />
          {cam && (
            <img
              src={cam}
              alt="실제 모델 근거 레이어"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ opacity }}
            />
          )}
        </div>
      </div>
      <p className="mt-2 font-mono text-xs text-ink-3">
        {study.width} × {study.height} · 원본 영상에서 메타데이터 제거 후 저장
      </p>
    </div>
  );
}
export function Sources({ hits }: { hits: Source[] }) {
  if (!hits.length) return <Empty>검색된 문헌이 없습니다.</Empty>;
  return (
    <div className="space-y-3">
      {hits.map((hit, index) => (
        <article key={hit.id} className="source-card">
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-ink-3">
            <span>
              [{index + 1}] {hit.id}
            </span>
            <span>{hit.year ?? "연도 미상"}</span>
            <span>{hit.publication_types.join(" · ")}</span>
          </div>
          <p className="text-sm font-semibold leading-relaxed">
            {hit.url && /^https?:\/\//.test(hit.url) ? (
              <a
                href={hit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {hit.title} ↗
              </a>
            ) : (
              hit.title
            )}
            {hit.page ? (
              <span className="ml-2 text-xs text-ink-3">p.{hit.page}</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-ink-3">{hit.authors}</p>
          <Disclosure
            title={`근거 본문 보기 · 유사도 ${hit.relevance.toFixed(3)}`}
          >
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">
              {hit.abstract}
            </p>
          </Disclosure>
        </article>
      ))}
    </div>
  );
}
export function Limitations({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-xs leading-relaxed text-ink-3">
      {Array.from(new Set(items)).map((text) => (
        <li key={text}>• {text}</li>
      ))}
    </ul>
  );
}
