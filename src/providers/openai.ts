import OpenAI from "openai";
import { ChatProvider, ChatChunkHandler, ChatMessage } from "./base";

export class OpenAIProvider implements ChatProvider {
  id = "openai"; supportsTools = true;
  
  async streamChat(opts: { model: string; messages: ChatMessage[]; signal?: AbortSignal; env: any }, onDelta: ChatChunkHandler) {
    const client = new OpenAI({
      apiKey: opts.env.OPENAI_API_KEY,
      baseURL: opts.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    });

    // Convert messages to OpenAI format with proper typing
    const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = opts.messages
      .filter(m => m.role !== "tool") // Filter out tool messages for now
      .map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

    const stream = await client.chat.completions.create({
      model: opts.model || (opts.env.RESPONSES_MODEL || "gpt-4o-mini"),
      messages: openAIMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        await onDelta(delta);
      }
    }
  }
}
