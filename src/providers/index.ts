/**
 * @module providers
 * @description This module provides a standardized interface for interacting with various AI model providers.
 * It includes a factory for creating provider instances, default configurations, and specific class implementations
 * for providers like Gemini, Anthropic, OpenAI, and Cloudflare Workers AI. The goal is to abstract away the
 * complexities of each provider's SDK, allowing agents to interact with them through a common `BaseProvider` interface.
 */

// Import new ChatProvider implementations
import { ChatProviderAdapter } from "./adapter";
import { AnthropicProvider as ChatAnthropicProvider } from "./anthropic";
import { CloudflareAIProvider as ChatCloudflareAIProvider } from "./cfai";
import { GeminiProvider as ChatGeminiProvider } from "./gemini";
import { OpenAIProvider as ChatOpenAIProvider } from "./openai";

/**
 * @interface ProviderConfig
 * @description Defines the configuration for a single AI provider, including the model to use and generation parameters.
 */
export interface ProviderConfig {
  name: string;
  enabled: boolean;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * @interface ProvidersConfig
 * @description A collection of configurations for all supported AI providers.
 */
export interface ProvidersConfig {
  gemini: ProviderConfig;
  anthropic: ProviderConfig;
  openai: ProviderConfig;
  workersAI: ProviderConfig;
}

/**
 * @const {ProvidersConfig} defaultProvidersConfig
 * @description Default configurations for the supported AI providers.
 * These can be overridden as needed.
 */
export const defaultProvidersConfig: ProvidersConfig = {
  gemini: {
    name: "Gemini",
    enabled: true,
    model: "gemini-2.0-flash-exp",
    maxTokens: 4096,
    temperature: 0.7,
  },
  anthropic: {
    name: "Claude",
    enabled: true,
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 4096,
    temperature: 0.7,
  },
  openai: {
    name: "OpenAI",
    enabled: true,
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.7,
  },
  workersAI: {
    name: "Workers AI",
    enabled: true,
    model: "@cf/meta/llama-3.1-8b-instruct",
    maxTokens: 4096,
    temperature: 0.7,
  },
};

/**
 * @interface ProviderResponse
 * @description Defines the standardized response structure from any AI provider.
 * It includes the generated content, usage statistics, and metadata about the request.
 */
export interface ProviderResponse {
  provider: string;
  model: string;
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: {
    finishReason?: string;
    responseTime?: number;
    error?: string;
  };
}

/**
 * @interface BaseProvider
 * @description Defines the common interface that all provider classes must implement.
 * This ensures that agents can interact with any provider in a consistent way.
 */
export interface BaseProvider {
  name: string;
  model: string;
  generate(prompt: string, options?: any): Promise<ProviderResponse>;
}

/**
 * @class ProviderFactory
 * @description A factory class for creating instances of AI providers based on configuration.
 * It handles the logic for checking API keys and initializing the correct provider class.
 * Updated to use the new ChatProvider implementations via adapters.
 */
export class ProviderFactory {
  /**
   * Creates a single provider instance using the new ChatProvider implementations.
   * @static
   * @param {string} providerName The name of the provider to create.
   * @param {ProviderConfig} config The configuration for the provider.
   * @param {any} env The worker's environment object.
   * @returns {(BaseProvider | null)} An instance of the provider, or null if it's disabled or misconfigured.
   */
  static createProvider(
    providerName: string,
    config: ProviderConfig,
    env: any
  ): BaseProvider | null {
    if (!config.enabled) {
      console.log(`[ProviderFactory] Provider '${providerName}' is disabled in config.`);
      return null;
    }

    switch (providerName.toLowerCase()) {
      case "gemini":
        if (!env.GEMINI_API_KEY) {
          console.warn("[ProviderFactory] GEMINI_API_KEY not found, skipping Gemini provider.");
          return null;
        }
        console.log(`[ProviderFactory] Creating GeminiProvider with model: ${config.model}`);
        const geminiChatProvider = new ChatGeminiProvider();
        return new ChatProviderAdapter(geminiChatProvider, config, env);

      case "anthropic":
        if (!env.ANTHROPIC_API_KEY) {
          console.warn("[ProviderFactory] ANTHROPIC_API_KEY not found, skipping Anthropic provider.");
          return null;
        }
        console.log(`[ProviderFactory] Creating AnthropicProvider with model: ${config.model}`);
        const anthropicChatProvider = new ChatAnthropicProvider();
        return new ChatProviderAdapter(anthropicChatProvider, config, env);

      case "openai":
        if (!env.OPENAI_API_KEY) {
          console.warn("[ProviderFactory] OPENAI_API_KEY not found, skipping OpenAI provider.");
          return null;
        }
        console.log(`[ProviderFactory] Creating OpenAIProvider with model: ${config.model}`);
        const openaiChatProvider = new ChatOpenAIProvider();
        return new ChatProviderAdapter(openaiChatProvider, config, env);

      case "workersai":
      case "cfai":
        if (!env.AI) {
          console.warn("[ProviderFactory] Workers AI binding not found, skipping Workers AI provider.");
          return null;
        }
        console.log(`[ProviderFactory] Creating CloudflareAIProvider with model: ${config.model}`);
        const cfaiChatProvider = new ChatCloudflareAIProvider();
        return new ChatProviderAdapter(cfaiChatProvider, config, env);

      default:
        console.warn(`[ProviderFactory] Unknown provider requested: ${providerName}`);
        return null;
    }
  }

  /**
   * Creates a map of all enabled and correctly configured providers.
   * @static
   * @param {ProvidersConfig} providersConfig The configuration for all providers.
   * @param {any} env The worker's environment object.
   * @returns {Map<string, BaseProvider>} A map where keys are provider names and values are provider instances.
   */
  static createProviders(
    providersConfig: ProvidersConfig,
    env: any
  ): Map<string, BaseProvider> {
    const providers = new Map<string, BaseProvider>();

    for (const [name, config] of Object.entries(providersConfig)) {
      const provider = this.createProvider(name, config, env);
      if (provider) {
        providers.set(name, provider);
      }
    }

    return providers;
  }
}
