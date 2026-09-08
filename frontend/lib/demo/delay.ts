/*
 * Timing helpers for the mock pipeline. Every fake network hop goes
 * through `sleep` so a page can cancel an in-flight run (navigation,
 * demo reset) with an AbortSignal instead of leaking timers.
 */

export class Aborted extends Error {
  constructor() {
    super("aborted");
    this.name = "Aborted";
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new Aborted());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/* +-20% jitter so repeated runs never look metronomic on video */
export function jitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

/* Split Korean prose into LLM-looking chunks (2-4 chars, keeps spaces) */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const n = 2 + Math.floor(Math.random() * 3);
    out.push(text.slice(i, i + n));
    i += n;
  }
  return out;
}
