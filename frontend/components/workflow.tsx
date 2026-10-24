"use client";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useWorkspace } from "@/lib/live/store";
import { useSessionValue, appendQuestionDraft } from "@/lib/live/session";
import type { Study } from "@/lib/live/types";
export function WorkflowLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const { href: resolve } = useWorkspace();
  return (
    <NextLink {...props} href={href.startsWith("/") ? resolve(href) : href} />
  );
}
export function WorkflowBar() {
  const { selected, loading, error, missing, refresh, jobs, dismissJob } =
    useWorkspace();
  const path = usePathname();
  const [draft] = useSessionValue<Study["clinical"] | null>(
    `clinical:${selected?.id ?? "none"}`,
    null,
  );
  const dirty =
    !!selected &&
    !!draft &&
    (draft.note !== selected.clinical.note ||
      (draft.patient_ref ?? "") !== (selected.clinical.patient_ref ?? "") ||
      (draft.prior_id ?? "") !== (selected.clinical.prior_id ?? ""));
  const active = selected ? jobs[selected.id]?.status === "running" : false;
  return (
    <div className="workspace-flow">
      {error && (
        <div role="alert" className="flow-notice is-error">
          <div>
            <strong>검사 서버에 연결하지 못했습니다</strong>
            <p>{error}</p>
          </div>
          <button className="btn-secondary" onClick={() => void refresh()}>
            다시 연결
          </button>
        </div>
      )}
      {missing && (
        <div role="alert" className="flow-notice is-error">
          <div>
            <strong>이 검사 ID를 찾을 수 없습니다</strong>
            <p>
              다른 검사로 자동 전환하지 않았습니다. 목록에서 검사를 다시
              선택하세요.
            </p>
          </div>
          <NextLink className="btn-secondary" href="/">
            검사 목록 열기
          </NextLink>
        </div>
      )}
      {!loading && !error && !missing && path !== "/" && (
        <nav aria-label="검토 흐름" className="journey-nav">
          {[
            ["/", "01", "검사 등록", selected ? "등록됨" : "시작하기"],
            [
              "/analysis",
              "02",
              "영상 분석",
              active
                ? "분석 중"
                : selected?.analysis
                  ? "분석 완료"
                  : selected
                    ? "분석 필요"
                    : "영상 필요",
            ],
            [
              "/evidence",
              "03",
              "근거 확인",
              selected?.analysis ? "확인 가능" : "분석 후 이용",
            ],
            [
              "/agent",
              "04",
              "질문 · 검토",
              selected?.analysis ? "검사 기반 질문" : "일반 문헌 질문",
            ],
            ["/literature", "05", "문헌 검색", "언제든 검색"],
          ].map(([href, n, title, state]) => (
            <WorkflowLink
              key={href}
              href={href}
              className={`journey-item ${path === href ? "is-current" : ""}`}
              aria-current={path === href ? "step" : undefined}
            >
              <span>{n}</span>
              <div>
                <strong>{title}</strong>
                <small>{state}</small>
              </div>
            </WorkflowLink>
          ))}
        </nav>
      )}
      {dirty && path !== "/analysis" && path !== "/" && (
        <div className="flow-notice">
          <div>
            <strong>분석 조건의 수정 초안이 있습니다</strong>
            <p>
              현재 화면은 마지막으로 저장한 조건의 결과입니다. 수정 내용은 아직
              분석에 반영되지 않았습니다.
            </p>
          </div>
          <WorkflowLink className="btn-secondary" href="/analysis">
            수정 이어가기 →
          </WorkflowLink>
        </div>
      )}
      {Object.entries(jobs)
        .filter(([id]) => path !== "/analysis" || id !== selected?.id)
        .map(([id, job]) => (
          <div
            className={`flow-notice ${job.status === "error" ? "is-error" : ""}`}
            role="status"
            key={id}
          >
            <div>
              <strong>
                {job.status === "running"
                  ? "◌ "
                  : job.status === "complete"
                    ? "✓ "
                    : "! "}
                {job.name}
              </strong>
              <p>
                {job.message}
                {job.status === "running"
                  ? " · 다른 메뉴를 둘러봐도 계속 진행됩니다. 새로고침은 피해주세요."
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <NextLink
                href={`/analysis?study=${id}`}
                className="btn-secondary"
              >
                {job.status === "error" ? "다시 시도" : "검사 열기"} →
              </NextLink>
              {job.status !== "running" && (
                <button
                  type="button"
                  aria-label={`${job.name} 알림 닫기`}
                  className="p-2"
                  onClick={() => dismissJob(id)}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
export function NextActions({ finding }: { finding?: string }) {
  const path = usePathname();
  const { selected } = useWorkspace();
  const [, setQuery] = useSessionValue(
    `search-query:${selected?.id ?? "general"}`,
    "",
  );
  const [, setQuestion] = useSessionValue(
    `question:${selected?.id ?? "general"}:${selected?.analysis?.completed_at ?? "pending"}`,
    "",
  );
  return (
    <div className="next-actions">
      <div>
        <span className="eyebrow">CONTINUE REVIEW</span>
        <strong>
          {finding ? `${finding} 소견을 더 살펴보기` : "검토를 이어가세요"}
        </strong>
        <p>선택한 검사와 질문 맥락을 다음 화면에 전달합니다.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {path !== "/evidence" && (
          <WorkflowLink href="/evidence" className="btn-secondary">
            영상 근거 →
          </WorkflowLink>
        )}
        <WorkflowLink
          href="/agent"
          className="btn-primary"
          onClick={() =>
            setQuestion((previous) =>
              appendQuestionDraft(
                previous,
                finding
                  ? `현재 영상의 ${finding} 소견과 해석의 한계를 설명해줘.`
                  : "현재 영상의 주요 소견과 근거를 정리해줘.",
              ),
            )
          }
        >
          AI에게 질문 →
        </WorkflowLink>
        <WorkflowLink
          href="/literature"
          className="btn-secondary"
          onClick={() =>
            setQuery(
              `${finding ?? selected?.analysis?.classifier.findings[0]?.name ?? "흉부 X-ray"} chest radiograph findings`,
            )
          }
        >
          관련 문헌 →
        </WorkflowLink>
      </div>
    </div>
  );
}
