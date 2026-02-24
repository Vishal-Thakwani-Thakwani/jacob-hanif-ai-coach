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
  try {
    const saved = localStorage.getItem(CONVERSATIONS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    localStorage.removeItem(CONVERSATIONS_KEY);
  }
  return [];
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    const toSave = conversations.map((conv) => ({
      ...conv,
      messages: conv.messages.map(({ role, content }) => ({ role, content })),
    }));
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(toSave));
  } catch {
    try {
      const trimmed = conversations.slice(-10).map((conv) => ({
        ...conv,
        messages: conv.messages.slice(-20).map(({ role, content }) => ({ role, content })),
      }));
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(trimmed));
    } catch {
      localStorage.removeItem(CONVERSATIONS_KEY);
    }
  }
}

export function createConversation(title: string): Conversation {
  return {
    id: Date.now().toString(),
    title: title || "New Chat",
    timestamp: Date.now(),
    messages: [],
  };
}
