/**
 * @module a2a-client
 * @description A2A (Agent-to-Agent) client for communicating with other A2A-enabled agents
 * following the A2A protocol standard from https://github.com/tanaikech/A2AApp
 */

import { Logger } from '../utils/logger';
import { A2AAgentCard, A2AExecuteRequest, A2AExecuteResponse } from '../types';

/**
 * A2A Client Configuration
 */
export interface A2AClientConfig {
  timeout?: number;
  retries?: number;
  logger?: Logger;
}

/**
 * A2A Agent Configuration
 */
export interface A2AAgentConfig {
  name: string;
  agentCardUrl: string;
  executeUrl: string;
  description?: string;
}

/**
 * A2A Client for communicating with other agents
 */
export class A2AClient {
  private config: A2AClientConfig;
  private logger: Logger;
  private agentCards: Map<string, A2AAgentCard> = new Map();

  constructor(config: A2AClientConfig = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    };
    this.logger = config.logger || {
      info: console.log,
      error: console.error,
      debug: console.debug,
      warn: console.warn
    } as Logger;
  }

  /**
   * Discover an agent by fetching its agent card
   */
  async discoverAgent(agentConfig: A2AAgentConfig): Promise<A2AAgentCard> {
    this.logger.info(`🔍 Discovering A2A agent: ${agentConfig.name}`);
    
    try {
      const response = await this.fetchWithRetry(agentConfig.agentCardUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent card: ${response.status} ${response.statusText}`);
      }
      
      const agentCard: A2AAgentCard = await response.json();
      
      // Validate agent card structure
      this.validateAgentCard(agentCard);
      
      // Cache the agent card
      this.agentCards.set(agentConfig.name, agentCard);
      
      this.logger.info(`✅ Discovered A2A agent: ${agentCard.name} with ${agentCard.skills.length} skills`);
      return agentCard;
      
    } catch (error) {
      this.logger.error(`❌ Failed to discover agent ${agentConfig.name}:`, error);
      throw error;
    }
  }

  /**
   * Execute a skill on a remote A2A agent
   */
  async executeSkill(
    agentConfig: A2AAgentConfig,
    skillId: string,
    parameters: any = {},
    metadata: any = {}
  ): Promise<A2AExecuteResponse> {
    const startTime = Date.now();
    const requestId = metadata.requestId || crypto.randomUUID();
    
    this.logger.info(`🚀 Executing A2A skill '${skillId}' on agent '${agentConfig.name}'`);
    
    try {
      // Ensure we have the agent card
      if (!this.agentCards.has(agentConfig.name)) {
        await this.discoverAgent(agentConfig);
      }
      
      const agentCard = this.agentCards.get(agentConfig.name)!;
      const skill = agentCard.skills.find(s => s.id === skillId);
      
      if (!skill) {
        throw new Error(`Skill '${skillId}' not found on agent '${agentConfig.name}'. Available skills: ${agentCard.skills.map(s => s.id).join(', ')}`);
      }
      
      // Prepare request
      const request: A2AExecuteRequest = {
        skill: skillId,
        parameters,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          source: 'cloudflare-workspace-agent',
          ...metadata
        }
      };
      
      // Execute the skill
      const response = await this.fetchWithRetry(agentConfig.executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'A2A-Cloudflare-Worker/1.0.0'
        },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`A2A execution failed: ${response.status} ${response.statusText}`);
      }
      
      const result: A2AExecuteResponse = await response.json();
      
      // Add execution metadata
      if (result.metadata) {
        result.metadata.executionTime = Date.now() - startTime;
        result.metadata.requestId = requestId;
      } else {
        result.metadata = {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime
        };
      }
      
      this.logger.info(`✅ A2A skill execution completed in ${result.metadata.executionTime}ms`);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ A2A skill execution failed after ${executionTime}ms:`, error);
      
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime
        }
      };
    }
  }

  /**
   * Get cached agent card
   */
  getCachedAgentCard(agentName: string): A2AAgentCard | undefined {
    return this.agentCards.get(agentName);
  }

  /**
   * List all cached agents
   */
  getCachedAgents(): string[] {
    return Array.from(this.agentCards.keys());
  }

  /**
   * Validate agent card structure
   */
  private validateAgentCard(agentCard: any): void {
    if (!agentCard.name || !agentCard.url || !agentCard.skills) {
      throw new Error('Invalid agent card: missing required fields (name, url, skills)');
    }
    
    if (!Array.isArray(agentCard.skills)) {
      throw new Error('Invalid agent card: skills must be an array');
    }
    
    for (const skill of agentCard.skills) {
      if (!skill.id || !skill.name || !skill.description) {
        throw new Error(`Invalid skill in agent card: missing required fields (id, name, description)`);
      }
    }
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= (this.config.retries || 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < (this.config.retries || 3)) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Fetch failed after all retries');
  }
}

