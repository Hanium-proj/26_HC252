"use client";
import { PageHeading, Select, Toggle, Disclosure } from "@/components/controls";
import { WorkflowLink as Link } from "@/components/workflow";
import { useSessionValue } from "@/lib/live/session";
import { NextActions } from "@/components/workflow";
import { useWorkspace } from "@/lib/live/store";
import {
  Card,
  Empty,
  StudySelect,
  Viewer,
  Limitations,
} from "@/components/live";
export default function EvidencePage() {
  const { studies, selected, select } = useWorkspace();
  const [target, setTarget] = useSessionValue(
    `evidence-target:${selected?.id ?? "none"}`,
    "",
  );
  const [overlay, setOverlay] = useSessionValue(
    `evidence-overlay:${selected?.id ?? "none"}`,
    true,
  );
  const [mode, setMode] = useSessionValue(
    `evidence-mode:${selected?.id ?? "none"}`,
    "cam",
  );
  const findings = selected?.analysis?.classifier.findings ?? [];
  const finding = findings.find((f) => f.name === target) ?? findings[0];
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeading
        eyebrow="VISUAL EVIDENCE"
        title="판단의 근거를 눈으로 확인하세요"
        description="활성 지도와 해부학적 분할을 원본 영상에 겹쳐 비교합니다."
      />
      <StudySelect studies={studies} selected={selected} onChange={select} />
      {selected?.analysis ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
          <Card
            title={
              mode === "anatomy" ? "폐·심장 해부학적 분할" : "실제 Grad-CAM"
            }
            sub={
              mode === "anatomy"
                ? "실제 PSPNet 출력 · 청록색 폐, 주황색 심장"
                : "해당 입력 영상의 분류 모델 기울기로 계산한 활성 지도"
            }
          >
            <Viewer
              study={selected}
              cam={
                overlay
                  ? mode === "anatomy"
                    ? selected.analysis.segmentation?.mask_url
                    : finding?.cam_url
                  : null
              }
            />
          </Card>
          <Card
            title="소견별 모델 근거"
            sub="모델 점수와 활성 영역은 진단 확률·병변 크기를 뜻하지 않습니다."
          >
            <div className="mb-4 block text-sm">
              근거 레이어
              <div className="mt-2">
                <Select
                  label="근거 레이어"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "cam", label: "소견별 활성 지도 · Grad-CAM" },
                    {
                      value: "anatomy",
                      label: "폐·심장 해부학적 분할",
                      disabled: !selected.analysis.segmentation,
                    },
                  ]}
                />
              </div>
            </div>
            <div className="block text-sm">
              대상 소견
              <div className="mt-2">
                <Select
                  label="CAM 대상 소견"
                  value={finding?.name ?? ""}
                  disabled={mode === "anatomy"}
                  onChange={setTarget}
                  options={findings.map((f) => ({
                    value: f.name,
                    label: f.name,
                  }))}
                />
              </div>
            </div>
            <Toggle
              label="원본 위에 레이어 표시"
              checked={overlay}
              onChange={setOverlay}
            />
            {finding && mode === "cam" && (
              <dl className="my-6 space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt>모델 점수</dt>
                  <dd className="font-mono">{finding.score.toFixed(4)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>활성 영역 비율 (CAM ≥ 0.5)</dt>
                  <dd className="font-mono">
                    {finding.activation_fraction === null
                      ? "산출 불가"
                      : `${(finding.activation_fraction * 100).toFixed(1)}%`}
                  </dd>
                </div>
              </dl>
            )}
            {mode === "anatomy" && selected.analysis.segmentation && (
              <dl className="mb-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>분할된 폐 영역 비율</dt>
                  <dd>
                    {(
                      selected.analysis.segmentation.lung_fraction * 100
                    ).toFixed(1)}
                    %
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>심장/폐영역 픽셀 폭 비율</dt>
                  <dd>
                    {selected.analysis.segmentation.heart_to_lung_span_ratio?.toFixed(
                      3,
                    ) ?? "산출 불가"}
                  </dd>
                </div>
              </dl>
            )}
            <Disclosure title="해석 시 유의사항">
              <Limitations items={selected.analysis.limitations} />
            </Disclosure>
            <p className="mt-5 text-xs leading-relaxed text-ink-3">
              중앙 크롭 밖은 CAM을 표시하지 않습니다. 해부학적 분할은 병변
              분할이 아닙니다. 물리적 mm 측정과 임상 CTR은 제공하지 않습니다.
            </p>
          </Card>
        </div>
      ) : (
        <Empty>
          먼저{" "}
          <Link href="/analysis" className="text-accent">
            실제 분석을 실행해 주세요 →
          </Link>
        </Empty>
      )}
      {selected?.analysis && <NextActions finding={finding?.name} />}
    </div>
  );
}
