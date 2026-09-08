/*
 * Mock API layer. Every screen talks to these generators instead of the
 * backend, and each one mirrors the contract the real endpoint will
 * speak (see backend/app/api/routes/agent.py: plan -> tool -> evidence
 * -> verdict -> token -> done). Swapping in the real service means
 * replacing this file with a fetch/SSE reader that yields the same
 * events; the pages stay untouched.
 */

import type { AgentBlock } from "@/lib/data";
import { sleep, jitter, tokenize } from "./delay";
import { getCase, analysisSteps } from "./cases";
import { pickScript, type ToolName, type Verdict } from "./agent-script";
import { pickLiterature, type LiteratureResult } from "./literature-script";

/* ---------- /agent/stream ---------- */

export type AgentEvent =
  | { event: "plan"; steps: { name: string; tool?: ToolName }[] }
  | { event: "tool"; index: number; name: string; tool?: ToolName; status: "start" | "done"; detail?: string }
  | { event: "verdict"; verdict: Verdict }
  | { event: "block"; block: AgentBlock }
  | { event: "token"; text: string }
  | { event: "done"; receipt: string; followups: string[]; citations: number };

export async function* streamAgent(
  query: string,
  caseId: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const c = getCase(caseId);
  const script = pickScript(query, c);
  const steps = script.steps(c);
  const t0 = Date.now();

  yield { event: "plan", steps: steps.map(({ name, tool }) => ({ name, tool })) };

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    yield { event: "tool", index: i, name: s.name, tool: s.tool, status: "start" };
    await sleep(jitter(s.ms), signal);
    yield { event: "tool", index: i, name: s.name, tool: s.tool, status: "done", detail: s.detail };
  }

  yield { event: "verdict", verdict: script.verdict(c) };
  await sleep(300, signal);

  for (const block of script.blocks(c)) {
    if (block.type === "p") {
      /* open an empty paragraph, then stream its text token by token */
      yield { event: "block", block: { ...block, text: "" } };
      for (const tok of tokenize(block.text)) {
        yield { event: "token", text: tok };
        await sleep(16 + Math.random() * 28, signal);
      }
      await sleep(200, signal);
    } else {
      await sleep(350, signal);
      yield { event: "block", block };
    }
  }

  const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
  yield {
    event: "done",
    receipt: `${steps.length}단계 실행 · 문헌 ${script.citations}편 인용 · ${secs}초`,
    followups: script.followups(c),
    citations: script.citations,
  };
}

/* ---------- /analyze ---------- */

export type AnalysisEvent =
  | { event: "step"; index: number; name: string; detail: string; status: "start" | "done" }
  | { event: "result"; caseId: string };

const ANALYSIS_MS = [700, 1100, 900, 700];

export async function* runAnalysis(caseId: string, signal?: AbortSignal): AsyncGenerator<AnalysisEvent> {
  for (let i = 0; i < analysisSteps.length; i++) {
    const s = analysisSteps[i];
    yield { event: "step", index: i, name: s.name, detail: s.detail, status: "start" };
    await sleep(jitter(ANALYSIS_MS[i]), signal);
    yield { event: "step", index: i, name: s.name, detail: s.detail, status: "done" };
  }
  await sleep(250, signal);
  yield { event: "result", caseId };
}

/* ---------- /literature/search ---------- */

export type LiteratureEvent =
  | { event: "stage"; index: number; status: "start" | "done"; result?: string }
  | { event: "results"; result: LiteratureResult };

const STAGE_MS = [600, 1000, 800, 500];

export async function* searchLiterature(query: string, signal?: AbortSignal): AsyncGenerator<LiteratureEvent> {
  const result = pickLiterature(query);
  for (let i = 0; i < STAGE_MS.length; i++) {
    yield { event: "stage", index: i, status: "start" };
    await sleep(jitter(STAGE_MS[i]), signal);
    yield { event: "stage", index: i, status: "done", result: result.stageResults[i] };
  }
  await sleep(200, signal);
  yield { event: "results", result };
}
