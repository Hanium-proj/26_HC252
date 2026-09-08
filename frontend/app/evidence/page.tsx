"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel, PanelHead, Chip, Tag, ProbBar, MicroLabel, Callout, ModelStamp, GhostButton } from "@/components/ui";
import { Film, ViewerToolbar, PatientStrip, type Overlay } from "@/components/film";
import { IconCrosshair, IconArrowRight } from "@/components/icons";
import { localizationMetrics } from "@/lib/data";
import { filmCorners, topFinding } from "@/lib/demo/cases";
import { useCurrentCase } from "@/lib/demo/store";

export default function EvidencePage() {
  const { c, analyzed, upload } = useCurrentCase();
  const [overlay, setOverlay] = useState<Overlay>("히트맵");
  const [opacity, setOpacity] = useState(0.4);
  const [targetEn, setTargetEn] = useState<string | null>(null);

  /* findings that actually produced a region on this study */
  const targets = c.findings.filter((f) => (c.regions[f.en] ?? []).length > 0);
  const target = targets.find((f) => f.en === targetEn) ?? (targets.length ? targets.find((f) => f.en === topFinding(c).en) ?? targets[0] : null);
  const regions = analyzed && target ? c.regions[target.en] ?? [] : [];
  const metric = target ? localizationMetrics.find((m) => m.en === target.en) : undefined;
  const agree = metric ? metric.mIoU >= 0.55 : false;

  const corner = filmCorners(c);
  const src = upload?.url ?? "/xray/pa.png";
  const heat = overlay === "히트맵";
  const outline = overlay !== "끄기";
  const overlayOpacity = Math.min(1, opacity * 2);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {!analyzed && (
        <Callout level="info" className="anim-rise">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            아직 분석하지 않은 검사입니다. 분류 분석을 먼저 실행하면 근거 영역이 여기에 표시됩니다.
            <Link href="/analysis">
              <GhostButton className="!h-7 !bg-surface-1 shadow-e1">
                분류 분석으로 이동
                <IconArrowRight className="h-3.5 w-3.5" />
              </GhostButton>
            </Link>
          </span>
        </Callout>
      )}

      {/* ---- image evidence: original vs Grad-CAM vs Eigen-CAM ---- */}
      <Panel className="anim-rise overflow-hidden">
        <PatientStrip
          name={c.patient.name}
          meta={`${c.id} · ${c.patient.accession}`}
          right={
            <div className="flex items-center gap-2">
              <Tag>대상 소견 · {target ? target.ko : "없음"}</Tag>
              {target ? (
                <Chip level={agree ? "ok" : "warning"}>{agree ? "근거 위치 일치" : "일치도 보통"}</Chip>
              ) : (
                <Chip level="neutral">근거 영역 없음</Chip>
              )}
            </div>
          }
        />
        <ViewerToolbar overlay={overlay} onOverlay={setOverlay} opacity={opacity} onOpacity={setOpacity} />
        <div className="grid grid-cols-2 gap-2 bg-letterbox p-2 xl:grid-cols-4">
          <Film key={`o-${src}`} src={src} label="PA · OUTLINE" meta={`AI 감지 ${regions.length}건`} outline={outline} regions={regions} corner={corner} />
          <Film key={`g-${src}`} src={src} label="GRAD-CAM" variant={heat ? "gradcam" : "plain"} outline={!heat && outline} regions={regions} overlayOpacity={overlayOpacity} swatch="jet" corners={false} />
          <Film key={`e-${src}`} src={src} label="EIGEN-CAM" variant={heat ? "eigencam" : "plain"} outline={!heat && outline} regions={regions} overlayOpacity={overlayOpacity} swatch="teal" corners={false} />
          <Film src="/xray/ct-axial.png" label="CT AXIAL" meta="LUNG WINDOW · 대조" corners={false} fit="contain" />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          {targets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11.5px] text-ink-3">대상 소견</span>
              {targets.map((f) => {
                const on = target?.en === f.en;
                return (
                  <button
                    key={f.en}
                    type="button"
                    onClick={() => setTargetEn(f.en)}
                    aria-pressed={on}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors duration-150"
                    style={on ? { background: "var(--accent-wash-2)", color: "var(--accent-strong)" } : { background: "var(--surface-2)", color: "var(--ink-2)" }}
                  >
                    {f.ko}
                    <span className="mono text-[11px] tnum opacity-80">{Math.round(f.prob * 100)}%</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[11.5px] text-ink-3">{analyzed ? "모델이 주목한 영역이 없습니다 — 폐야 전반 활성도 균일" : "분석 후 대상 소견을 선택할 수 있습니다"}</span>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
              <span className="inline-block h-0 w-6 border-t-[1.8px] border-accent" />
              실선 = 확신 90% 초과
            </span>
            <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
              <span className="inline-block h-0 w-6 border-t-[1.8px] border-dashed border-accent" />
              점선 = 의심 구간 50–90%
            </span>
          </span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ---- clinical text contribution ---- */}
        <Panel className="anim-rise">
          <PanelHead title="임상 문장 기여도" sub="의무기록의 어떤 문장이 판단에 기여했는지" action={<Tag>언어 근거</Tag>} />
          <div className="flex flex-col gap-5 px-5 pb-5">
            <div className="flex flex-col gap-2">
              {c.sentenceImportance.map((s, i) => (
                <div key={s.text} className="anim-rise rounded-md bg-surface-2 px-3.5 py-2.5" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] leading-relaxed text-ink">“{s.text}”</span>
                    <span className="mono shrink-0 text-[12px] font-semibold text-ink tnum">{s.weight.toFixed(2)}</span>
                  </div>
                  <ProbBar value={s.weight} className="mt-2" level={s.weight >= 0.5 ? "info" : "neutral"} threshold={0.5} delay={i * 50} />
                </div>
              ))}
            </div>

            <div>
              <MicroLabel>KEYWORD CONTRIBUTION</MicroLabel>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {c.tokenImportance.map((t) => (
                  <span
                    key={t.token}
                    className="inline-flex h-7 items-center gap-2 rounded-full px-3 text-[12.5px] font-medium"
                    style={{
                      background: `rgba(11, 216, 182, ${0.04 + t.weight * 0.14})`,
                      color: t.weight >= 0.5 ? "var(--accent-text)" : "var(--ink-2)",
                    }}
                  >
                    {t.token}
                    <span className="mono text-[10.5px] opacity-70 tnum">{t.weight.toFixed(2)}</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-ink-3">색 농도 = 기여 강도. 임상 문장은 영상과 함께 이중 근거로 반영됩니다.</p>
            </div>
          </div>
        </Panel>

        {/* ---- localization metrics ---- */}
        <Panel className="anim-rise flex flex-col">
          <PanelHead title="근거 위치 정량 평가" sub="CheXlocalize 기준 · 병변 위치 일치도" action={<MicroLabel>N = 668 STUDIES</MicroLabel>} />
          <div className="flex flex-1 flex-col px-5 pb-5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="h-9 text-left text-[12px] font-medium text-ink-2">소견</th>
                  <th className="h-9 text-right text-[12px] font-medium text-ink-2">mIoU</th>
                  <th className="h-9 text-right text-[12px] font-medium text-ink-2">적중률</th>
                  <th className="h-9 w-[104px] pl-4 text-left text-[12px] font-medium text-ink-2">일치도</th>
                </tr>
              </thead>
              <tbody>
                {localizationMetrics.map((m) => {
                  const on = target?.en === m.en;
                  return (
                    <tr
                      key={m.ko}
                      className="h-10 border-b border-hairline transition-colors duration-150 last:border-b-0"
                      style={on ? { background: "var(--accent-wash)" } : undefined}
                    >
                      <td className={`pl-2 text-[13px] font-medium ${on ? "text-accent-strong" : "text-ink"}`}>
                        {m.ko}
                        <span className="microlabel ml-2 hidden lg:inline">{m.en}</span>
                      </td>
                      <td className="mono text-right text-[12.5px] text-ink-2 tnum">{m.mIoU.toFixed(2)}</td>
                      <td className="mono text-right text-[12.5px] text-ink-2 tnum">{m.hitRate.toFixed(2)}</td>
                      <td className="pl-4 pr-2">
                        <ProbBar value={m.mIoU} threshold={0.5} level={m.mIoU >= 0.55 ? "info" : "warning"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {target && metric ? (
              <Callout key={target.en} level={agree ? "ok" : "warning"} icon={<IconCrosshair className="h-4 w-4" />} className="anim-rise mt-4">
                {target.ko} 소견의 근거 영역이 실제 병변 위치와 {agree ? "높게" : "부분적으로"} 일치합니다 (mIoU {metric.mIoU.toFixed(2)} · 적중률 {metric.hitRate.toFixed(2)}).
                {agree ? " 분류 정확도와 근거 신뢰도를 함께 검증했습니다." : " 판독의가 위치를 직접 확인하는 것을 권고합니다."}
              </Callout>
            ) : (
              <Callout level="ok" icon={<IconCrosshair className="h-4 w-4" />} className="mt-4">
                이 검사에서는 임계값을 넘는 소견이 없어 위치 근거를 계산하지 않았습니다. 표는 모델 검증 세트 기준 소견별 일치도입니다.
              </Callout>
            )}
            <ModelStamp className="mt-auto pt-4" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
