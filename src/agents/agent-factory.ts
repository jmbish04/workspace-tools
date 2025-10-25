/**
 * @module agent-factory
 * @description Factory class for creating and managing AI agents.
 * It provides a centralized way to instantiate and configure different types of agents.
 */

import { BaseAgent, AgentConfig } from "./base-agent";
import { EmailReplyAgent, EmailReplyInput } from "./email-reply-agent";
import { EmailAnalysisAgent, EmailAnalysisInput } from "./email-analysis-agent";
import { ContractAnalysisAgent, ContractAnalysisInput } from "./contract-analysis-agent";
import { BaseProvider } from "../providers";

/**
 * @type AgentType
 * @description Union type of all available agent types.
 */
export type AgentType = "email-reply" | "email-analysis" | "contract-analysis";

/**
 * @interface AgentFactoryConfig
 * @description Configuration for the AgentFactory.
 * It includes default settings and provider configurations.
 */
export interface AgentFactoryConfig {
  defaultProviders: string[];
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultAggregationStrategy: "best" | "consensus" | "all" | "first_success";
}

/**
 * @class AgentFactory
 * @description Factory class for creating and managing AI agents.
 * It provides a centralized way to instantiate and configure different types of agents.
 */
export class AgentFactory {
  private providers: Map<string, BaseProvider>;
  private config: AgentFactoryConfig;

  /**
   * Creates an instance of AgentFactory.
   * @param {Map<string, BaseProvider>} providers A map of available AI providers.
   * @param {AgentFactoryConfig} config The configuration for the factory.
   */
  constructor(providers: Map<string, BaseProvider>, config: AgentFactoryConfig) {
    this.providers = providers;
    this.config = config;
    console.log(`[AgentFactory] Initialized with ${providers.size} providers: ${Array.from(providers.keys()).join(', ')}`);
  }

  /**
   * Creates a new agent of the specified type.
   * @param {AgentType} type The type of agent to create.
   * @param {Partial<AgentConfig>} [overrides] Optional configuration overrides.
   * @returns {BaseAgent} The created agent.
   * @throws {Error} If the agent type is not supported or if required providers are not available.
   */
  createAgent(type: AgentType, overrides?: Partial<AgentConfig>): BaseAgent {
    console.log(`[AgentFactory] Creating agent of type: ${type}`);

    const baseConfig: AgentConfig = {
      name: `${type}-agent`,
      description: this.getAgentDescription(type),
      systemPrompt: this.getDefaultSystemPrompt(type),
      providers: overrides?.providers || this.config.defaultProviders,
      temperature: overrides?.temperature ?? this.config.defaultTemperature,
      maxTokens: overrides?.maxTokens ?? this.config.defaultMaxTokens,
      aggregationStrategy: overrides?.aggregationStrategy ?? this.config.defaultAggregationStrategy,
      ...overrides
    };

    // Validate that all required providers are available
    const missingProviders = baseConfig.providers.filter(provider => !this.providers.has(provider));
    if (missingProviders.length > 0) {
      throw new Error(`Missing required providers: ${missingProviders.join(', ')}`);
    }

    switch (type) {
      case "email-reply":
        return new EmailReplyAgent(baseConfig, this.providers);
      
      case "email-analysis":
        return new EmailAnalysisAgent(baseConfig, this.providers);
      
      case "contract-analysis":
        return new ContractAnalysisAgent(baseConfig, this.providers);
      
      default:
        throw new Error(`Unsupported agent type: ${type}`);
    }
  }

  /**
   * Gets the description for a specific agent type.
   * @private
   * @param {AgentType} type The agent type.
   * @returns {string} The agent description.
   */
  private getAgentDescription(type: AgentType): string {
    const descriptions: Record<AgentType, string> = {
      "email-reply": "Agent responsible for generating professional email replies based on the content of the original email",
      "email-analysis": "Agent responsible for analyzing emails to determine their tone, formality, and other characteristics",
      "contract-analysis": "Agent responsible for analyzing contracts and legal documents for terms, risks, and compliance"
    };
    
    return descriptions[type];
  }

  /**
   * Gets the default system prompt for a specific agent type.
   * @private
   * @param {AgentType} type The agent type.
   * @returns {string} The default system prompt.
   */
  private getDefaultSystemPrompt(type: AgentType): string {
    const prompts: Record<AgentType, string> = {
      "email-reply": "You are an AI assistant specialized in generating professional email replies. Your task is to analyze the original email and generate an appropriate reply that matches the tone, formality, and context of the original message.",
      "email-analysis": "You are an AI assistant specialized in analyzing emails for tone, formality, completeness, and other characteristics. Your task is to provide detailed insights and recommendations for improving email communication.",
      "contract-analysis": "You are an AI assistant specialized in analyzing contracts and legal documents. Your task is to provide comprehensive insights into contract terms, risks, compliance issues, and actionable recommendations."
    };
    
    return prompts[type];
  }

  /**
   * Gets all available agent types.
   * @returns {AgentType[]} An array of all available agent types.
   */
  getAvailableAgentTypes(): AgentType[] {
    return ["email-reply", "email-analysis", "contract-analysis"];
  }

  /**
   * Gets the configuration for a specific agent type.
   * @param {AgentType} type The agent type.
   * @returns {Partial<AgentConfig>} The default configuration for the agent type.
   */
  getDefaultConfig(type: AgentType): Partial<AgentConfig> {
    const configs: Record<AgentType, Partial<AgentConfig>> = {
      "email-reply": {
        name: "email-reply-agent",
        description: this.getAgentDescription(type),
        systemPrompt: this.getDefaultSystemPrompt(type),
        providers: this.config.defaultProviders,
        temperature: 0.7,
        maxTokens: 1000,
        aggregationStrategy: "best"
      },
      "email-analysis": {
        name: "email-analysis-agent",
        description: this.getAgentDescription(type),
        systemPrompt: this.getDefaultSystemPrompt(type),
        providers: this.config.defaultProviders,
        temperature: 0.3,
        maxTokens: 2000,
        aggregationStrategy: "consensus"
      },
      "contract-analysis": {
        name: "contract-analysis-agent",
        description: this.getAgentDescription(type),
        systemPrompt: this.getDefaultSystemPrompt(type),
        providers: this.config.defaultProviders,
        temperature: 0.2,
        maxTokens: 4000,
        aggregationStrategy: "consensus"
      }
    };
    
    return configs[type];
  }

  /**
   * Validates that all required providers are available for a specific agent type.
   * @param {AgentType} type The agent type.
   * @param {string[]} providers The providers to validate.
   * @returns {boolean} True if all providers are available, false otherwise.
   */
  validateProviders(type: AgentType, providers: string[]): boolean {
    const missingProviders = providers.filter(provider => !this.providers.has(provider));
    if (missingProviders.length > 0) {
      console.warn(`[AgentFactory] Missing providers for ${type}: ${missingProviders.join(', ')}`);
      return false;
    }
    return true;
  }

  /**
   * Gets information about all available agents.
   * @returns {Array<{type: AgentType, description: string, config: Partial<AgentConfig>}>} An array of agent information.
   */
  getAgentInfo(): Array<{type: AgentType, description: string, config: Partial<AgentConfig>}> {
    return this.getAvailableAgentTypes().map(type => ({
      type,
      description: this.getAgentDescription(type),
      config: this.getDefaultConfig(type)
    }));
  }
}
