import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatProvider, ChatChunkHandler, ChatMessage } from "./base";

export class GeminiProvider implements ChatProvider {
  id = "gemini"; supportsTools = true;
  
  async streamChat(opts: { model: string; messages: ChatMessage[]; signal?: AbortSignal; env: any }, onDelta: ChatChunkHandler) {
    const genAI = new GoogleGenerativeAI(opts.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: opts.model || "gemini-2.5-flash" 
    });

    // Convert messages to Gemini format
    const systemInstruction = opts.messages.find(m => m.role === "system")?.content;
    const history = opts.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: m.content }],
      }));

    // Start chat session with history
    const chat = model.startChat({
      history: history.slice(0, -1), // All but the last message
      systemInstruction,
    });

    // Get the last user message
    const lastMessage = history[history.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error("Last message must be from user");
    }

    const result = await chat.sendMessageStream(lastMessage.parts[0].text);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        await onDelta(chunkText);
      }
    }
  }
}