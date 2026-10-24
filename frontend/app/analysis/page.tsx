"use client";
import { PageHeading, Select } from "@/components/controls";
import { WorkflowLink as Link } from "@/components/workflow";
import { useEffect, useRef, useState } from "react";
import { useSessionValue } from "@/lib/live/session";
import { NextActions } from "@/components/workflow";
import { useWorkspace } from "@/lib/live/store";
import type { Study } from "@/lib/live/types";
import {
  buttonClass,
  inputClass,
  Card,
  Empty,
  ErrorBox,
  Limitations,
  StudySelect,
  Viewer,
} from "@/components/live";
export default function AnalysisPage() {
  const { studies, selected, select, error, loading } = useWorkspace();
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeading
        eyebrow="IMAGE ANALYSIS"
        title="영상에서 소견으로"
        description="흉부 영상을 분석하고, 주요 소견과 모델이 참고한 영역을 검토하세요."
      />
      <StudySelect studies={studies} selected={selected} onChange={select} />
      <ErrorBox message={error} />
      {selected ? (
        <AnalysisForm key={selected.id} study={selected} />
      ) : (
        <Empty>
          <Link className="text-accent" href="/">
            {loading
              ? "검사 목록을 불러오는 중…"
              : "대시보드에서 영상을 업로드해 주세요 →"}
          </Link>
        </Empty>
      )}
    </div>
  );
}
function AnalysisForm({ study }: { study: Study }) {
  const { studies, jobs, runAnalysis } = useWorkspace();
  const [draft, setDraft] = useSessionValue<Study["clinical"]>(
    `clinical:${study.id}`,
    study.clinical,
  );
  const note = draft.note,
    patientRef = draft.patient_ref ?? "",
    priorId = draft.prior_id ?? "";
  const setNote = (note: string) => setDraft((prev) => ({ ...prev, note }));
  const setPatientRef = (patient_ref: string) =>
    setDraft((prev) => ({ ...prev, patient_ref }));
  const setPriorId = (prior_id: string) =>
    setDraft((prev) => ({ ...prev, prior_id: prior_id || null }));
  const busy = jobs[study.id]?.status === "running";
  const operation = jobs[study.id]?.analyze === false ? "저장" : "분석";
  const [elapsed, setElapsed] = useState(0);
  const saved = study.clinical;
  const analysis = study.analysis;
  const [notice, setNotice] = useState("");
  const [reveal, setReveal] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!busy) return;
    const started = jobs[study.id]?.started ?? Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [busy, jobs, study.id]);
  useEffect(() => {
    if (!reveal || busy) return;
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }, [reveal, busy]);
  const [error, setError] = useState(
    jobs[study.id]?.status === "error" ? jobs[study.id].message : "",
  );
  const dirty =
    note !== saved.note ||
    priorId !== (saved.prior_id ?? "") ||
    patientRef !== (saved.patient_ref ?? "");
  const result = !dirty && !busy ? analysis : null;
  async function run(analyze = true) {
    if (busy) return;
    setElapsed(0);
    setNotice("");
    setError("");
    const clinical = {
      note,
      prior_id: priorId || null,
      patient_ref: patientRef.trim(),
    };
    try {
      await runAnalysis(study, clinical, analyze);
      setDraft(clinical);
      setNotice(
        analyze
          ? "분석이 완료되었습니다. 아래 결과와 영상 근거를 확인하세요."
          : "임상 정보를 저장했습니다. 분석 실행 시 결과가 생성됩니다.",
      );
      if (analyze) setReveal((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${study.id}-analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={`analysis-status ${error ? "!border-red-200 !bg-red-50" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              {busy && (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent motion-reduce:animate-none"
                />
              )}
              {busy
                ? `${operation} 중 · ${elapsed}초 경과`
                : error
                  ? "처리 실패 · 다시 시도해 주세요"
                  : result
                    ? "✓ 분석 완료"
                    : dirty
                      ? "입력 변경 · 재분석 필요"
                      : "분석 대기"}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {busy
                ? "완료되면 결과로 자동 이동합니다. 다른 메뉴로 이동해도 분석은 계속됩니다."
                : error ||
                  notice ||
                  (result
                    ? `${new Date(result.completed_at).toLocaleString("ko-KR")} · 처리 ${(result.latency_ms / 1000).toFixed(1)}초`
                    : "임상 정보는 선택 사항입니다. 분석 실행 버튼을 눌러 시작하세요.")}
            </p>
          </div>
          {result && (
            <button
              className={buttonClass}
              onClick={() => setReveal((value) => value + 1)}
            >
              결과 보기 ↓
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
        <Card title="01 · 입력 영상" sub={`${study.name} · 실제 업로드 영상`}>
          <Viewer study={study} />
        </Card>
        <Card
          title="02 · 분석 조건"
          sub="입력한 정보만 분석에 사용합니다. 없는 수치나 환자 정보는 추정하지 않습니다."
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              익명 환자 식별자 (비교 시 필수)
              <input
                aria-label="익명 환자 식별자"
                value={patientRef}
                disabled={busy}
                maxLength={80}
                onChange={(e) => {
                  setPatientRef(e.target.value);
                  setPriorId("");
                }}
                className={`${inputClass} mt-2`}
                placeholder="같은 환자의 검사에 동일한 익명 식별자를 입력"
              />
            </label>
            <label className="block text-sm font-medium">
              증상 · 활력징후 · 임상 메모
              <textarea
                aria-label="임상 메모"
                disabled={busy}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                maxLength={6000}
                className={`${inputClass} mt-2 resize-y`}
                placeholder="임상 정보를 입력해 주세요 (선택)"
              />
            </label>
            <div className="block text-sm font-medium">
              비교할 이전 영상
              <div className="mt-2">
                <Select
                  label="비교할 이전 영상"
                  disabled={busy}
                  value={priorId}
                  onChange={setPriorId}
                  options={[
                    { value: "", label: "비교 없이 현재 영상만 분석" },
                    ...studies
                      .filter(
                        (s) =>
                          s.id !== study.id &&
                          patientRef.trim() &&
                          s.clinical.patient_ref === patientRef.trim(),
                      )
                      .map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </div>
            </div>
            <p className="text-xs leading-relaxed text-ink-2">
              {!patientRef.trim()
                ? "이전 영상과 비교하려면 두 검사에 동일한 익명 환자 식별자를 저장하세요."
                : !studies.some(
                      (s) =>
                        s.id !== study.id &&
                        s.clinical.patient_ref === patientRef.trim(),
                    )
                  ? "동일한 환자 식별자로 저장된 이전 검사가 없습니다. 이전 영상을 등록하고 같은 식별자를 저장하면 선택할 수 있습니다."
                  : "같은 환자 식별자로 저장된 검사만 비교 목록에 표시됩니다."}
            </p>
            <p className="text-xs leading-relaxed text-ink-3">
              영상·메모를 OpenAI에 전송해 설명을 생성합니다. 분류·CAM은 로컬
              연구 모델로 계산합니다. 이전 영상은 직접 선택한 경우에만
              비교합니다.
            </p>
            <button
              className={`${buttonClass} w-full`}
              disabled={busy}
              onClick={() => run()}
            >
              {busy
                ? `${operation} 중… ${elapsed}초`
                : error
                  ? "다시 시도"
                  : result
                    ? "다시 분석"
                    : "실제 분석 실행"}
            </button>
            <button
              type="button"
              disabled={busy || !dirty}
              className="text-sm text-accent disabled:opacity-40"
              onClick={() => run(false)}
            >
              임상 정보만 저장
            </button>
            <ErrorBox message={error} />
            {dirty && (
              <div className="draft-notice">
                <p>
                  수정 초안은 메뉴 이동 시 유지됩니다. 새로고침 전에는 저장해
                  주세요.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="text-accent text-xs"
                  onClick={() => setDraft(study.clinical)}
                >
                  수정 취소 · 저장값으로 복원
                </button>
              </div>
            )}
            {dirty && (
              <p className="text-xs text-warning">
                입력이 변경되어 이전 결과를 숨겼습니다. 다시 분석해 주세요.
              </p>
            )}
          </div>
        </Card>
      </div>
      {result ? (
        <section
          ref={resultsRef}
          tabIndex={-1}
          aria-label="분석 결과"
          className="scroll-mt-64 lg:scroll-mt-44 space-y-5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <Card
            title="분석 완료 · 주요 소견"
            sub="AI가 생성한 검토용 초안입니다. 의료진의 확인이 필요합니다."
          >
            <p className="whitespace-pre-wrap leading-relaxed">
              {result.report.impression}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/evidence" className={buttonClass}>
                영상 근거 확인 →
              </Link>
              <Link href="/agent" className={buttonClass}>
                AI에게 결과 질문 →
              </Link>
            </div>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="분류 모델 출력"
              sub={`${result.classifier.model} · ${result.classifier.findings.length}개 소견 · 보정되지 않은 점수`}
            >
              <div className="space-y-3">
                {result.classifier.findings.map((f) => (
                  <div key={f.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{f.name}</span>
                      <span className="font-mono">{f.score.toFixed(3)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent-fill"
                        style={{ width: `${f.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card
              title="영상 설명 · 검토용 초안"
              sub={`${result.vision_model} · ${result.report.view} · 영상 품질 ${result.report.quality}`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                {result.report.impression}
              </p>
              <div className="mt-5 space-y-3">
                {result.report.observations.map((o, i) => (
                  <div
                    key={`${o.finding}-${i}`}
                    className="rounded-lg bg-surface-2 p-3"
                  >
                    <p className="text-sm font-medium">
                      {o.finding} · {o.location}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">
                      {o.description}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">
                      관찰 상태: {o.certainty}
                    </p>
                  </div>
                ))}
              </div>
              {result.report.comparison && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
                  비교: {result.report.comparison}
                </p>
              )}
              <div className="mt-5 flex gap-4">
                <Link
                  href="/evidence"
                  className="text-sm font-medium text-accent"
                >
                  실제 CAM 확인 →
                </Link>
                <button className="text-sm text-accent" onClick={download}>
                  분석 JSON 저장
                </button>
              </div>
            </Card>
          </div>
          <NextActions />
          <Card
            title="처리 정보와 한계"
            sub={`전체 ${(result.latency_ms / 1000).toFixed(2)}초 · 로컬 모델 ${(result.classifier.latency_ms / 1000).toFixed(2)}초 · ${new Date(result.completed_at).toLocaleString("ko-KR")}`}
          >
            <Limitations
              items={[...result.limitations, ...result.report.quality_issues]}
            />
          </Card>
        </section>
      ) : (
        !busy && (
          <Empty>
            실제 분석을 실행하면 모델 점수와 영상 설명이 표시됩니다.
          </Empty>
        )
      )}
    </>
  );
}
