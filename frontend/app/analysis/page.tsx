"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Panel,
  PanelHead,
  Chip,
  Tag,
  ProbBar,
  MicroLabel,
  PrimaryButton,
  Callout,
  ModelStamp,
  Disclaimer,
} from "@/components/ui";
import { Film, ViewerToolbar, PatientStrip, type Overlay, type Preset } from "@/components/film";
import { Rich } from "@/components/rich";
import { LocatorGlyph, IconArrowRight, IconPaperclip, IconChevronDown, IconCheck } from "@/components/icons";
import { analysisSteps, filmCorners, filmView, topFinding } from "@/lib/demo/cases";
import { useDemo, useCurrentCase } from "@/lib/demo/store";
import { runAnalysis } from "@/lib/demo/api";
import { Aborted } from "@/lib/demo/delay";
import { useCountUp, formatBytes } from "@/lib/demo/hooks";
import type { Level } from "@/lib/data";

type StepState = "waiting" | "active" | "done";

export default function AnalysisPage() {
  const { actions } = useDemo();
  const { c, analyzed, clinical, upload } = useCurrentCase();

  const [steps, setSteps] = useState<StepState[] | null>(null); // non-null while running
  const [revealKey, setRevealKey] = useState(0); // bump to replay result animations
  const [addingSymptom, setAddingSymptom] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>("끄기");
  const [opacity, setOpacity] = useState(0.4);
  const [preset, setPreset] = useState<Preset>("폐");
  const [zoom, setZoom] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = steps !== null;
  const corner = filmCorners(c);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function start() {
    if (running) return;
    setSteps(analysisSteps.map(() => "waiting"));
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      for await (const ev of runAnalysis(c.id, ac.signal)) {
        if (ev.event === "step") {
          setSteps((s) => s && s.map((st, i) => (i === ev.index ? (ev.status === "start" ? "active" : "done") : st)));
        } else {
          actions.setAnalyzed(c.id, true);
          setRevealKey((k) => k + 1);
          setSteps(null);
        }
      }
    } catch (e) {
      if (!(e instanceof Aborted)) throw e;
      setSteps(null);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    /* real radiographs render straight from memory; a .dcm is accepted by
       name only (the browser cannot decode DICOM) and keeps the sample film */
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : "/xray/pa.png";
    actions.setUpload(c.id, { url, name: f.name, size: formatBytes(f.size) });
    actions.setAnalyzed(c.id, false);
    e.target.value = "";
  }

  function removeSymptom(s: string) {
    actions.setClinical(c.id, { symptoms: clinical.symptoms.filter((x) => x !== s) });
  }

  function addSymptom(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setAddingSymptom(false);
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const v = e.currentTarget.value.trim();
    if (v && !clinical.symptoms.includes(v)) actions.setClinical(c.id, { symptoms: [...clinical.symptoms, v] });
    e.currentTarget.value = "";
    setAddingSymptom(false);
  }

  const img = c.images;
  const paSrc = upload?.url ?? img?.pa ?? "/xray/pa.png";
  /* real model heatmap only applies to the study it was computed on */
  const realHeat = analyzed && !upload && img?.gradcam ? img.gradcam : null;
  const fileName = upload?.name ?? c.patient.file.name;
  const fileSize = upload?.size ?? c.patient.file.size;
  const stale = !analyzed && !running;
  /* viewer overlay shows the top finding's regions once results exist */
  const regions = analyzed ? c.regions[topFinding(c).en] ?? [] : [];
  const viewer = { preset, zoom };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* ---- input row: viewer + clinical info ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]">
        <Panel className="anim-rise flex flex-col overflow-hidden">
          <PatientStrip name={c.patient.name} meta={`${c.id} · ${c.patient.accession}`} right={<Tag>{c.patient.view} + 비교 1건</Tag>} />
          <ViewerToolbar
            overlay={overlay}
            onOverlay={setOverlay}
            opacity={opacity}
            onOpacity={setOpacity}
            preset={preset}
            onPreset={setPreset}
            zoom={zoom}
            onZoom={setZoom}
          />
          <div className="grid flex-1 grid-cols-2 gap-2 bg-letterbox p-2">
            <Film
              key={paSrc}
              src={paSrc}
              label={filmView(c).toUpperCase()}
              meta={upload ? "업로드 · 방금" : overlay !== "끄기" ? `AI 감지 ${regions.length}건` : "0.4s · 109 kVp"}
              ratio="4 / 5"
              corner={corner}
              view={filmView(c)}
              outline={overlay !== "끄기" && regions.length > 0}
              variant={overlay === "히트맵" && regions.length > 0 ? "gradcam" : "plain"}
              heatSrc={overlay === "히트맵" && realHeat ? realHeat : undefined}
              regions={regions}
              overlayOpacity={Math.min(1, opacity * 2)}
              swatch={overlay === "히트맵" && regions.length > 0 ? "jet" : undefined}
              {...viewer}
            />
            <Film src="/xray/prior.jpeg" label="PRIOR PA" meta="2025-11 · 비교" corners={false} ratio="4 / 5" {...viewer} />
          </div>
        </Panel>

        <Panel className="anim-rise flex flex-col">
          <PanelHead title="임상 정보" sub="영상과 함께 분석에 반영되는 입력" action={<Chip level="ok">기록 연동됨</Chip>} />
          <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              <Field label="환자 ID" value={c.id} mono />
              <Field label="나이 · 성별" value={c.patient.ageSex} />
              <Field label="체온" value={`${c.patient.temp.toFixed(1)} ℃`} mono warn={c.patient.temp >= 37.5} />
              <Field label="산소포화도" value={`${c.patient.spo2} %`} mono warn={c.patient.spo2 < 96} />
              <Field label="혈압" value={c.patient.bp} mono />
              <Field label="흡연력" value={c.patient.smoking} select />
            </div>

            <div>
              <FieldLabel>주요 증상</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {clinical.symptoms.map((s) => (
                  <span key={s} className="anim-rise inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-medium text-ink">
                    {s}
                    <button type="button" onClick={() => removeSymptom(s)} aria-label={`${s} 삭제`} className="text-ink-3 transition-colors hover:text-ink">
                      ×
                    </button>
                  </span>
                ))}
                {addingSymptom ? (
                  <input
                    autoFocus
                    onKeyDown={addSymptom}
                    onBlur={() => setAddingSymptom(false)}
                    placeholder="증상 입력 후 Enter"
                    className="h-7 w-36 rounded-full bg-surface-2 px-3 text-[12.5px] text-ink outline-none placeholder:text-ink-3"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingSymptom(true)}
                    className="inline-flex h-7 items-center rounded-full border border-dashed border-line px-3 text-[12.5px] font-medium text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
                  >
                    + 추가
                  </button>
                )}
              </div>
            </div>

            <div>
              <FieldLabel>임상 메모</FieldLabel>
              <textarea
                value={clinical.note}
                onChange={(e) => actions.setClinical(c.id, { note: e.target.value })}
                rows={3}
                className="min-h-[64px] w-full resize-none rounded-md bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2 outline-none transition-shadow focus:shadow-e2 focus:text-ink"
              />
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-between rounded-md border border-dashed border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-2">
                <IconPaperclip className="h-4 w-4 shrink-0 text-ink-3" />
                <span className="mono truncate">{fileName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="mono text-[11px] text-ink-3">{fileSize}</span>
                <span className="text-[11.5px] font-medium text-accent">교체</span>
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*,.dcm" onChange={onFile} className="hidden" />

            <PrimaryButton className="mt-auto w-full" onClick={start} disabled={running}>
              {running ? (
                <>
                  <span className="pulse-dot h-2 w-2 rounded-full bg-accent-ink" />
                  분석 중
                </>
              ) : (
                <>
                  {analyzed ? "멀티모달 분석 다시 실행" : "멀티모달 분석 실행"}
                  <IconArrowRight className="h-4 w-4" />
                </>
              )}
            </PrimaryButton>
          </div>
        </Panel>
      </div>

      {/* ---- results row ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,300px)_minmax(0,1.35fr)_minmax(300px,1fr)]">
        <ScorePanel score={c.abnormalityScore} ready={analyzed && !running} running={running} revealKey={revealKey} />

        <Panel className="anim-rise">
          <PanelHead
            title="소견별 확률"
            sub="14개 소견 동시 평가 · 상위 8개 표시"
            action={<Tag>{c.patient.view === "PA" ? "정면" : "정면 + 측면"} + 임상 정보</Tag>}
          />
          <div className="px-5 pb-5">
            {running && steps ? (
              <Progress steps={steps} />
            ) : analyzed ? (
              <div key={revealKey} className="flex flex-col gap-[15px]">
                {c.findings.map((f, i) => (
                  <div key={f.en} className="anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <LocatorGlyph loc={f.loc} className="h-5 w-5 shrink-0 text-ink-3" tone="var(--ink-2)" />
                      <span className="min-w-0 truncate text-[13px] font-medium text-ink">{f.ko}</span>
                      <span className="microlabel hidden sm:inline">{f.en}</span>
                      <span className="ml-auto flex items-center gap-2.5">
                        <span className="hidden text-[11.5px] text-ink-3 2xl:inline">{f.note}</span>
                        <span className="mono w-10 text-right text-[13px] font-semibold text-ink tnum">{Math.round(f.prob * 100)}%</span>
                      </span>
                    </div>
                    <ProbBar value={f.prob} threshold={f.threshold} level={f.level} delay={i * 50} />
                  </div>
                ))}
                <p className="text-[11px] text-ink-3">세로선 = 소견별 운영 임계값. 임계값 미만 소견은 회색으로 표시됩니다.</p>
              </div>
            ) : (
              <Empty
                title={upload ? "영상이 교체되었습니다" : "아직 분석하지 않은 검사입니다"}
                sub="멀티모달 분석 실행을 누르면 영상과 임상 정보를 함께 평가해 소견별 확률을 표시합니다."
              />
            )}
          </div>
        </Panel>

        <Panel className="anim-rise flex flex-col">
          <PanelHead title="AI 판독 요약" sub="구조화 소견 초안 · 판독의 검토용" />
          <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5">
            {running ? (
              <SkeletonLines />
            ) : analyzed ? (
              <div key={revealKey} className="anim-rise flex flex-1 flex-col gap-3.5">
                <p className="text-[13px] leading-relaxed text-ink-2">
                  <Rich text={c.summary.lead} />
                </p>
                <div className="flex flex-col gap-2">
                  {c.summary.rows.map((r, i) => (
                    <div
                      key={r.k}
                      className="anim-rise flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5"
                      style={{ animationDelay: `${120 + i * 60}ms` }}
                    >
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${r.tone === "neutral" ? "ink-3" : `${r.tone}-fill`})` }} />
                        {r.k}
                      </span>
                      <span className="text-[11.5px] text-ink-3">{r.note}</span>
                    </div>
                  ))}
                </div>
                <Callout level={c.summary.calloutLevel}>{c.summary.callout}</Callout>
              </div>
            ) : (
              <Empty title="요약 대기" sub={stale ? "분석 후 소견 초안이 작성됩니다." : ""} />
            )}
            <div className="mt-auto flex items-end justify-between gap-3 pt-1">
              <Disclaimer />
              <ModelStamp />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function ScorePanel({ score, ready, running, revealKey }: { score: number; ready: boolean; running: boolean; revealKey: number }) {
  const shown = useCountUp(ready ? score : 0, revealKey);
  const level: Level = score >= 75 ? "critical" : score >= 50 ? "warning" : "ok";
  const label = score >= 50 ? "ABNORMAL" : "WITHIN RANGE";
  return (
    <Panel className="anim-rise flex flex-col px-5 py-4">
      <MicroLabel>ABNORMALITY SCORE</MicroLabel>
      <div className="mt-4 flex items-center gap-3">
        <span className="mono text-[44px] font-bold leading-none tracking-tight text-ink tnum">{ready ? shown : "—"}</span>
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${running ? "pulse-dot" : ""}`} style={{ background: ready ? `var(--${level}-fill)` : "var(--ink-3)" }} />
            <MicroLabel className="!text-ink-2">{running ? "ANALYZING" : ready ? label : "PENDING"}</MicroLabel>
          </span>
          <span className="text-[11px] text-ink-3">{ready ? (score >= 50 ? "임계값 50 초과" : "임계값 50 미만") : "임계값 50"}</span>
        </span>
      </div>
      <div className="mt-4">
        {ready ? <ProbBar key={revealKey} value={score / 100} threshold={0.5} level={level} /> : <div className="h-1 w-full rounded-sm bg-hairline" />}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-2">
        {ready ? (
          score >= 50 ? (
            <>
              14개 소견을 종합한 이상 소견 지표입니다. 임계값을 초과해 <b className="font-semibold text-ink">판독의 확인</b>이 필요합니다.
            </>
          ) : (
            <>
              14개 소견을 종합한 이상 소견 지표입니다. 임계값 미만이며 <b className="font-semibold text-ink">판독의 확인</b> 후 종료할 수 있습니다.
            </>
          )
        ) : (
          "14개 소견을 종합한 이상 소견 지표입니다. 분석 후 표시됩니다."
        )}
      </p>
      <ModelStamp className="mt-auto pt-4" />
    </Panel>
  );
}

function Progress({ steps }: { steps: StepState[] }) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {analysisSteps.map((s, i) => {
        const st = steps[i];
        return (
          <div key={s.name} className="flex items-center gap-3">
            {st === "done" ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok-wash text-ok">
                <IconCheck className="h-3 w-3" />
              </span>
            ) : st === "active" ? (
              <span className="flex h-5 w-5 items-center justify-center">
                <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-accent-fill" />
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full border border-line-strong" />
              </span>
            )}
            <div className="min-w-0">
              <p className={st === "active" ? "shimmer-text text-[13px] font-medium" : st === "done" ? "text-[13px] font-medium text-ink" : "text-[13px] text-ink-3"}>
                {s.name}
                {st === "active" && "…"}
              </p>
              <p className="text-[11.5px] text-ink-3">{s.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SkeletonLines() {
  return (
    <div className="flex flex-col gap-2.5 py-1" aria-hidden="true">
      {[100, 92, 76].map((w, i) => (
        <span key={i} className="pulse-dot block h-3 rounded-sm bg-surface-2" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
      ))}
      <p className="shimmer-text mt-2 text-[12.5px] font-medium">소견 초안 작성 중…</p>
    </div>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md bg-surface-2 px-3.5 py-3">
      <p className="text-[12.5px] font-medium text-ink">{title}</p>
      {sub && <p className="text-[11.5px] leading-relaxed text-ink-3">{sub}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11.5px] font-medium text-ink-3">{children}</p>;
}

function Field({ label, value, mono, select, warn }: { label: string; value: string; mono?: boolean; select?: boolean; warn?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={`flex h-9 items-center justify-between rounded-md bg-surface-2 px-3 text-[13px] font-medium tnum ${mono ? "mono" : ""}`}
        style={{ color: warn ? "var(--warning-text)" : "var(--ink)" }}
      >
        {value}
        {select && <IconChevronDown className="h-3.5 w-3.5 text-ink-3" />}
      </div>
    </div>
  );
}
