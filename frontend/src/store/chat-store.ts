import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/types/api";

interface ChatState {
  messages: ChatMessage[];
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (updater) =>
        set((state) => ({
          messages: typeof updater === "function" ? updater(state.messages) : updater,
        })),
      clearChat: () => set({ messages: [] }),
    }),
    {
      name: "documind_chat_storage",
      // Optional: only save the user/assistant text, you could filter out streaming states if needed,
      // but persist handles normal JSON serializable data fine.
    }
  )
);