/**
 * Pre-configured Google Docs AI Assistant agent configuration
 * Replace with your actual Google Docs agent URLs
 */
export const GOOGLE_DOCS_AGENT_CONFIG: A2AAgentConfig = {
  name: 'Google Docs AI Assistant',
  agentCardUrl: 'https://YOUR_GOOGLE_DOCS_AGENT_URL/.well-known/agent.json',
  executeUrl: 'https://YOUR_GOOGLE_DOCS_AGENT_URL/execute',
  description: 'AI assistant for Google Docs operations with vector search and conversational AI'
};

/**
 * Helper functions for common A2A operations
 */
export class A2AHelpers {
  constructor(private client: A2AClient) {}

  /**
   * Call Google Docs AI Assistant for document operations
   */
  async callGoogleDocsAgent(operations: any[], description?: string): Promise<A2AExecuteResponse> {
    return this.client.executeSkill(
      GOOGLE_DOCS_AGENT_CONFIG,
      'document_operations',
      {
        operations,
        description: description || 'Document operations from Cloudflare Worker'
      }
    );
  }

  /**
   * Perform vector search via Google Docs AI Assistant
   */
  async performVectorSearch(query: string, maxResults: number = 10): Promise<A2AExecuteResponse> {
    return this.client.executeSkill(
      GOOGLE_DOCS_AGENT_CONFIG,
      'vector_search',
      {
        query,
        maxResults
      }
    );
  }

  /**
   * Have a conversation with Google Docs AI Assistant
   */
  async conversationalAI(prompt: string, context?: any): Promise<A2AExecuteResponse> {
    return this.client.executeSkill(
      GOOGLE_DOCS_AGENT_CONFIG,
      'conversational_ai',
      {
        prompt,
        context
      }
    );
  }

  /**
   * Create a formatted document via A2A
   */
  async createFormattedDocument(title: string, content: any[]): Promise<A2AExecuteResponse> {
    const operations = [
      { type: 'insertText', index: 1, text: `${title}\n\n` },
      { type: 'setHeading', startIndex: 1, endIndex: title.length + 1, level: 1 },
      ...content
    ];
    
    return this.callGoogleDocsAgent(operations, `Creating document: ${title}`);
  }

  /**
   * Email to Document workflow
   */
  async emailToDocument(emailData: {
    subject: string;
    from: string;
    body: string;
    date: string;
  }): Promise<A2AExecuteResponse> {
    const operations = [
      { type: 'insertText', index: 1, text: `Email Report: ${emailData.subject}\n\n` },
      { type: 'setHeading', startIndex: 1, endIndex: `Email Report: ${emailData.subject}`.length + 1, level: 1 },
      { type: 'insertText', index: -1, text: `From: ${emailData.from}\n` },
      { type: 'insertText', index: -1, text: `Date: ${emailData.date}\n\n` },
      { type: 'insertText', index: -1, text: `Content:\n${emailData.body}\n\n` },
      { type: 'insertTable', index: -1, rows: 2, columns: 2 }
    ];
    
    return this.callGoogleDocsAgent(operations, `Email to document conversion: ${emailData.subject}`);
  }
}
