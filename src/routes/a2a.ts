/**
 * @module a2a-routes
 * @description Routes for A2A (Agent-to-Agent) protocol endpoints
 */

import { Hono } from 'hono';
import { A2AServer } from '../services/a2a-server';
import { A2AClient, A2AHelpers, GOOGLE_DOCS_AGENT_CONFIG } from '../services/a2a-client';
import { createLoggerFromContext, Logger } from '../utils/logger';
import { A2AExecuteRequest, A2AExecuteResponse } from '../types';

// Create the router
const app = new Hono<{
  Bindings: Env & Record<string, unknown>;
  Variables: {
    logger: Logger;
  };
}>();

// A2A Server instance will be created per request to get the correct worker URL
let a2aClient: A2AClient | null = null;

/**
 * Get or create A2A client instance
 */
function getA2AClient(logger: Logger): A2AClient {
  if (!a2aClient) {
    a2aClient = new A2AClient({ logger });
  }
  return a2aClient;
}

// Note: /.well-known/agent.json and /execute endpoints are now handled directly in index.ts
// to avoid routing conflicts with static asset serving

/**
 * Health check endpoint for A2A monitoring
 * GET /a2a/health
 */
app.get('/health', (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.debug('🏥 A2A health check requested');
  
  return c.json({
    service: 'A2A Protocol',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    capabilities: {
      server: true,
      client: true,
      skills: 6
    }
  });
});

/**
 * Discover external A2A agents
 * POST /a2a/discover
 */
app.post('/discover', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('🔍 A2A agent discovery requested');
  
  try {
    const { name, agentCardUrl, executeUrl } = await c.req.json();
    
    if (!name || !agentCardUrl || !executeUrl) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, agentCardUrl, executeUrl'
      }, 400);
    }
    
    const client = getA2AClient(logger);
    const agentCard = await client.discoverAgent({
      name,
      agentCardUrl,
      executeUrl
    });
    
    return c.json({
      success: true,
      data: {
        agent: agentCard,
        cached: true
      }
    });
    
  } catch (error) {
    logger.error('Agent discovery failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Discovery failed'
    }, 500);
  }
});

/**
 * Execute skill on external A2A agent
 * POST /a2a/call
 */
app.post('/call', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('📞 A2A external skill call requested');
  
  try {
    const { agent, skill, parameters, metadata } = await c.req.json();
    
    if (!agent || !skill || !parameters) {
      return c.json({
        success: false,
        error: 'Missing required fields: agent, skill, parameters'
      }, 400);
    }
    
    const client = getA2AClient(logger);
    const response = await client.executeSkill(agent, skill, parameters, metadata);
    
    return c.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    logger.error('A2A external call failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'External call failed'
    }, 500);
  }
});

/**
 * Google Docs AI Assistant integration endpoints
 */

/**
 * Call Google Docs agent for document operations
 * POST /a2a/docs/operations
 */
app.post('/docs/operations', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('📝 Google Docs A2A operations requested');
  
  try {
    const { operations, description } = await c.req.json();
    
    if (!operations || !Array.isArray(operations)) {
      return c.json({
        success: false,
        error: 'Missing or invalid operations array'
      }, 400);
    }
    
    const client = getA2AClient(logger);
    const helpers = new A2AHelpers(client);
    const response = await helpers.callGoogleDocsAgent(operations, description);
    
    return c.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    logger.error('Google Docs A2A call failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Google Docs call failed'
    }, 500);
  }
});

/**
 * Perform vector search via Google Docs agent
 * POST /a2a/docs/search
 */
app.post('/docs/search', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('🔍 Google Docs A2A vector search requested');
  
  try {
    const { query, maxResults = 10 } = await c.req.json();
    
    if (!query) {
      return c.json({
        success: false,
        error: 'Missing required field: query'
      }, 400);
    }
    
    const client = getA2AClient(logger);
    const helpers = new A2AHelpers(client);
    const response = await helpers.performVectorSearch(query, maxResults);
    
    return c.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    logger.error('Google Docs vector search failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Vector search failed'
    }, 500);
  }
});

