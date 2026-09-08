"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelHead, Chip, Tag, Callout, Disclaimer } from "@/components/ui";
import { IconConsult } from "@/components/icons";
import { Message, Composer } from "@/components/chat";
import { agentTools, chatStarters } from "@/lib/data";
import type { ChatMsg, AgentStep } from "@/lib/data";
import { useDemo, useCurrentCase } from "@/lib/demo/store";
import { streamAgent } from "@/lib/demo/api";
import { Aborted } from "@/lib/demo/delay";
import { pickLiterature } from "@/lib/demo/literature-script";
import type { ToolName } from "@/lib/demo/agent-script";

type AgentMsg = Extract<ChatMsg, { role: "agent" }>;

const now = () => new Date().toTimeString().slice(0, 5);

export default function AgentPage() {
  const router = useRouter();
  const { state, actions } = useDemo();
  const { c, verdict } = useCurrentCase();

  const saved = state.chat[c.id] ?? [];
  const savedRef = useRef(saved);
  savedRef.current = saved;

  /* in-flight exchange lives here until the answer completes, then it is
     committed to the store (so tokens never hit sessionStorage) */
  const [pendingUser, setPendingUser] = useState<ChatMsg | null>(null);
  const [live, setLive] = useState<AgentMsg | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: ChatMsg[] = [...saved, ...(pendingUser ? [pendingUser] : []), ...(live ? [live] : [])];
  const streaming = live !== null;

  /* cancel a running answer when the presenter leaves the screen */
  useEffect(() => () => abortRef.current?.abort(), []);

  /* keep the newest content in view while it streams */
  const lastText = live?.blocks.length ? JSON.stringify(live.blocks[live.blocks.length - 1]).length : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastText, live?.steps?.length]);

  async function send(text: string) {
    if (streaming) return;
    const time = now();
    const userMsg: ChatMsg = { role: "user", text, time };
    let agent: AgentMsg = { role: "agent", time, steps: [], blocks: [], streaming: true };
    setPendingUser(userMsg);
    setLive(agent);

    const ac = new AbortController();
    abortRef.current = ac;

    const patch = (p: Partial<AgentMsg>) => {
      agent = { ...agent, ...p };
      setLive(agent);
    };

    try {
      for await (const ev of streamAgent(text, c.id, ac.signal)) {
        switch (ev.event) {
          case "plan":
            patch({ steps: ev.steps.map((s) => ({ name: s.name, tool: s.tool, state: "waiting" as const })) });
            break;
          case "tool": {
            const steps: AgentStep[] = agent.steps!.map((s, i) =>
              i === ev.index ? { ...s, state: ev.status === "start" ? "active" : "done", detail: ev.detail } : s,
            );
            patch({ steps });
            if (ev.tool) {
              if (ev.status === "start") setActiveTool(ev.tool);
              else {
                setActiveTool(null);
                actions.bumpTool(ev.tool);
              }
            }
            break;
          }
          case "evidence":
            actions.setLiterature(c.id, ev.query);
            break;
          case "verdict":
            actions.setVerdict(c.id, ev.verdict);
            break;
          case "block":
            patch({ blocks: [...agent.blocks, ev.block] });
            break;
          case "token": {
            const blocks = agent.blocks.slice();
            const last = blocks[blocks.length - 1];
            if (last && last.type === "p") blocks[blocks.length - 1] = { ...last, text: last.text + ev.text };
            patch({ blocks });
            break;
          }
          case "done":
            patch({ streaming: false, receipt: ev.receipt, followups: ev.followups });
            actions.setChat(c.id, [...savedRef.current, userMsg, agent]);
            setPendingUser(null);
            setLive(null);
            break;
        }
      }
    } catch (e) {
      if (!(e instanceof Aborted)) throw e;
      setPendingUser(null);
      setLive(null);
    } finally {
      setActiveTool(null);
      abortRef.current = null;
    }
  }

  const starters = c.findings[0].en === "PNEUMONIA" ? chatStarters : [chatStarters[0], chatStarters[1], chatStarters[2], "다음에 어떤 검사가 필요한가요?"];
  const sources = pickLiterature(state.literature[c.id] ?? c.literatureQuery).sources;
  const studyDate = c.patient.study.split(" · ")[1]?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto grid h-[calc(100vh-104px)] min-h-[560px] max-w-[1400px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
      {/* ================= chat: fixed shell, messages scroll inside ================= */}
      <Panel className="anim-rise flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-ink">진단 에이전트</h2>
            <p className="mt-1 text-[12px] text-ink-3">영상 · 임상 정보 · 문헌을 근거로 답하는 판독 보조 대화</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tag className="mono !text-[11px]">{c.id}</Tag>
            <Chip level={streaming ? "info" : "ok"} pulse={streaming}>
              {streaming ? "답변 작성 중" : "근거 연결됨"}
            </Chip>
          </div>
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
          <p className="microlabel text-center">CHEST PA · {studyDate} · CONNECTED</p>

          {messages.length === 0 && (
            <div className="anim-rise m-auto flex max-w-[520px] flex-col items-center gap-4 py-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-wash text-accent">
                <IconConsult className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">{c.patient.name}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  {c.patient.studyKo}와 임상 정보가 연결되어 있습니다. 질문하면 영상 분석 · 문헌 검색 · 임상 정보를 순서대로 확인하고 근거와 함께 답합니다.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
                  >
                    <IconConsult className="h-3.5 w-3.5 text-ink-3" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} m={m} onFollowup={send} />
          ))}
        </div>

        <div className="px-5 pb-4">
          <Composer contextLabel={`흉부 PA · ${c.id}`} disabled={streaming} onSend={send} />
          <Disclaimer className="mt-2 text-center" />
        </div>
      </Panel>

      {/* ================= right rail (scrolls independently) ================= */}
      <div className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
        <Panel className="anim-rise">
          <PanelHead title="도구 실행 현황" sub="이 대화에서 에이전트가 사용한 도구" />
          <div className="flex flex-col gap-1 px-3 pb-4">
            {agentTools.map((t) => {
              const calls = state.toolCalls[t.name] ?? 0;
              const running = activeTool === t.name;
              return (
                <div
                  key={t.name}
                  className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150"
                  style={running ? { background: "var(--accent-wash)" } : undefined}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{t.name}</p>
                    <p className="truncate text-[11.5px] text-ink-3">{t.desc}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="mono text-[12px] text-ink-2 tnum">{calls}회</span>
                    <Chip level={running ? "info" : calls > 0 ? "ok" : "neutral"} pulse={running}>
                      {running ? "실행 중" : calls > 0 ? "완료" : "대기"}
                    </Chip>
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="anim-rise">
          <PanelHead title="확신도 점검" sub="답변 신뢰 수준을 함께 표시" />
          <div className="flex flex-col gap-2 px-5 pb-5">
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
              <span className="text-[12.5px] text-ink-2">여러 모델 간 합의</span>
              <span className="mono text-[12.5px] font-semibold text-ink tnum">{verdict ? verdict.agreement.toFixed(2) : "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
              <span className="text-[12.5px] text-ink-2">판독자 간 일치도</span>
              {verdict ? (
                <span className={`text-[12.5px] font-medium ${verdict.agreement < 0.7 ? "text-warning" : "text-ok"}`}>
                  {verdict.agreement < 0.7 ? "낮음" : verdict.agreement < 0.8 ? "보통" : "높음"}
                </span>
              ) : (
                <span className="text-[12.5px] text-ink-3">—</span>
              )}
            </div>
            {verdict ? (
              verdict.overall === "ACCEPT" ? (
                <Callout level="ok" className="mt-1">
                  근거가 충분해 답변을 <b className="font-semibold text-ink">확정</b>했습니다. 최종 판단은 판독의가 진행합니다.
                </Callout>
              ) : verdict.overall === "CAUTION" ? (
                <Callout level="warning" className="mt-1">
                  판독자 간 일치도가 낮은 소견이 포함되어 <b className="font-semibold text-ink">판독의 확인 권고</b>로 전환되었습니다.
                </Callout>
              ) : (
                <Callout level="info" className="mt-1">
                  일부 도구 결과가 없어 <b className="font-semibold text-ink">추가 근거 필요</b>로 표시했습니다.
                </Callout>
              )
            ) : (
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">질문을 보내면 답변의 근거 강도와 판독자 일치도를 여기에 표시합니다.</p>
            )}
          </div>
        </Panel>

        <Panel className="anim-rise">
          <PanelHead title="이 대화의 근거" sub="번호는 답변 속 인용과 연결" />
          <div className="flex flex-col gap-1 px-3 pb-4">
            {sources.map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  actions.setLiterature(c.id, state.literature[c.id] ?? c.literatureQuery);
                  router.push("/literature");
                }}
                className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <span className="mono mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-wash text-[10.5px] font-semibold text-accent">
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium leading-snug text-ink group-hover:text-accent-strong">{s.title}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] text-ink-3">{s.grade}</span>
                    <span className="mono text-[10.5px] text-ink-3 tnum">{s.year}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
