import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  appendMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  setStreaming: (val: boolean) => void;
  popLastMessage: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isStreaming: false,
  appendMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (content) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const messages = [...state.messages];
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        content,
      };
      return { messages };
    }),
  clearMessages: () => set({ messages: [] }),
  setStreaming: (val) => set({ isStreaming: val }),
  popLastMessage: () =>
    set((state) => ({ messages: state.messages.slice(0, -1) })),
}));
