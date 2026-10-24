"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage } from "./types";
type Memory = {
  conversations: Record<string, ChatMessage[]>;
  save: (key: string, messages: ChatMessage[]) => void;
};
const Context = createContext<Memory | null>(null);
export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<
    Record<string, ChatMessage[]>
  >({});
  const save = useCallback(
    (key: string, messages: ChatMessage[]) =>
      setConversations((all) => ({ ...all, [key]: messages })),
    [],
  );
  return (
    <Context.Provider value={{ conversations, save }}>
      {children}
    </Context.Provider>
  );
}
export function useConversations() {
  const value = useContext(Context);
  if (!value) throw new Error("ConversationsProvider required");
  return value;
}
