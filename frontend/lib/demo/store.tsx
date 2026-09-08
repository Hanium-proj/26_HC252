"use client";

/*
 * Demo session state shared across screens: which case is open, which
 * cases have been analyzed, edited clinical inputs, chat transcripts,
 * live tool-call counters and the last literature query. Persisted to
 * sessionStorage so a hard reload between takes keeps the story;
 * uploads (object URLs) live in memory only. `reset()` returns the
 * whole demo to its opening state for a fresh recording.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { ChatMsg } from "@/lib/data";
import { CASES, DEFAULT_CASE_ID, INITIAL_ANALYZED, getCase, type CaseData } from "./cases";
import type { ToolName, Verdict } from "./agent-script";

export type Upload = { url: string; name: string; size: string };
export type Clinical = { symptoms: string[]; note: string };

type State = {
  hydrated: boolean;
  selectedCaseId: string;
  analyzed: Record<string, boolean>;
  clinical: Record<string, Clinical>;
  chat: Record<string, ChatMsg[]>;
  toolCalls: Record<ToolName, number>;
  verdicts: Record<string, Verdict>;
  literature: Record<string, string>;
  uploads: Record<string, Upload>;
};

type Persisted = Omit<State, "hydrated" | "uploads">;

const STORAGE_KEY = "chest-ai-demo-v1";

const initialState: State = {
  hydrated: false,
  selectedCaseId: DEFAULT_CASE_ID,
  analyzed: { ...INITIAL_ANALYZED },
  clinical: {},
  chat: {},
  toolCalls: { "흉부 영상 분석": 0, "문헌 검색": 0, "임상 정보 분석": 0, "웹 검색": 0 },
  verdicts: {},
  literature: {},
  uploads: {},
};

type Action =
  | { type: "hydrate"; state: Partial<Persisted> }
  | { type: "selectCase"; id: string }
  | { type: "setAnalyzed"; id: string; value: boolean }
  | { type: "setClinical"; id: string; patch: Partial<Clinical> }
  | { type: "setChat"; id: string; messages: ChatMsg[] }
  | { type: "bumpTool"; tool: ToolName }
  | { type: "setVerdict"; id: string; verdict: Verdict }
  | { type: "setLiterature"; id: string; query: string }
  | { type: "setUpload"; id: string; upload: Upload | null }
  | { type: "reset" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return { ...s, ...a.state, hydrated: true };
    case "selectCase":
      return CASES[a.id] ? { ...s, selectedCaseId: a.id } : s;
    case "setAnalyzed":
      return { ...s, analyzed: { ...s.analyzed, [a.id]: a.value } };
    case "setClinical": {
      const base = s.clinical[a.id] ?? { symptoms: getCase(a.id).patient.symptoms, note: getCase(a.id).patient.note };
      return { ...s, clinical: { ...s.clinical, [a.id]: { ...base, ...a.patch } } };
    }
    case "setChat":
      return { ...s, chat: { ...s.chat, [a.id]: a.messages } };
    case "bumpTool":
      return { ...s, toolCalls: { ...s.toolCalls, [a.tool]: (s.toolCalls[a.tool] ?? 0) + 1 } };
    case "setVerdict":
      return { ...s, verdicts: { ...s.verdicts, [a.id]: a.verdict } };
    case "setLiterature":
      return { ...s, literature: { ...s.literature, [a.id]: a.query } };
    case "setUpload": {
      const uploads = { ...s.uploads };
      if (a.upload) uploads[a.id] = a.upload;
      else delete uploads[a.id];
      return { ...s, uploads };
    }
    case "reset":
      return { ...initialState, hydrated: true };
  }
}

function load(): Partial<Persisted> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

function save(s: State) {
  try {
    const { hydrated: _h, uploads: _u, ...rest } = s;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* private mode / quota: the demo still works in memory */
  }
}

type Actions = {
  selectCase: (id: string) => void;
  setAnalyzed: (id: string, value: boolean) => void;
  setClinical: (id: string, patch: Partial<Clinical>) => void;
  setChat: (id: string, messages: ChatMsg[]) => void;
  bumpTool: (tool: ToolName) => void;
  setVerdict: (id: string, verdict: Verdict) => void;
  setLiterature: (id: string, query: string) => void;
  setUpload: (id: string, upload: Upload | null) => void;
  reset: () => void;
};

type Ctx = { state: State; actions: Actions };

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: "hydrate", state: load() });
  }, []);

  useEffect(() => {
    if (state.hydrated) save(state);
  }, [state]);

  const actions = useMemo<Actions>(
    () => ({
      selectCase: (id) => dispatch({ type: "selectCase", id }),
      setAnalyzed: (id, value) => dispatch({ type: "setAnalyzed", id, value }),
      setClinical: (id, patch) => dispatch({ type: "setClinical", id, patch }),
      setChat: (id, messages) => dispatch({ type: "setChat", id, messages }),
      bumpTool: (tool) => dispatch({ type: "bumpTool", tool }),
      setVerdict: (id, verdict) => dispatch({ type: "setVerdict", id, verdict }),
      setLiterature: (id, query) => dispatch({ type: "setLiterature", id, query }),
      setUpload: (id, upload) => dispatch({ type: "setUpload", id, upload }),
      reset: () => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        dispatch({ type: "reset" });
      },
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): Ctx {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}

/* The case currently open, plus its live derived bits */
export function useCurrentCase(): {
  c: CaseData;
  analyzed: boolean;
  clinical: Clinical;
  upload: Upload | null;
  verdict: Verdict | null;
} {
  const { state } = useDemo();
  const c = getCase(state.selectedCaseId);
  const clinical = state.clinical[c.id] ?? { symptoms: c.patient.symptoms, note: c.patient.note };
  return {
    c,
    analyzed: state.analyzed[c.id] ?? false,
    clinical,
    upload: state.uploads[c.id] ?? null,
    verdict: state.verdicts[c.id] ?? null,
  };
}

export function useSelectCase() {
  const { actions } = useDemo();
  return useCallback((id: string) => actions.selectCase(id), [actions]);
}
