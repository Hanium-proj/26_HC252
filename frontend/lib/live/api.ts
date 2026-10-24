export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.detail === "string"
        ? body.detail
        : `요청 실패 (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function* streamEvents(
  body: unknown,
  signal: AbortSignal,
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const response = await fetch("/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `에이전트 연결 실패 (${response.status})`,
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = frame.split("\n");
        const event =
          lines
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim() ?? "message";
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const payload = JSON.parse(data) as Record<string, unknown>;
        if (event === "error")
          throw new Error(String(payload.detail ?? "응답 생성 실패"));
        if (event === "done") completed = true;
        yield { event, data: payload };
      }
      if (done) break;
    }
    if (!completed)
      throw new Error("응답 연결이 완료 전에 끊겼습니다. 다시 시도해 주세요.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
