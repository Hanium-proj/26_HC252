import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const allowed = new Set([
  "health",
  "studies",
  "analyze",
  "literature",
  "cases",
  "agent",
]);
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  if (
    !allowed.has(params.path[0]) ||
    params.path.some((p) => p === ".." || /[\\/]/.test(p))
  ) {
    return Response.json(
      { detail: "경로를 찾을 수 없습니다" },
      { status: 404 },
    );
  }
  // Hosted shared workspace requires Vercel Authentication on every *.vercel.app URL.
  // Custom domains stay disabled here because the project protection excludes them.
  const protectedDeployment =
    process.env.VERCEL === "1" &&
    process.env.PRIVATE_VERCEL_WORKSPACE === "true" &&
    new URL(request.url).hostname.endsWith(".vercel.app");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_WORKSPACE !== "true" &&
    !protectedDeployment
  ) {
    return Response.json(
      {
        detail:
          "작업 공간 접근 보호 설정이 필요합니다. 배포 관리자에게 문의해 주세요.",
      },
      { status: 503 },
    );
  }
  const origin = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
  const url = new URL(
    `/${params.path.map(encodeURIComponent).join("/")}`,
    origin,
  );
  url.search = request.nextUrl.search;
  const headers = new Headers();
  if (request.headers.has("content-type"))
    headers.set("content-type", request.headers.get("content-type")!);
  if (process.env.BACKEND_API_KEY)
    headers.set("x-api-key", process.env.BACKEND_API_KEY);
  try {
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > 16 * 1024 * 1024) {
      return Response.json({ detail: "파일이 너무 큽니다" }, { status: 413 });
    }
    const requestOrigin = request.headers.get("origin");
    let sameOrigin = !requestOrigin;
    if (requestOrigin) {
      try {
        const supplied = new URL(requestOrigin);
        sameOrigin =
          supplied.host === request.headers.get("host") &&
          supplied.protocol === request.nextUrl.protocol;
      } catch {
        sameOrigin = false;
      }
    }
    if (hasBody && !sameOrigin) {
      return Response.json(
        { detail: "다른 출처의 요청은 허용되지 않습니다" },
        { status: 403 },
      );
    }
    const body = hasBody ? await request.arrayBuffer() : undefined;
    if (body && body.byteLength > 16 * 1024 * 1024)
      return Response.json({ detail: "파일이 너무 큽니다" }, { status: 413 });
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: request.signal,
    });
    const outgoing = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    outgoing.set(
      "Content-Type",
      upstream.headers.get("content-type") ?? "application/json",
    );
    if (upstream.headers.get("content-type")?.includes("event-stream"))
      outgoing.set("X-Accel-Buffering", "no");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      {
        detail: "백엔드에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.",
      },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH };
