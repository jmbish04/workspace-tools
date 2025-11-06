import { Env } from "../types";
import { LoggerAdapter } from "../utils/logger-adapter";

export type ReasoningLevel = "low" | "medium" | "high";

export interface AiRouterRequest {
  input: string;
  context?: string;
  instructions?: string;
  reasoningLevel?: ReasoningLevel;
  preferredModel?: "@cf/openai/gpt-oss-120b" | "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  maxOutputTokens?: number;
}

export interface AiRouterChunkResult {
  index: number;
  model: string;
  requestTokensEstimate: number;
  responseText: string;
  sanitizedResponseText: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AiRouterResult {
  success: boolean;
  model: string;
  routingStrategy: {
    chunkCount: number;
    chunkSizeTokens: number;
    reasoningLevel: ReasoningLevel;
    requestedModel?: string;
    automaticFallback: boolean;
  };
  aggregatedResponse: string;
  chunks: AiRouterChunkResult[];
  metadata: {
    totalEstimatedPromptTokens: number;
    totalEstimatedCompletionTokens: number;
    requestId: string;
    timestamp: string;
  };
}

interface ModelSelection {
  model: "@cf/openai/gpt-oss-120b" | "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  contextWindow: number;
  reasoningLevel: ReasoningLevel;
}

const DEFAULT_SYSTEM_PROMPT = [
  "You are the Workspace Tools AI router assistant.",
  "Provide actionable, well-structured answers with bullet points where helpful.",
  "Always produce plain text without markdown or JSON code fences.",
  "Include a concise summary and next steps when relevant."
].join(" \n");

const MODEL_CONFIG = {
  "@cf/openai/gpt-oss-120b": {
    contextTokens: 128_000,
    safetyMargin: 6_000,
  },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": {
    contextTokens: 24_000,
    safetyMargin: 2_000,
  },
} as const;

export class AiRouterService {
  private readonly env: Env;
  private readonly logger?: LoggerAdapter;

  constructor(env: Env, logger?: LoggerAdapter) {
    this.env = env;
    this.logger = logger;
  }

  async route(request: AiRouterRequest): Promise<AiRouterResult> {
    if (!this.env.AI) {
      throw new Error("Workers AI binding (env.AI) is not configured");
    }

    const normalizedRequest: AiRouterRequest = {
      ...request,
      input: request.input.trim(),
      context: request.context?.trim(),
      instructions: request.instructions?.trim(),
      reasoningLevel: request.reasoningLevel || "medium",
    };

    const combinedInput = this.buildCombinedInput(normalizedRequest);
    const estimatedTokens = this.estimateTokens(combinedInput);

    const selection = this.selectModel(normalizedRequest, estimatedTokens);
    const chunkTokenLimit = MODEL_CONFIG[selection.model].contextTokens - MODEL_CONFIG[selection.model].safetyMargin;
    const chunkCharLimit = chunkTokenLimit * 4; // Rough character approximation per token

    const chunks = this.chunkText(combinedInput, chunkCharLimit);
    const chunkResults: AiRouterChunkResult[] = [];
    let totalEstimatedCompletionTokens = 0;

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const chunkTokensEstimate = this.estimateTokens(chunk);
      this.logger?.debug("AI router chunk dispatched", {
        index,
        chunkTokensEstimate,
        model: selection.model,
      });

      const response = await this.dispatchToModel(selection, chunk, normalizedRequest, index, chunkTokensEstimate);
      chunkResults.push(response);
      totalEstimatedCompletionTokens += response.usage?.completionTokens || 0;
    }

    const aggregatedResponse = chunkResults
      .map((chunk) => chunk.sanitizedResponseText)
      .filter(Boolean)
      .join("\n\n");

