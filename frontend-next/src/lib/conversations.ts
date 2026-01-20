export interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

export interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
}

const CONVERSATIONS_KEY = "jacob-coach-conversations";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem(CONVERSATIONS_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  return [];
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function createConversation(title: string): Conversation {
  return {
    id: Date.now().toString(),
    title: title || "New Chat",
    timestamp: Date.now(),
    messages: [],
  };
}