/**
 * Conversational AI via Google Docs agent
 * POST /a2a/docs/chat
 */
app.post('/docs/chat', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('💬 Google Docs A2A conversational AI requested');
  
  try {
    const { prompt, context } = await c.req.json();
    
    if (!prompt) {
      return c.json({
        success: false,
        error: 'Missing required field: prompt'
      }, 400);
    }
    
    const client = getA2AClient(logger);
    const helpers = new A2AHelpers(client);
    const response = await helpers.conversationalAI(prompt, context);
    
    return c.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    logger.error('Google Docs conversational AI failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Conversational AI failed'
    }, 500);
  }
});

/**
 * Cross-agent workflow: Email to Document
 * POST /a2a/workflows/email-to-doc
 */
app.post('/workflows/email-to-doc', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('📧➡️📄 A2A Email to Document workflow requested');
  
  try {
    const { messageId, documentTitle } = await c.req.json();
    
    if (!messageId) {
      return c.json({
        success: false,
        error: 'Missing required field: messageId'
      }, 400);
    }
    
    // 1. Get email data from Gmail
    const baseUrl = new URL(c.req.url).origin;
    const emailResponse = await fetch(`${baseUrl}/gmail/messages/${messageId}`);
    const emailData = await emailResponse.json() as { success: boolean; data?: any };
    
    if (!emailData.success) {
      throw new Error('Failed to fetch email data');
    }
    
    // 2. Use Google Docs AI Assistant to create formatted document
    const client = getA2AClient(logger);
    const helpers = new A2AHelpers(client);
    
    const response = await helpers.emailToDocument({
      subject: emailData.data?.subject || '',
      from: emailData.data?.from || '',
      body: emailData.data?.body || '',
      date: emailData.data?.date || ''
    });
    
    return c.json({
      success: true,
      data: {
        workflow: 'email-to-doc',
        messageId,
        result: response
      }
    });
    
  } catch (error) {
    logger.error('Email to Document workflow failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Workflow failed'
    }, 500);
  }
});

/**
 * List cached A2A agents
 * GET /a2a/agents
 */
app.get('/agents', (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.debug('📋 A2A cached agents list requested');
  
  const client = getA2AClient(logger);
  const cachedAgents = client.getCachedAgents();
  
  const agentDetails = cachedAgents.map(agentName => {
    const agentCard = client.getCachedAgentCard(agentName);
    return {
      name: agentName,
      description: agentCard?.description,
      skillCount: agentCard?.skills?.length || 0,
      url: agentCard?.url
    };
  });
  
  return c.json({
    success: true,
    data: {
      agents: agentDetails,
      totalCount: cachedAgents.length
    }
  });
});

/**
 * A2A configuration and status
 * GET /a2a/status
 */
app.get('/status', (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.debug('📊 A2A status requested');
  
  const workerUrl = new URL(c.req.url).origin;
  const a2aServer = new A2AServer(logger, workerUrl);
  const agentCard = a2aServer.getAgentCard();
  
  const client = getA2AClient(logger);
  const cachedAgents = client.getCachedAgents();
  
  return c.json({
    success: true,
    data: {
      server: {
        enabled: true,
        name: agentCard.name,
        skillCount: agentCard.skills.length,
        url: agentCard.url
      },
      client: {
        enabled: true,
        cachedAgents: cachedAgents.length
      },
      endpoints: {
        agentCard: `${workerUrl}/.well-known/agent.json`,
        execute: `${workerUrl}/execute`,
        health: `${workerUrl}/a2a/health`
      },
      googleDocsAgent: {
        configured: true,
        name: GOOGLE_DOCS_AGENT_CONFIG.name,
        agentCardUrl: GOOGLE_DOCS_AGENT_CONFIG.agentCardUrl,
        executeUrl: GOOGLE_DOCS_AGENT_CONFIG.executeUrl
      }
    }
  });
});

export { app as a2aRoutes };
