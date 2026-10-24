"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
const Context = createContext<{
  values: Record<string, unknown>;
  update: Dispatch<SetStateAction<Record<string, unknown>>>;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [values, update] = useState<Record<string, unknown>>({});
  return (
    <Context.Provider value={{ values, update }}>{children}</Context.Provider>
  );
}
export function useSessionValue<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(Context);
  if (!context) throw new Error("SessionProvider required");
  const { values, update } = context;
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      update((all) => ({
        ...all,
        [key]:
          typeof next === "function"
            ? (next as (value: T) => T)((all[key] as T | undefined) ?? initial)
            : next,
      })),
    [key, initial, update],
  );
  return [(values[key] as T | undefined) ?? initial, set];
}

export function appendQuestionDraft(previous: string, next: string): string {
  if (!previous.trim()) return next;
  if (previous.includes(next)) return previous;
  return `${previous}\n\n추가 검토 질문: ${next}`;
}
