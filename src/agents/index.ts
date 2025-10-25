/**
 * @module agents
 * @description This module contains all the AI agents used in the workspace tools.
 * Each agent is responsible for a specific task and can use multiple AI providers.
 */

// Export all agent types and interfaces
export type { AgentResponse, AgentConfig } from "./base-agent";
export type { EmailReplyInput } from "./email-reply-agent";
export type { EmailAnalysisInput, EmailAnalysisResult } from "./email-analysis-agent";
export type { ContractAnalysisInput, ContractAnalysisResult } from "./contract-analysis-agent";
export type { AgentType, AgentFactoryConfig } from "./agent-factory";

// Export all agent classes
export { BaseAgent } from "./base-agent";
export { EmailReplyAgent } from "./email-reply-agent";
export { EmailAnalysisAgent } from "./email-analysis-agent";
export { ContractAnalysisAgent } from "./contract-analysis-agent";
export { AgentFactory } from "./agent-factory";