import Anthropic from "@anthropic-ai/sdk";
import { ChatProvider, ChatChunkHandler, ChatMessage } from "./base";

export class AnthropicProvider implements ChatProvider {
  id = "anthropic"; supportsTools = true;
  
  async streamChat(opts: { model: string; messages: ChatMessage[]; signal?: AbortSignal; env: any }, onDelta: ChatChunkHandler) {
    const client = new Anthropic({
      apiKey: opts.env.ANTHROPIC_API_KEY,
      baseURL: opts.env.ANTHROPIC_API_BASE || "https://api.anthropic.com",
    });

    const systemMessage = opts.messages.find(m => m.role === "system")?.content || "";
    const messages = opts.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content,
      }));

    const stream = await client.messages.create({
      model: opts.model || "claude-3-5-sonnet-20241022",
      system: systemMessage || undefined,
      max_tokens: 1024,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        await onDelta(chunk.delta.text);
      }
    }
  }
}