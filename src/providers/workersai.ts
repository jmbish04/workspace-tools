import { LanguageModelV2, LanguageModelV2StreamPart } from '@ai-sdk/provider';

export interface WorkersAIConfig {
  binding: Ai;
  model?: string;
  safePrompt?: boolean;
}

export class WorkersAILanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2';
  readonly provider = 'workersai';
  readonly modelId: string;
  readonly settings: WorkersAIConfig;

  constructor(modelId: string, settings: WorkersAIConfig) {
    this.modelId = modelId;
    this.settings = settings;
  }

  get defaultObjectGenerationMode(): 'auto' | 'tool' | undefined {
    return 'auto';
  }

  get supportedUrls(): Record<string, RegExp[]> {
    return {}; // Workers AI doesn't support URL inputs, return empty object
  }

  async doGenerate(options: any): Promise<any> {
    const { prompt, ...otherOptions } = options;
    
    // Convert messages to the format expected by Workers AI
    const messages = Array.isArray(prompt.messages) ? prompt.messages : [prompt.messages];
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      const response = await this.settings.binding.run(this.modelId as any, {
        messages: formattedMessages,
        max_tokens: otherOptions.maxTokens || 1000,
        temperature: otherOptions.temperature || 0.7,
        ...otherOptions
      }) as any;

      return {
        text: response.response || '',
        usage: {
          promptTokens: response.meta?.prompt_tokens || 0,
          completionTokens: response.meta?.completion_tokens || 0,
        },
        finishReason: 'stop',
        rawCall: {
          rawPrompt: prompt,
          rawSettings: otherOptions,
        },
      };
    } catch (error) {
      throw new Error(`Workers AI error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async doStream(options: any): Promise<any> {
    // For simplicity, we'll implement streaming by calling generate and yielding the result
    // Workers AI doesn't have native streaming support for all models
    const result = await this.doGenerate(options);
    
    return {
      stream: (async function* () {
        yield {
          type: 'text-delta' as const,
          textDelta: result.text,
        };
        yield {
          type: 'finish' as const,
          finishReason: result.finishReason,
          usage: result.usage,
        };
      })(),
      rawCall: result.rawCall,
    };
  }
}

export function createWorkersAI(config: WorkersAIConfig) {
  return (modelId: string, settings?: any) => {
    return new WorkersAILanguageModel(modelId, { ...config, ...settings });
  };
}
