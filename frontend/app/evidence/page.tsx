import {
  Panel,
  PanelHead,
  Chip,
  Tag,
  ProbBar,
  MicroLabel,
  Callout,
  ModelStamp,
} from "@/components/ui";
import { Film, ViewerToolbar, PatientStrip } from "@/components/film";
import { IconCrosshair } from "@/components/icons";
import { patient, sentenceImportance, tokenImportance, localizationMetrics } from "@/lib/data";

export default function EvidencePage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* ---- image evidence: original vs Grad-CAM vs Eigen-CAM ---- */}
      <Panel className="anim-rise overflow-hidden">
        <PatientStrip
          name={patient.name}
          meta={`${patient.id} · ${patient.accession}`}
          right={
            <div className="flex items-center gap-2">
              <Tag>대상 소견 · 폐렴 의심</Tag>
              <Chip level="ok">근거 위치 일치</Chip>
            </div>
          }
        />
        <ViewerToolbar overlay="히트맵" />
        <div className="grid grid-cols-2 gap-2 bg-letterbox p-2 xl:grid-cols-4">
          <Film src="/xray/pa.png" label="PA · OUTLINE" meta="AI 감지 2건" outline />
          <Film src="/xray/pa.png" label="GRAD-CAM" variant="gradcam" swatch="jet" corners={false} />
          <Film src="/xray/pa.png" label="EIGEN-CAM" variant="eigencam" swatch="teal" corners={false} />
          <Film
            src="/xray/ct-axial.png"
            label="CT AXIAL"
            meta="LUNG WINDOW · 대조"
            corners={false}
            fit="contain"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3">
          <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
            <span className="inline-block h-0 w-6 border-t-[1.8px] border-accent" />
            실선 = 확신 90% 초과
          </span>
          <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
            <span className="inline-block h-0 w-6 border-t-[1.8px] border-dashed border-accent" />
            점선 = 의심 구간 50–90%
          </span>
          <span className="ml-auto text-[11.5px] text-ink-3">
            히트맵은 모델이 주목한 영역의 상대 강도입니다 — 진단이 아닌 판독 참고 정보
          </span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ---- clinical text contribution ---- */}
        <Panel className="anim-rise">
          <PanelHead
            title="임상 문장 기여도"
            sub="의무기록의 어떤 문장이 판단에 기여했는지"
            action={<Tag>언어 근거</Tag>}
          />
          <div className="flex flex-col gap-5 px-5 pb-5">
            <div className="flex flex-col gap-2">
              {sentenceImportance.map((s) => (
                <div key={s.text} className="rounded-md bg-surface-2 px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] leading-relaxed text-ink">“{s.text}”</span>
                    <span className="mono shrink-0 text-[12px] font-semibold text-ink tnum">
                      {s.weight.toFixed(2)}
                    </span>
                  </div>
                  <ProbBar value={s.weight} className="mt-2" level={s.weight >= 0.5 ? "info" : "neutral"} threshold={0.5} />
                </div>
              ))}
            </div>

            <div>
              <MicroLabel>KEYWORD CONTRIBUTION</MicroLabel>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {tokenImportance.map((t) => (
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
              <p className="mt-3 text-[11px] text-ink-3">
                색 농도 = 기여 강도. 임상 문장은 영상과 함께 이중 근거로 반영됩니다.
              </p>
            </div>
          </div>
        </Panel>

        {/* ---- localization metrics ---- */}
        <Panel className="anim-rise flex flex-col">
          <PanelHead
            title="근거 위치 정량 평가"
            sub="CheXlocalize 기준 · 병변 위치 일치도"
            action={<MicroLabel>N = 668 STUDIES</MicroLabel>}
          />
          <div className="flex flex-1 flex-col px-5 pb-5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="h-9 text-left text-[12px] font-medium text-ink-2">소견</th>
                  <th className="h-9 text-right text-[12px] font-medium text-ink-2">mIoU</th>
                  <th className="h-9 text-right text-[12px] font-medium text-ink-2">적중률</th>
                  <th className="h-9 w-[104px] pl-4 text-left text-[12px] font-medium text-ink-2">
                    일치도
                  </th>
                </tr>
              </thead>
              <tbody>
                {localizationMetrics.map((m) => (
                  <tr key={m.ko} className="h-10 border-b border-hairline last:border-b-0">
                    <td className="text-[13px] font-medium text-ink">
                      {m.ko}
                      <span className="microlabel ml-2 hidden lg:inline">{m.en}</span>
                    </td>
                    <td className="mono text-right text-[12.5px] text-ink-2 tnum">{m.mIoU.toFixed(2)}</td>
                    <td className="mono text-right text-[12.5px] text-ink-2 tnum">{m.hitRate.toFixed(2)}</td>
                    <td className="pl-4">
                      <ProbBar value={m.mIoU} threshold={0.5} level={m.mIoU >= 0.55 ? "info" : "warning"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Callout level="ok" icon={<IconCrosshair className="h-4 w-4" />} className="mt-4">
              폐렴 의심 소견의 근거 영역이 실제 병변 위치와 높게 일치합니다 (mIoU 0.61 · 적중률
              0.88). 분류 정확도와 근거 신뢰도를 함께 검증했습니다.
            </Callout>
            <ModelStamp className="mt-auto pt-4" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
