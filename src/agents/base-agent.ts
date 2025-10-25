/**
 * @module base-agent
 * @description Base agent class that provides the foundational structure for all AI agents.
 * It handles the logic for executing a prompt across multiple AI providers and aggregating their responses.
 */

import { BaseProvider, ProviderResponse } from "../providers";

/**
 * @interface AgentResponse
 * @description Defines the structure of the response returned by an agent after execution.
 * It includes the original prompt, responses from all providers, and an aggregated result.
 */
export interface AgentResponse {
  agentName: string;
  prompt: string;
  responses: ProviderResponse[];
  aggregatedResult?: {
    bestResponse?: ProviderResponse;
    consensus?: string;
    conflictingViews?: string[];
    metadata: {
      totalProviders: number;
      successfulProviders: number;
      failedProviders: number;
      averageResponseTime: number;
    };
  };
  timestamp: string;
}

/**
 * @interface AgentConfig
 * @description Defines the configuration for an agent.
 * This includes its name, description, the providers it uses, and parameters for generation like temperature and max tokens.
 */
export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  providers: string[]; // Which providers to use
  temperature?: number;
  maxTokens?: number;
  aggregationStrategy?: "best" | "consensus" | "all" | "first_success";
}

/**
 * @abstract
 * @class BaseAgent
 * @description An abstract class that provides the foundational structure for all AI agents.
 * It handles the logic for executing a prompt across multiple AI providers and aggregating their responses.
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected providers: Map<string, BaseProvider>;

  /**
   * Creates an instance of BaseAgent.
   * @param {AgentConfig} config The configuration for the agent.
   * @param {Map<string, BaseProvider>} providers A map of available AI providers.
   */
  constructor(config: AgentConfig, providers: Map<string, BaseProvider>) {
    this.config = config;
    this.providers = providers;
    console.log(`[${this.config.name}] Agent initialized with providers: ${Array.from(providers.keys()).join(', ')}`);
  }

  /**
   * Generates the system prompt for the agent, optionally using context.
   * @abstract
   * @param {any} [context] Optional context to tailor the system prompt.
   * @returns {string} The system prompt.
   */
  abstract getSystemPrompt(context?: any): string;

  /**
   * Formats the user input into a full prompt for the AI model.
   * @abstract
   * @param {any} input The user-provided input for the agent.
   * @param {any} [context] Optional context to help format the prompt.
   * @returns {string} The formatted prompt.
   */
  abstract formatPrompt(input: any, context?: any): string;

  /**
   * An optional method to post-process the agent's response before returning it.
   * @abstract
   * @param {AgentResponse} response The response from the agent.
   * @returns {AgentResponse} The post-processed response.
   */
  abstract postProcessResponse?(response: AgentResponse): AgentResponse;

  /**
   * Executes the agent's task by sending a prompt to the configured AI providers.
   * @param {any} input The input data for the agent.
   * @param {any} [context] Optional context to guide the execution.
   * @returns {Promise<AgentResponse>} A promise that resolves to the agent's response.
   */
  async execute(input: any, context?: any): Promise<AgentResponse> {
    const startTime = Date.now();
    console.log(`[${this.config.name}] Starting execution at ${new Date(startTime).toISOString()}`);

    const prompt = this.formatPrompt(input, context);
    const systemPrompt = this.getSystemPrompt(context);
    console.log(`[${this.config.name}] Using aggregation strategy: ${this.config.aggregationStrategy}`);

    const responses: ProviderResponse[] = [];

    // Execute with specified providers
    const promises = this.config.providers.map(async (providerName) => {
      const provider = this.providers.get(providerName);
      if (!provider) {
        console.warn(`[${this.config.name}] Provider ${providerName} not available.`);
        return null;
      }

      console.log(`[${this.config.name}] Sending prompt to provider: ${providerName}`);
      try {
        const providerResponse = await provider.generate(prompt, {
          systemPrompt,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        });
        console.log(`[${this.config.name}] Received response from ${providerName} in ${providerResponse.metadata?.responseTime}ms.`);
        return providerResponse;
      } catch (error) {
        console.error(`[${this.config.name}] Error with provider ${providerName}:`, error);
        return {
          provider: providerName,
          model: provider.model,
          content: "",
          metadata: { error: error instanceof Error ? error.message : String(error) },
        } as ProviderResponse;
      }
    });

    const results = await Promise.all(promises);
    responses.push(...results.filter((result): result is ProviderResponse => result !== null));

    console.log(`[${this.config.name}] Aggregating ${responses.length} responses.`);
    const aggregatedResult = this.aggregateResponses(responses);

    const agentResponse: AgentResponse = {
      agentName: this.config.name,
      prompt,
      responses,
      aggregatedResult,
      timestamp: new Date().toISOString(),
    };

    const finalResponse = this.postProcessResponse ? this.postProcessResponse(agentResponse) : agentResponse;
    const duration = Date.now() - startTime;
    console.log(`[${this.config.name}] Execution finished. Duration: ${duration}ms`);

    return finalResponse;
  }

  /**
   * Aggregates responses from multiple providers based on the configured strategy.
   * @private
   * @param {ProviderResponse[]} responses An array of responses from the AI providers.
   * @returns {AgentResponse['aggregatedResult']} The aggregated result.
   */
  private aggregateResponses(responses: ProviderResponse[]) {
    const successful = responses.filter(r => !r.metadata?.error);
    const failed = responses.filter(r => r.metadata?.error);

    const totalResponseTime = responses.reduce((sum, r) => sum + (r.metadata?.responseTime || 0), 0);
    const averageResponseTime = responses.length > 0 ? totalResponseTime / responses.length : 0;

    let bestResponse: ProviderResponse | undefined;
    let consensus: string | undefined;
    let conflictingViews: string[] = [];

    // Simple aggregation strategies
    switch (this.config.aggregationStrategy) {
      case "best":
        bestResponse = successful[0];
        console.log(`[${this.config.name}] Aggregation (best): Selected response from ${bestResponse?.provider}`);
        break;

      case "first_success":
        bestResponse = successful[0];
        console.log(`[${this.config.name}] Aggregation (first_success): Selected response from ${bestResponse?.provider}`);
        break;

      case "consensus":
        if (successful.length > 1) {
          const contents = successful.map(r => r.content);
          const unique = [...new Set(contents)];
          if (unique.length === 1) {
            consensus = unique[0];
            console.log(`[${this.config.name}] Aggregation (consensus): Found consensus among ${successful.length} providers.`);
          } else {
            conflictingViews = unique;
            console.log(`[${this.config.name}] Aggregation (consensus): Found ${conflictingViews.length} conflicting views.`);
          }
        }
        break;

      case "all":
      default:
        console.log(`[${this.config.name}] Aggregation (all): Returning all responses for manual evaluation.`);
        break;
    }

    return {
      bestResponse,
      consensus,
      conflictingViews,
      metadata: {
        totalProviders: responses.length,
        successfulProviders: successful.length,
        failedProviders: failed.length,
        averageResponseTime,
      },
    };
  }
}
