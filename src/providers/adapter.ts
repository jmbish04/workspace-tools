/**
 * @module adapter
 * @description Adapter that bridges the new ChatProvider interface with the legacy BaseProvider interface
 * This allows the agents system to continue using the BaseProvider interface while benefiting from
 * the improved ChatProvider implementations.
 */

import { ChatMessage, ChatProvider } from "./base";
import { BaseProvider, ProviderConfig, ProviderResponse } from "./index";

/**
 * Adapter class that wraps a ChatProvider to implement the BaseProvider interface
 */
export class ChatProviderAdapter implements BaseProvider {
  name: string;
  model: string;
  private chatProvider: ChatProvider;
  private config: ProviderConfig;
  private env: any;

  constructor(chatProvider: ChatProvider, config: ProviderConfig, env: any) {
    this.chatProvider = chatProvider;
    this.config = config;
    this.env = env;
    this.name = config.name;
    this.model = config.model;
  }

  /**
   * Converts the old BaseProvider.generate() call to the new ChatProvider.streamChat() call
   */
  async generate(prompt: string, options: any = {}): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      // Convert BaseProvider format to ChatProvider format
      const messages: ChatMessage[] = [];

      // Add system message if provided
      if (options.systemPrompt) {
        messages.push({
          role: "system",
          content: options.systemPrompt
        });
      }

      // Add user message
      messages.push({
        role: "user",
        content: prompt
      });

      // Collect streaming response
      let content = "";
      let tokenCount = 0;

      await this.chatProvider.streamChat({
        model: this.model,
        messages,
        env: this.env,
        signal: options.signal
      }, async (delta: string) => {
        content += delta;
        tokenCount += 1; // Rough estimation
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Convert back to BaseProvider format
      const response: ProviderResponse = {
        provider: this.chatProvider.id,
        model: this.model,
        content: content.trim(),
        usage: {
          promptTokens: Math.ceil(prompt.length / 4), // Rough estimation
          completionTokens: tokenCount,
          totalTokens: Math.ceil(prompt.length / 4) + tokenCount
        },
        metadata: {
          responseTime,
          finishReason: "stop"
        }
      };

      return response;

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const errorResponse: ProviderResponse = {
        provider: this.chatProvider.id,
        model: this.model,
        content: "",
        metadata: {
          responseTime,
          error: error instanceof Error ? error.message : String(error),
          finishReason: "error"
        }
      };

      return errorResponse;
    }
  }
}