    const result: AiRouterResult = {
      success: true,
      model: selection.model,
      routingStrategy: {
        chunkCount: chunks.length,
        chunkSizeTokens: chunkTokenLimit,
        reasoningLevel: selection.reasoningLevel,
        requestedModel: normalizedRequest.preferredModel,
        automaticFallback: normalizedRequest.preferredModel !== undefined && normalizedRequest.preferredModel !== selection.model,
      },
      aggregatedResponse,
      chunks: chunkResults,
      metadata: {
        totalEstimatedPromptTokens: estimatedTokens,
        totalEstimatedCompletionTokens,
        requestId: `ai-router-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };

    return result;
  }

  private buildCombinedInput(request: AiRouterRequest): string {
    const sections = [
      request.context ? `Context:\n${request.context}` : undefined,
      `User Input:\n${request.input}`,
    ].filter((value): value is string => Boolean(value));

    return sections.join("\n\n");
  }

  private selectModel(request: AiRouterRequest, totalTokens: number): ModelSelection {
    if (request.preferredModel && MODEL_CONFIG[request.preferredModel]) {
      return {
        model: request.preferredModel,
        contextWindow: MODEL_CONFIG[request.preferredModel].contextTokens,
        reasoningLevel: request.reasoningLevel || "medium",
      };
    }

    if ((request.reasoningLevel === "high") || totalTokens > 18_000) {
      return {
        model: "@cf/openai/gpt-oss-120b",
        contextWindow: MODEL_CONFIG["@cf/openai/gpt-oss-120b"].contextTokens,
        reasoningLevel: request.reasoningLevel || "high",
      };
    }

    return {
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      contextWindow: MODEL_CONFIG["@cf/meta/llama-3.3-70b-instruct-fp8-fast"].contextTokens,
      reasoningLevel: request.reasoningLevel || "medium",
    };
  }

  private chunkText(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      let end = Math.min(cursor + maxChars, text.length);

      if (end < text.length) {
        const fallback = cursor + Math.floor(maxChars * 0.8);
        const newlineBreak = text.lastIndexOf("\n", end);
        const spaceBreak = text.lastIndexOf(" ", end);
        const breakPoint = Math.max(newlineBreak, spaceBreak, fallback);

        if (breakPoint > cursor) {
          end = Math.min(breakPoint + 1, text.length);
        }
      }

      const chunk = text.slice(cursor, end);
      chunks.push(chunk);
      cursor = end;
    }

    return chunks;
  }

  private async dispatchToModel(
    selection: ModelSelection,
    chunk: string,
    request: AiRouterRequest,
    index: number,
    chunkTokensEstimate: number,
  ): Promise<AiRouterChunkResult> {
    const payload = this.buildModelPayload(selection.model, chunk, request);
    const rawResponse = await this.env.AI.run(selection.model as any, payload as any);
    const { text, usage } = this.extractResponseText(rawResponse);
    const sanitized = this.sanitizeResponse(text);

    return {
      index,
      model: selection.model,
      requestTokensEstimate: chunkTokensEstimate,
      responseText: text,
      sanitizedResponseText: sanitized,
      usage,
    };
  }

  private buildModelPayload(
    model: "@cf/openai/gpt-oss-120b" | "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    chunk: string,
    request: AiRouterRequest,
  ): Record<string, unknown> {
    if (model === "@cf/openai/gpt-oss-120b") {
      const instructions = request.instructions || DEFAULT_SYSTEM_PROMPT;
      const promptSections = [instructions, chunk].filter(Boolean);
      const payload: Record<string, unknown> = {
        input: promptSections.join("\n\n"),
      };

      if (request.reasoningLevel) {
        payload.reasoning = {
          effort: request.reasoningLevel,
          summary: "auto",
        };
      }

      return payload;
    }

    const systemPrompt = request.instructions || DEFAULT_SYSTEM_PROMPT;
    const userContent = chunk;
    const payload: Record<string, unknown> = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    };

    if (request.maxOutputTokens) {
      payload.max_tokens = request.maxOutputTokens;
    }

    return payload;
  }

  private estimateTokens(text: string): number {
    if (!text) {
      return 0;
    }

    return Math.ceil(text.length / 4);
  }

  private extractResponseText(response: unknown): { text: string; usage?: AiRouterChunkResult["usage"] } {
    if (typeof response === "string") {
      return { text: response };
    }

    if (!response) {
      return { text: "" };
    }

    const record = response as Record<string, unknown>;

    if (typeof record.response === "string") {
      return {
        text: record.response,
        usage: this.extractUsage(record.usage),
      };
    }

    if (record.response && typeof record.response === "object") {
      const responseObject = record.response as Record<string, unknown>;
      if (typeof responseObject.text === "string") {
        return {
          text: responseObject.text,
          usage: this.extractUsage(record.usage),
        };
      }
    }

    if (Array.isArray(record.content)) {
      const text = (record.content as Array<Record<string, unknown>>)
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("");

      return {
        text,
        usage: this.extractUsage(record.usage),
      };
    }

    if (Array.isArray(record.choices)) {
      const choice = record.choices[0] as Record<string, unknown>;
      if (choice && typeof choice.message === "object") {
        const message = choice.message as Record<string, unknown>;
        if (typeof message.content === "string") {
          return {
            text: message.content,
            usage: this.extractUsage(record.usage),
          };
        }
        if (Array.isArray(message.content)) {
          const aggregated = (message.content as Array<Record<string, unknown>>)
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join("");
          return {
            text: aggregated,
            usage: this.extractUsage(record.usage),
          };
        }
      }
    }

    return {
      text: typeof response === "object" ? JSON.stringify(response) : String(response),
      usage: this.extractUsage((response as Record<string, unknown>).usage),
    };
  }

  private extractUsage(value: unknown): AiRouterChunkResult["usage"] | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const usage = value as Record<string, unknown>;
    return {
      promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
      completionTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
      totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
    };
  }

  private sanitizeResponse(text: string): string {
    if (!text) {
      return "";
    }

    let sanitized = text
      .replace(/```(?:json|markdown|[\w-]+)?\s*/gi, "")
      .replace(/'''(?:json|markdown|[\w-]+)?\s*/gi, "")
      .replace(/```/g, "")
      .replace(/'''/g, "");

    sanitized = sanitized.replace(/\u0000/g, "");
    sanitized = sanitized.trim();

    return sanitized;
  }
}
