"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api } from "./api";
import type { Analysis, Study } from "./types";
export type AnalysisJob = {
  status: "running" | "complete" | "error";
  name: string;
  started: number;
  message: string;
  analyze: boolean;
};
type Workspace = {
  studies: Study[];
  selected: Study | null;
  select: (id: string) => void;
  href: (path: string) => string;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string;
  missing: boolean;
  jobs: Record<string, AnalysisJob>;
  dismissJob: (id: string) => void;
  runAnalysis: (
    study: Study,
    clinical: Study["clinical"],
    analyze: boolean,
  ) => Promise<Analysis | null>;
};
const Context = createContext<Workspace | null>(null);
const fetchStudies = (path: string) => api<Study[]>(path);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<Study[]>(
    "/studies",
    fetchStudies,
    { dedupingInterval: 2000, revalidateOnFocus: true },
  );
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const id = params.get("study");
  const [jobs, setJobs] = useState<Record<string, AnalysisJob>>({});
  const locks = useRef(new Set<string>());
  const studies = useMemo(() => data ?? [], [data]);
  const selected = id
    ? (studies.find((s) => s.id === id) ?? null)
    : (studies[0] ?? null);
  const select = useCallback(
    (next: string) => {
      const query = new URLSearchParams(params.toString());
      query.set("study", next);
      router.push(`${path}?${query}`, { scroll: false });
    },
    [params, path, router],
  );
  const href = useCallback(
    (target: string) => {
      const [base, hash] = target.split("#");
      const [route, search] = base.split("?");
      const query = new URLSearchParams(search);
      if (!query.has("study") && (id || selected?.id))
        query.set("study", id || selected!.id);
      return `${route}${query.size ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
    },
    [id, selected],
  );
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const dismissJob = useCallback(
    (key: string) =>
      setJobs((all) => {
        const next = { ...all };
        if (next[key]?.status !== "running") delete next[key];
        return next;
      }),
    [],
  );
  const runAnalysis = useCallback(
    async (study: Study, clinical: Study["clinical"], analyze: boolean) => {
      if (locks.current.has(study.id))
        throw new Error(
          "이 검사는 이미 처리 중입니다. 완료 알림을 기다려 주세요.",
        );
      locks.current.add(study.id);
      const start = { name: study.name, started: Date.now(), analyze };
      setJobs((all) => ({
        ...all,
        [study.id]: {
          ...start,
          status: "running",
          message: analyze ? "영상 분석 중" : "임상 정보 저장 중",
        },
      }));
      try {
        await api(`/studies/${study.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clinical),
        });
        // Invalidate old analysis immediately, including on other pages.
        await mutate(
          (all) =>
            all?.map((s) =>
              s.id === study.id ? { ...s, clinical, analysis: null } : s,
            ),
          { revalidate: false },
        );
        const result = analyze
          ? await api<Analysis>("/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ case_id: study.id }),
            })
          : null;
        await mutate(
          (all) =>
            all?.map((s) =>
              s.id === study.id ? { ...s, clinical, analysis: result } : s,
            ),
          { revalidate: false },
        );
        setJobs((all) => ({
          ...all,
          [study.id]: {
            ...start,
            status: "complete",
            message: analyze
              ? "분석 완료 · 결과를 확인하세요"
              : "임상 정보 저장 완료",
          },
        }));
        void mutate().catch(() => {});
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : "처리에 실패했습니다";
        setJobs((all) => ({
          ...all,
          [study.id]: { ...start, status: "error", message },
        }));
        void mutate().catch(() => {});
        throw e;
      } finally {
        locks.current.delete(study.id);
      }
    },
    [mutate],
  );
  return (
    <Context.Provider
      value={{
        studies,
        selected,
        select,
        href,
        refresh,
        loading: isLoading,
        error:
          error instanceof Error
            ? error.message
            : error
              ? "서버 연결 실패"
              : "",
        missing: !!id && !isLoading && !error && !selected,
        jobs,
        dismissJob,
        runAnalysis,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("WorkspaceProvider required");
  return context;
}
