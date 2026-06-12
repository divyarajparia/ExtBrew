import { create } from "zustand";

export type TextPart = { type: "text"; text: string };
export type ToolCallPart = {
  type: "tool_call";
  id: string;
  name: "create_file" | "edit_file" | "delete_file";
  path: string;
  status: "running" | "done";
};
export type MessagePart = TextPart | ToolCallPart;

export interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  createdAt: number;
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  showMode: boolean;
  appendMessage: (msg: Message) => void;
  appendTextDelta: (text: string) => void;
  addToolCallPart: (part: ToolCallPart) => void;
  setToolCallDone: (id: string, path: string) => void;
  popLastMessage: () => void;
  setStreaming: (val: boolean) => void;
  setShowMode: (val: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isStreaming: false,
  showMode: true,

  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendTextDelta: (text) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = {
        ...messages[messages.length - 1],
        parts: [...messages[messages.length - 1].parts],
      };
      const lastPart = last.parts[last.parts.length - 1];
      if (lastPart?.type === "text") {
        last.parts[last.parts.length - 1] = { type: "text", text: lastPart.text + text };
      } else {
        last.parts.push({ type: "text", text });
      }
      messages[messages.length - 1] = last;
      return { messages };
    }),

  addToolCallPart: (part) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = {
        ...messages[messages.length - 1],
        parts: [...messages[messages.length - 1].parts, part],
      };
      messages[messages.length - 1] = last;
      return { messages };
    }),

  setToolCallDone: (id, path) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = { ...messages[messages.length - 1] };
      last.parts = last.parts.map((p) =>
        p.type === "tool_call" && p.id === id
          ? { ...p, path, status: "done" as const }
          : p
      );
      messages[messages.length - 1] = last;
      return { messages };
    }),

  popLastMessage: () =>
    set((s) => ({ messages: s.messages.slice(0, -1) })),

  setStreaming: (val) => set({ isStreaming: val }),

  setShowMode: (val) => set({ showMode: val }),

  clearMessages: () => set({ messages: [], showMode: true }),
}));
