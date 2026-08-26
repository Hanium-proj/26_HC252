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
import { Film, ViewerToolbar, PatientStrip } from "@/components/film";
import { LocatorGlyph, IconArrowRight, IconPaperclip, IconChevronDown } from "@/components/icons";
import { findings, patient, abnormalityScore } from "@/lib/data";

export default function AnalysisPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* ---- input row: viewer + clinical info ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]">
        {/* viewer */}
        <Panel className="anim-rise flex flex-col overflow-hidden">
          <PatientStrip
            name={patient.name}
            meta={`${patient.id} · ${patient.accession}`}
            right={<Tag>PA + 비교 1건</Tag>}
          />
          <ViewerToolbar overlay="끄기" />
          <div className="grid flex-1 grid-cols-2 gap-2 bg-letterbox p-2">
            <Film src="/xray/pa.png" label="PA" meta="0.4s · 109 kVp" ratio="4 / 5" />
            <Film
              src="/xray/prior.jpeg"
              label="PRIOR PA"
              meta="2025-11 · 비교"
              corners={false}
              ratio="4 / 5"
            />
          </div>
        </Panel>

        {/* clinical info */}
        <Panel className="anim-rise flex flex-col">
          <PanelHead
            title="임상 정보"
            sub="영상과 함께 분석에 반영되는 입력"
            action={<Chip level="ok">기록 연동됨</Chip>}
          />
          <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              <Field label="환자 ID" value={patient.id} mono />
              <Field label="나이 · 성별" value="58세 · 여성" />
              <Field label="체온" value="37.8 ℃" mono warn />
              <Field label="산소포화도" value="95 %" mono warn />
              <Field label="혈압" value={patient.bp} mono />
              <Field label="흡연력" value={patient.smoking} select />
            </div>

            <div>
              <FieldLabel>주요 증상</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {patient.symptoms.map((s) => (
                  <span
                    key={s}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-medium text-ink"
                  >
                    {s}
                    <span className="text-ink-3">×</span>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>임상 메모</FieldLabel>
              <div className="min-h-[64px] rounded-md bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
                {patient.note}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-dashed border-line px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <IconPaperclip className="h-4 w-4 text-ink-3" />
                <span className="mono">chest_pa_0142.dcm</span>
              </span>
              <span className="mono text-[11px] text-ink-3">1.7 MB</span>
            </div>

            <PrimaryButton className="mt-auto w-full">
              멀티모달 분석 실행
              <IconArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </Panel>
      </div>

      {/* ---- results row ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,300px)_minmax(0,1.35fr)_minmax(300px,1fr)]">
        {/* hero abnormality score */}
        <Panel className="anim-rise flex flex-col px-5 py-4">
          <MicroLabel>ABNORMALITY SCORE</MicroLabel>
          <div className="mt-4 flex items-center gap-3">
            <span className="mono text-[44px] font-bold leading-none tracking-tight text-ink tnum">
              {abnormalityScore}
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-critical-fill" />
                <MicroLabel className="!text-ink-2">ABNORMAL</MicroLabel>
              </span>
              <span className="text-[11px] text-ink-3">임계값 50 초과</span>
            </span>
          </div>
          <div className="mt-4">
            <ProbBar value={abnormalityScore / 100} threshold={0.5} level="critical" />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-ink-2">
            14개 소견을 종합한 이상 소견 지표입니다. 임계값을 초과해{" "}
            <b className="font-semibold text-ink">판독의 확인</b>이 필요합니다.
          </p>
          <ModelStamp className="mt-auto pt-4" />
        </Panel>

        {/* per-finding probabilities */}
        <Panel className="anim-rise">
          <PanelHead
            title="소견별 확률"
            sub="14개 소견 동시 평가 · 상위 8개 표시"
            action={<Tag>정면 + 측면 + 임상 정보</Tag>}
          />
          <div className="flex flex-col gap-[15px] px-5 pb-5">
            {findings.map((f) => (
              <div key={f.en}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <LocatorGlyph loc={f.loc} className="h-5 w-5 shrink-0 text-ink-3" tone="var(--ink-2)" />
                  <span className="min-w-0 truncate text-[13px] font-medium text-ink">{f.ko}</span>
                  <span className="microlabel hidden sm:inline">{f.en}</span>
                  <span className="ml-auto flex items-center gap-2.5">
                    <span className="hidden text-[11.5px] text-ink-3 md:inline">{f.note}</span>
                    <span className="mono w-10 text-right text-[13px] font-semibold text-ink tnum">
                      {Math.round(f.prob * 100)}%
                    </span>
                  </span>
                </div>
                <ProbBar value={f.prob} threshold={f.threshold} level={f.level} />
              </div>
            ))}
            <p className="text-[11px] text-ink-3">
              세로선 = 소견별 운영 임계값. 임계값 미만 소견은 회색으로 표시됩니다.
            </p>
          </div>
        </Panel>

        {/* AI reading summary */}
        <Panel className="anim-rise flex flex-col">
          <PanelHead title="AI 판독 요약" sub="구조화 소견 초안 · 판독의 검토용" />
          <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5">
            <p className="text-[13px] leading-relaxed text-ink-2">
              58세 여성의 흉부 X-ray와 임상 정보를 종합한 결과{" "}
              <b className="font-semibold text-ink">폐렴 의심(47%)</b>이 최상위 소견입니다. 우하엽
              음영 분포와 마른기침·미열 경과가 판단에 주로 기여했으며,{" "}
              <b className="font-semibold text-ink">폐 음영(43%) · 무기폐(37%)</b>가 감별 대상으로
              남습니다.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { k: "폐렴 의심", note: "영상·임상 근거 일치", tone: "critical" as const },
                { k: "폐 음영 의심", note: "폐렴과 중첩 가능", tone: "warning" as const },
                { k: "무기폐 의심", note: "부피 감소 확인 필요", tone: "warning" as const },
              ].map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: `var(--${r.tone}-fill)` }}
                    />
                    {r.k}
                  </span>
                  <span className="text-[11.5px] text-ink-3">{r.note}</span>
                </div>
              ))}
            </div>
            <Callout level="warning">
              판독자 간 일치도가 낮은 소견이 포함되어 있습니다. 혈액검사·염증 수치와 임상 경과를
              함께 확인하세요.
            </Callout>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11.5px] font-medium text-ink-3">{children}</p>;
}

function Field({
  label,
  value,
  mono,
  select,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  select?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={`flex h-9 items-center justify-between rounded-md bg-surface-2 px-3 text-[13px] font-medium tnum ${
          mono ? "mono" : ""
        }`}
        style={{ color: warn ? "var(--warning-text)" : "var(--ink)" }}
      >
        {value}
        {select && <IconChevronDown className="h-3.5 w-3.5 text-ink-3" />}
      </div>
    </div>
  );
}
