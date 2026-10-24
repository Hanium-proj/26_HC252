"use client";
import { WorkflowLink as Link } from "@/components/workflow";
import { IconConsult, IconBook } from "@/components/icons";
import { PageHeading, Disclosure } from "@/components/controls";
import { useSessionValue } from "@/lib/live/session";
import { useConversations } from "@/lib/live/conversations";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { streamEvents } from "@/lib/live/api";
import { useWorkspace } from "@/lib/live/store";
import type { ChatMessage, Source } from "@/lib/live/types";
import {
  Card,
  ErrorBox,
  Sources,
  buttonClass,
  StudySelect,
} from "@/components/live";
export default function AgentPage() {
  const { studies, selected, select, jobs } = useWorkspace();
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeading
        eyebrow="AI CONSULTATION"
        title="소견을 이해하고, 근거를 연결하세요"
        description="선택한 검사와 문헌을 바탕으로 질문하세요. 답변의 출처도 함께 확인할 수 있습니다."
      />
      <StudySelect studies={studies} selected={selected} onChange={select} />
      {selected && !selected.analysis && (
        <div className="flow-notice">
          <div>
            <strong>
              {jobs[selected.id]?.status === "running"
                ? "이 검사는 분석 중입니다"
                : "아직 이 영상의 분석 결과가 없습니다"}
            </strong>
            <p>
              지금 질문하면 일반 문헌을 바탕으로 답합니다. 영상의 소견은 분석
              완료 후 질문해 주세요.
            </p>
          </div>
          <Link className="btn-secondary" href="/analysis">
            분석 화면 →
          </Link>
        </div>
      )}
      <Chat
        key={`${selected?.id ?? "general"}:${selected?.analysis?.completed_at ?? "pending"}`}
      />
    </div>
  );
}
function Chat() {
  const { selected } = useWorkspace();
  const { conversations, save } = useConversations();
  const conversationKey = `${selected?.id ?? "general"}:${selected?.analysis?.completed_at ?? "pending"}`;
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => conversations[conversationKey] ?? [],
  );
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useSessionValue(`question:${conversationKey}`, "");
  const [sources, setSources] = useState<Source[]>(
    () =>
      conversations[conversationKey]
        ?.filter((m) => m.role === "assistant")
        .at(-1)?.sources ?? [],
  );
  const [status, setStatus] = useState("");
  const [metrics, setMetrics] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, status]);
  async function send(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const question = (suggested ?? query).trim();
    if (busy || question.length < 2) return;
    if (question.length > 3000) {
      setError("질문을 3,000자 이내로 줄여 주세요. 작성한 내용은 유지됩니다.");
      return;
    }
    follow.current = true;
    setQuery("");
    setBusy(true);
    setError("");
    setMetrics("");
    setStatus("질문을 확인하고 있습니다");
    setSources([]);
    const ac = new AbortController();
    controller.current = ac;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    let answer = "";
    let answerSources: Source[] = [];
    try {
      for await (const { event: kind, data } of streamEvents(
        {
          case_id: selected?.id ?? null,
          query: question,
          history: messages
            .filter((m) => m.content && !m.incomplete)
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        },
        ac.signal,
      )) {
        if (kind === "tool")
          setStatus(
            `${({ knowledge_rag: "관련 문헌 검색", case_rag: "유사 증례 확인", literature: "문헌 검색" } as Record<string, string>)[String(data.name)] ?? "근거 확인"} · ${data.status === "start" ? "진행 중" : "완료"}`,
          );
        if (kind === "evidence") {
          answerSources = (data.hits ?? []) as Source[];
          setSources(answerSources);
        }
        if (kind === "verdict")
          setStatus(
            `${data.verdict === "CAUTION" ? "검토 필요" : "근거 부족"} · 실제 답변 생성 중`,
          );
        if (kind === "token") {
          answer += String(data.text);
          setMessages([
            ...next.slice(0, -1),
            { role: "assistant", content: answer, sources: answerSources },
          ]);
        }
        if (kind === "done") {
          setMetrics(
            `${data.model} · 총 ${Number(data.latency_ms) / 1000}초 · 첫 토큰 ${Number(data.first_token_ms) / 1000}초 · ${data.total_tokens}토큰`,
          );
          setStatus("답변 완료 · 출처와 함께 검토해 주세요");
          save(conversationKey, [
            ...next.slice(0, -1),
            { role: "assistant", content: answer, sources: answerSources },
          ]);
        }
      }
    } catch (e) {
      setQuery((current) => current || question);
      save(conversationKey, [
        ...next.slice(0, -1),
        {
          role: "assistant",
          content: answer,
          sources: answerSources,
          incomplete: true,
        },
      ]);
      setMessages([
        ...next.slice(0, -1),
        {
          role: "assistant",
          content: answer,
          sources: answerSources,
          incomplete: true,
        },
      ]);
      setError(
        ac.signal.aborted
          ? "요청을 중지했습니다."
          : e instanceof Error
            ? e.message
            : "응답 실패",
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  const suggestions = selected?.analysis
    ? [
        ["주요 소견 정리", "이 영상의 주요 소견과 해석의 한계를 정리해줘."],
        [
          "근거 문헌 확인",
          "이 영상에서 관찰된 주요 소견의 관련 문헌 근거를 알려줘.",
        ],
        [
          "불확실한 부분",
          "현재 분석에서 확실하지 않은 부분과 검토할 점은 무엇이야?",
        ],
        [
          "검토 메모 작성",
          "현재 분석을 바탕으로 의료진 검토용 요약을 작성해줘.",
        ],
      ]
    : [
        ["기흉의 영상 소견", "기흉의 흉부 X-ray 소견을 문헌과 함께 설명해줘."],
        ["흉수의 영상 소견", "흉수의 흉부 X-ray 소견을 문헌과 함께 설명해줘."],
        ["폐렴의 영상 소견", "폐렴의 영상 소견과 해석의 한계를 설명해줘."],
        ["폐부종의 영상 소견", "폐부종의 영상 소견을 문헌과 함께 정리해줘."],
      ];
  return (
    <div className="chat-layout">
      <section className="chat-panel" aria-label="AI 대화">
        <div className="chat-panel-head">
          <span className="assistant-symbol">
            <IconConsult />
          </span>
          <div>
            <h2>Chest AI 어시스턴트</h2>
            <p>
              {selected?.analysis
                ? "검사 분석 + 문헌 기반 대화"
                : "일반 문헌 기반 대화"}
            </p>
          </div>
          <span className="status-pill is-complete ml-auto">
            <span />
            {busy ? "답변 중" : "질문 가능"}
          </span>
        </div>
        {!messages.length ? (
          <div className="chat-welcome">
            <p className="eyebrow">LET’S LOOK CLOSER</p>
            <h2>어떤 부분을 살펴볼까요?</h2>
            <p>
              {selected?.analysis
                ? "주요 소견을 요약하거나, 판단의 근거와 불확실한 부분을 질문해 보세요."
                : "먼저 문헌에 관해 질문하거나, 영상을 분석해 검사 기반 대화를 시작하세요."}
            </p>
            <p className="suggestion-hint">추천 질문을 선택한 뒤 내용을 수정하고 보내세요.</p>
            <div className="suggestion-grid">
              {suggestions.map(([title, text]) => (
                <button
                  className="suggestion"
                  key={title}
                  onClick={() => { setQuery(text); textarea.current?.focus(); }}
                >
                  <strong>
                    {title} <span className="!inline !text-accent">↗</span>
                  </strong>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            ref={scroll}
            className="chat-scroll"
            onScroll={() => {
              const el = scroll.current;
              if (el)
                follow.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            }}
          >
            {messages.map((message, i) => (
              <article key={i} className={`chat-message ${message.role}`}>
                <p className="message-label">
                  {message.role === "user" ? (
                    "나의 질문"
                  ) : (
                    <>
                      <IconConsult className="h-4 w-4" /> Chest AI · 검토용 답변
                    </>
                  )}
                </p>
                <Answer
                  text={
                    message.content ||
                    (busy
                      ? "관련 근거를 살펴보고 있습니다…"
                      : "답변이 완료되지 않았습니다.")
                  }
                />
                {busy && i === messages.length - 1 && (
                  <span className="caret" aria-hidden="true" />
                )}
                {message.role === "assistant" && message.content && !(busy && i === messages.length - 1) && <CopyAnswer text={message.content} />}
                {message.incomplete && (
                  <p className="mt-2 text-xs text-warning">
                    중단된 답변입니다. 질문을 다시 보내 확인해 주세요.
                  </p>
                )}
                {!!message.sources?.length && (
                  <Disclosure
                    title={`이 답변의 출처 ${message.sources.length}건`}
                  >
                    <Sources hits={message.sources} />
                  </Disclosure>
                )}
              </article>
            ))}
          </div>
        )}
        {status && (
          <p role="status" className="chat-progress">
            {busy ? (
              <span className="loading-orbit" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">✓</span>
            )}
            {status}
          </p>
        )}
        <div className="px-6">
          <ErrorBox message={error} />
        </div>
        {busy && (
          <p className="px-6 pb-3 text-xs text-ink-2">
            화면을 이동하면 답변 생성을 중지하고, 받은 내용은 중단된 답변으로
            보관합니다.
          </p>
        )}
        <form onSubmit={send} className="chat-composer">
          <div className="composer-box">
            <textarea
              ref={textarea}
              aria-label="에이전트 질문"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={3000}
              placeholder="검사나 문헌에 대해 질문하세요…"
            />
            <div className="composer-actions">
              <span>Enter 전송 · Shift + Enter 줄바꿈</span>
              {busy ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => controller.current?.abort()}
                >
                  ■ 답변 중지
                </button>
              ) : (
                <button
                  className={buttonClass}
                  disabled={query.trim().length < 2}
                >
                  질문 보내기 ↑
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            AI 답변은 검토를 돕는 초안입니다. 진료 결정을 대신하지 않습니다.
          </p>
          {metrics && (
            <Disclosure title="응답 처리 정보">
              <p className="text-xs text-ink-2">{metrics}</p>
            </Disclosure>
          )}
        </form>
      </section>
      <aside className="chat-rail">
        {selected?.analysis &&
          Object.keys(conversations).some(
            (key) =>
              key.startsWith(`${selected.id}:`) && key !== conversationKey,
          ) && (
            <Card title="새 분석 기준의 대화">
              <p className="text-xs leading-relaxed text-ink-2">
                이전 대화는 현재 분석에 사용하지 않습니다. 아래에서 기록을
                확인할 수 있습니다.
              </p>
              <Disclosure title="이전 분석의 대화 보기">
                {Object.entries(conversations)
                  .filter(
                    ([key]) =>
                      key.startsWith(`${selected.id}:`) &&
                      key !== conversationKey,
                  )
                  .map(([key, history]) => (
                    <div key={key} className="mb-5">
                      <p className="text-xs font-semibold mb-3">
                        {key.endsWith(":pending")
                          ? "분석 전 대화"
                          : new Date(
                              key.slice(selected.id.length + 1),
                            ).toLocaleString("ko-KR")}
                      </p>
                      {history.map((message, index) => (
                        <div
                          className="rounded-lg bg-surface-2 p-3 mb-2"
                          key={index}
                        >
                          <p className="text-xs font-medium mb-2">
                            {message.role === "user" ? "질문" : "이전 답변"}
                            {message.incomplete ? " · 중단됨" : ""}
                          </p>
                          <Answer text={message.content || "중단된 응답"} />
                          {!!message.sources?.length && (
                            <Disclosure title="이전 답변의 출처">
                              <Sources hits={message.sources} />
                            </Disclosure>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
              </Disclosure>
            </Card>
          )}
        <Card title="함께 보고 있는 검사">
          {selected ? (
            <>
              <div className="context-preview">
                <img src={selected.image_url} alt="선택한 흉부 영상 미리보기" />
                <div>
                  <p>{selected.name}</p>
                  <span
                    className={`status-pill mt-2 ${selected.analysis ? "is-complete" : ""}`}
                  >
                    <span />
                    {selected.analysis ? "분석 완료" : "분석 대기"}
                  </span>
                </div>
              </div>
              <p className="rail-summary">
                {selected.analysis?.report.impression ??
                  "영상 분석을 먼저 실행하면 이 검사에 대한 소견과 근거를 함께 질문할 수 있습니다."}
              </p>
              <Link href="/analysis" className="btn-secondary w-full">
                {selected.analysis
                  ? "분석 결과 살펴보기"
                  : "영상 분석 시작하기"}{" "}
                →
              </Link>
            </>
          ) : (
            <>
              <p className="rail-summary">
                현재 선택한 검사가 없습니다. 영상을 등록하면 검사에 맞춘 질문을
                시작할 수 있습니다.
              </p>
              <Link href="/" className="btn-secondary">
                영상 업로드 →
              </Link>
            </>
          )}
        </Card>
        <Card
          title={`답변의 근거${sources.length ? ` · ${sources.length}건` : ""}`}
          sub="답변 속 [번호]와 출처를 대조해 보세요."
        >
          {sources.length ? (
            <Sources hits={sources} />
          ) : (
            <div className="rail-placeholder">
              <span>
                <IconBook />
              </span>
              <div>
                <strong>
                  {busy
                    ? "관련 문헌을 확인 중입니다"
                    : "답변과 함께 출처가 모입니다"}
                </strong>
                <p className="mt-1">
                  질문을 보내면 검색된 문헌과 원문을 이곳에서 확인할 수
                  있습니다.
                </p>
              </div>
            </div>
          )}
        </Card>
        <p className="px-2 text-[11px] leading-relaxed text-ink-3">
          대화는 현재 브라우저 세션에서만 유지됩니다. 새로고침하면 초기화됩니다.
        </p>
      </aside>
    </div>
  );
}
function Answer({ text }: { text: string }) {
  const inline = (line: string) =>
    line
      .split(/(\*\*.*?\*\*)/g)
      .map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  return (
    <div className="answer-text">
      {text.split("\n").map((line, i) =>
        /^#{1,4}\s/.test(line) ? (
          <h3 key={i}>{inline(line.replace(/^#{1,4}\s+/, ""))}</h3>
        ) : /^[-*]\s/.test(line) ? (
          <ul key={i}>
            <li>{inline(line.slice(2))}</li>
          </ul>
        ) : line.trim() ? (
          <p key={i}>{inline(line)}</p>
        ) : null,
      )}
    </div>
  );
}

function CopyAnswer({text}: {text: string}) {
  const [status, setStatus] = useState("");
  return <div className="answer-actions"><button type="button" className="btn-secondary" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus("답변을 복사했습니다"); }
    catch { setStatus("복사하지 못했습니다. 답변을 선택해 복사하세요."); }
  }}>답변 복사</button><span role="status">{status}</span></div>;
}
