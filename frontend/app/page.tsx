"use client";
import { PageHeading, Loading } from "@/components/controls";
import { WorkflowLink as Link } from "@/components/workflow";
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/live/api";
import { useWorkspace } from "@/lib/live/store";
import type { Study } from "@/lib/live/types";
import {
  Card,
  Empty,
  ErrorBox,
  buttonClass,
  inputClass,
} from "@/components/live";
const maxUploadMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 15);

export default function Dashboard() {
  const { studies, refresh, loading, error, jobs } = useWorkspace();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [query, setQuery] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) await uploadFile(selectedFile);
  }
  async function uploadFile(selectedFile: File) {
    if (uploading) return;
    setDragging(false);
    setUploading(true);
    setUploadError("");
    try {
      if (selectedFile.size > maxUploadMb * 1024 * 1024)
        throw new Error(`영상은 ${maxUploadMb}MB 이하여야 합니다`);
      const body = new FormData();
      body.append("file", selectedFile);
      const study = await api<Study>("/studies", { method: "POST", body });
      await refresh();
      router.push(`/analysis?study=${study.id}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }
  const complete = studies.filter((s) => s.analysis).length;
  const times = studies.flatMap((s) =>
    s.analysis ? [s.analysis.latency_ms] : [],
  );
  const metrics = [
    ["등록된 검사", `${studies.length}건`],
    ["분석 완료", `${complete}건`],
    [
      "분석 대기",
      `${studies.filter((s) => !s.analysis && jobs[s.id]?.status !== "running").length}건`,
    ],
    [
      "평균 분석 응답",
      times.length
        ? `${(times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1)}초`
        : "측정 전",
    ],
  ];
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeading
        eyebrow="READING ROOM"
        title="오늘의 검사 워크스페이스"
        description="영상 업로드부터 근거 검토까지, 한 곳에서 이어가세요."
      >
        <button
          className={buttonClass}
          disabled={uploading}
          onClick={() => file.current?.click()}
        >
          {uploading ? "영상 확인·저장 중…" : "+ 새 X-ray 업로드"}
        </button>
        <input
          aria-label="흉부 영상 업로드"
          ref={file}
          type="file"
          accept="image/png,image/jpeg,.dcm"
          onChange={upload}
          className="hidden"
        />
      </PageHeading>
      <ErrorBox message={uploadError || error} />
      <div className="metric-grid grid grid-cols-2 gap-4 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label} title={label}>
            <p className="font-mono text-3xl font-semibold">
              {loading ? "—" : value}
            </p>
          </Card>
        ))}
      </div>
      <div
        className={`upload-surface ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) void uploadFile(dropped);
        }}
      >
        <div className="upload-symbol" aria-hidden="true">
          ↥
        </div>
        <div className="flex-1">
          <h2>
            {dragging
              ? "여기에 놓으면 업로드됩니다"
              : "새로운 검사를 시작하세요"}
          </h2>
          <p>
            흉부 영상을 끌어 놓거나 파일을 선택하세요. PNG · JPEG · DICOM, 최대
            {maxUploadMb}MB
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={uploading}
          onClick={() => file.current?.click()}
        >
          {uploading ? "업로드 중…" : "파일 선택 →"}
        </button>
      </div>
      <div className="workflow-strip">
        {[
          ["01", "영상 등록", "PNG · JPEG · DICOM"],
          ["02", "AI 분석", "소견과 시각적 근거 확인"],
          ["03", "근거 검토", "AI 질문과 문헌으로 이어가기"],
        ].map(([n, t, d]) => (
          <div className="workflow-step" key={n}>
            <b>{n}</b>
            <div>
              <strong>{t}</strong>
              <p>{d}</p>
            </div>
          </div>
        ))}
      </div>
      {uploading && <Loading label="영상을 확인하고 저장하고 있습니다" />}
      <Card
        title="검사 워크리스트"
        sub={`업로드한 실제 검사만 표시합니다. PNG·JPEG·단일 프레임 흑백 DICOM, 최대 ${maxUploadMb}MB.`}
      >
        <input
          aria-label="검사 검색"
          className={`${inputClass} mb-4 max-w-md`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="파일명 또는 검사 ID 검색"
        />
        {loading ? (
          <Loading label="검사 목록을 불러오고 있습니다" />
        ) : !studies.length ? (
          <Empty>등록된 검사가 없습니다. 새 X-ray를 업로드해 주세요.</Empty>
        ) : (
          <div className="overflow-x-auto">
            {!studies.some((s) =>
              `${s.name} ${s.id}`.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <Empty>
                검색어와 일치하는 검사가 없습니다. 파일명 또는 검사 ID를
                확인하세요.
              </Empty>
            )}
            <table className="study-table w-full text-left text-sm">
              <thead className="text-xs text-ink-3">
                <tr>
                  {[
                    "검사 파일",
                    "등록 시간",
                    "분석 상태",
                    "처리 시간",
                    "열기",
                  ].map((h) => (
                    <th key={h} className="p-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studies
                  .filter((s) =>
                    `${s.name} ${s.id}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((s) => (
                    <tr key={s.id} className="border-t border-hairline">
                      <td className="p-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 font-mono text-xs text-ink-3">
                          {s.id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="p-3 text-ink-2">
                        {new Date(s.created_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="p-3 text-ink-2">
                        <span
                          className={`status-pill ${s.analysis ? "is-complete" : ""}`}
                        >
                          <span />
                          {jobs[s.id]?.status === "running"
                            ? "분석 중"
                            : s.analysis
                              ? "분석 완료"
                              : "분석 대기"}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        {s.analysis
                          ? `${(s.analysis.latency_ms / 1000).toFixed(1)}초`
                          : "—"}
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/analysis?study=${s.id}`}
                          className="btn-secondary"
                        >
                          검사 열기 →
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-ink-3">
        업로드 영상과 임상 메모는 작업 공간 서버에 저장되며 분석 요청 시 OpenAI로
        전달됩니다. 연구용이며 진료 결정을 대체하지 않습니다.
      </p>
    </div>
  );
}
