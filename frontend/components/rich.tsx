import { Fragment } from "react";
import { CiteChip } from "@/components/ui";

/*
 * Tiny inline markup for mock copy so case data can stay as plain strings:
 *   **굵게**   -> <b>
 *   [1] [2]    -> numbered literature citation chip
 *   [영상]     -> image-evidence citation chip
 */
const TOKEN = /(\*\*[^*]+\*\*|\[영상\]|\[\d+\])/g;

export function Rich({ text, strong = "font-semibold text-ink" }: { text: string; strong?: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**")) {
          return (
            <b key={i} className={strong}>
              {p.slice(2, -2)}
            </b>
          );
        }
        if (p === "[영상]") return <CiteChip key={i} kind="image" label="영상" />;
        const m = /^\[(\d+)\]$/.exec(p);
        if (m) return <CiteChip key={i} kind="paper" label={m[1]} />;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
