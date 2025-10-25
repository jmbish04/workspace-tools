export type ChatChunkHandler = (delta: string) => Promise<void> | void;
export interface ChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string; }
export interface ChatProvider {
  id: string; supportsTools?: boolean;
  streamChat(opts: { model: string; messages: ChatMessage[]; signal?: AbortSignal; env: any }, onDelta: ChatChunkHandler): Promise<void>;
}
export function toOpenAIMessages(messages: ChatMessage[]) { return messages.map(m => ({ role: m.role, content: m.content })); }
