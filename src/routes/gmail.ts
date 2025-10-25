import { Hono } from "hono";
import { AgentFactory } from "../agents";
import { defaultProvidersConfig, ProviderResponse, ProviderFactory } from "../providers";
import { Env, EmbeddingResult, GmailMessage, GmailSearchResult, GmailThread, WorkspaceToolResponse } from "../types";
import { decodeBase64Url, extractEmailFromHeaders, GoogleApiClient } from "../utils/google-api";
import { InlineReply, ProcessedMessage, processThreadForRAG } from "../utils/rag-processor";
import {
  analyzeTone,
  analyzeFormalityLevel,
  analyzeDirectness,
  analyzePoliteness,
  analyzeCompleteness,
  generateImprovementSuggestions,
  summarizeToneDistribution,
  determineRecommendedProvider,
  findMostFormal,
  findMostDirect,
  findMostPolite,
  findMostComplete,
  calculateQualityScore,
  analyzeRiskAddressing,
  generateWorkflowRecommendations
} from "../utils/email-analysis";
import { validateGmailSearchQuery, validateGmailMessageRequest, validateEmailDraftRequest } from "../utils/validation";

/**
 * @module gmailRoutes
 * @description Provides Hono routes for interacting with the Gmail API.
 * This module includes functionalities for searching emails, reading message content,
 * generating embeddings, and drafting replies using various AI providers.
 * It also features advanced capabilities like multi-provider response comparison
 * and comprehensive email analysis workflows.
 * @requires hono
 * @requires ../agents
 * @requires ../index
 * @requires ../providers
 * @requires ../types
 * @requires ../utils/google-api
 * @requires ../utils/rag-processor
 */
export const gmailRoutes = new Hono<{ Bindings: Env & Record<string, unknown> }>();

// Email content analysis utilities are now imported from ../utils/email-analysis

/**
 * @route POST /search
 * @description Searches for Gmail messages based on a query.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the search results or an error.
 * @example
 *
 * {
 *   "query": "from:example@example.com",
 *   "user": "user-identifier",
 *   "maxResults": 10
 * }
 */
gmailRoutes.post("/search", async (c) => {
  try {
    const requestData = await c.req.json();
    
    // Validate input
    const validation = validateGmailSearchQuery(requestData.query);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search query',
          details: validation.errors
        }
      }, 400);
    }

    const { query, user, maxResults = 10, testMode = false } = {
      ...requestData,
      query: validation.sanitizedData?.query || requestData.query,
      testMode: requestData.testMode || false
    };

    // Check if this is a test from the dashboard
    if (testMode || query === 'from:test@example.com') {
      console.log("[Gmail Search] Running in test mode - returning mock data");
      const response: WorkspaceToolResponse = {
        success: true,
        data: {
          messages: [
            {
              id: "mock_message_1",
              threadId: "mock_thread_1"
            },
            {
              id: "mock_message_2", 
              threadId: "mock_thread_2"
            }
          ],
          resultSizeEstimate: 2,
          nextPageToken: null,
          query,
          testMode: true
        },
        timestamp: new Date().toISOString(),
      };
      return c.json(response);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Check if we have the necessary authentication configured
    if (!c.env.GOOGLE_SERVICE_ACCOUNT_KEY && !c.env.KV) {
      console.log("[Gmail Search] No authentication configured, returning test response");
      return c.json({
        success: false,
        error: "Gmail search requires GOOGLE_SERVICE_ACCOUNT_KEY or OAuth configuration",
        details: "Configure Google service account or OAuth in environment variables",
        timestamp: new Date().toISOString(),
      }, 503);
    }

    const searchParams = new URLSearchParams({
      q: query,
      maxResults: Math.min(maxResults, 100).toString(),
    });

    const result: GmailSearchResult = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages?${searchParams.toString()}`,
      { method: "GET" },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        messages: result.messages || [],
        resultSizeEstimate: result.resultSizeEstimate,
        nextPageToken: result.nextPageToken,
        query,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail search error:", error);
    
    // Provide more specific error messages based on the type of error
    let errorMessage = "Failed to search Gmail";
    let errorDetails = "";
    
    if (error.error && error.error.code === 401) {
      errorMessage = "Gmail authentication failed";
      errorDetails = "Check Google service account configuration or OAuth tokens";
    } else if (error.error && error.error.code === 403) {
      errorMessage = "Gmail access forbidden";
      errorDetails = "Service account may need Gmail API permissions or domain-wide delegation";
    } else if (error.message && error.message.includes("Service account")) {
      errorMessage = "Service account authentication failed";
      errorDetails = "Check GOOGLE_SERVICE_ACCOUNT_KEY format and permissions";
    } else if (error.message && error.message.includes("No valid authentication")) {
      errorMessage = "No valid Gmail authentication available";
      errorDetails = "Configure service account key or OAuth in environment variables";
    }
    
    return c.json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      originalError: error.message,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /message/plaintext
 * @description Retrieves the plaintext content of a specific Gmail message.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the message content or an error.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/message/plaintext", async (c) => {
  try {
    const requestData = await c.req.json();
    
    // Validate input
    const validation = validateGmailMessageRequest(requestData);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid message request',
          details: validation.errors
        }
      }, 400);
    }

    const { messageId, user } = validation.sanitizedData!;

    const googleApi = new GoogleApiClient(c.env);

    const message: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${messageId}`,
      { method: "GET" },
      user
    );

    // Extract text content
    let textContent = "";

    if (message.payload.body?.data) {
      textContent = decodeBase64Url(message.payload.body.data);
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          textContent += decodeBase64Url(part.body.data);
        }
      }
    }

    const headers = extractEmailFromHeaders(message.payload.headers);

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        messageId,
        threadId: message.threadId,
        snippet: message.snippet,
        textContent,
        headers,
        internalDate: message.internalDate,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail read plaintext error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Gmail message",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /message/html
 * @description Retrieves the HTML content of a specific Gmail message.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the message's HTML content or an error.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/message/html", async (c) => {
  try {
    const requestData = await c.req.json();
    
    // Validate input
    const validation = validateGmailMessageRequest(requestData);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid message request',
          details: validation.errors
        }
      }, 400);
    }

    const { messageId, user } = validation.sanitizedData!;

    const googleApi = new GoogleApiClient(c.env);

    const message: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${messageId}`,
      { method: "GET" },
      user
    );

    // Extract HTML content
    let htmlContent = "";
    let textContent = "";

    if (message.payload.body?.data) {
      textContent = decodeBase64Url(message.payload.body.data);
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === "text/html" && part.body.data) {
          htmlContent += decodeBase64Url(part.body.data);
        } else if (part.mimeType === "text/plain" && part.body.data) {
          textContent += decodeBase64Url(part.body.data);
        }
      }
    }

    const headers = extractEmailFromHeaders(message.payload.headers);

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        messageId,
        threadId: message.threadId,
        snippet: message.snippet,
        htmlContent: htmlContent || textContent,
        textContent,
        headers,
        internalDate: message.internalDate,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail read HTML error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Gmail message",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /message/embeddings
 * @description Retrieves a Gmail message, extracts its text content, and generates embeddings for the text.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the message details and text embeddings.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "user": "user-identifier",
 *   "model": "text-embedding-ada-002"
 * }
 */
gmailRoutes.post("/message/embeddings", async (c) => {
  try {
    const { messageId, user, model = "text-embedding-ada-002" } = await c.req.json();

    if (!messageId) {
      return c.json({ error: "messageId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const message: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${messageId}`,
      { method: "GET" },
      user
    );

    // Extract text content
    let textContent = "";

    if (message.payload.body?.data) {
      textContent = decodeBase64Url(message.payload.body.data);
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          textContent += decodeBase64Url(part.body.data);
        }
      }
    }

    // Get embeddings from AI worker
    const embeddingResponse = await c.env.AI_AGENT_WORKER.fetch("/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: textContent,
        model,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error("Failed to generate embeddings");
    }

    const embeddingResult: EmbeddingResult = await embeddingResponse.json();
    const headers = extractEmailFromHeaders(message.payload.headers);

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        messageId,
        threadId: message.threadId,
        snippet: message.snippet,
        headers,
        internalDate: message.internalDate,
        embeddings: embeddingResult.embedding,
        model: embeddingResult.model,
        usage: embeddingResult.usage,
        textLength: textContent.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail embeddings error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to get message embeddings",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /reply/draft
 * @description Drafts email replies using multiple AI providers based on a given message and context.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing draft replies from various providers and recommendations.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "replyText": "A brief on what to reply.",
 *   "providers": ["gemini", "anthropic"],
 *   "tone": "professional",
 *   "additionalInstructions": "Keep it concise.",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/reply/draft", async (c) => {
  try {
    const {
      messageId,
      replyText,
      providers = ["gemini", "anthropic", "openai"],
      tone = "professional",
      additionalInstructions,
      user
    } = await c.req.json();

    if (!messageId) {
      return c.json({ error: "messageId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get the original message to understand context
    const originalMessage: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${messageId}`,
      { method: "GET" },
      user
    );

    // Extract original message content
    let originalContent = "";
    if (originalMessage.payload.body?.data) {
      originalContent = decodeBase64Url(originalMessage.payload.body.data);
    } else if (originalMessage.payload.parts) {
      for (const part of originalMessage.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          originalContent += decodeBase64Url(part.body.data);
        }
      }
    }

    const originalHeaders = extractEmailFromHeaders(originalMessage.payload.headers);

    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: providers,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });

    // Create email reply agent with selected providers
    const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
      temperature: 0.7,
      maxTokens: 2048,
      aggregationStrategy: "all"
    });

    // Prepare input for the agent
    const agentInput = {
      originalEmail: {
        from: originalHeaders.from,
        to: originalHeaders.to,
        subject: originalHeaders.subject,
        date: originalHeaders.date,
        content: originalContent
      },
      replyContext: replyText || "Please provide a professional response to this email"
    };

    // Prepare context for the agent
    const agentContext = {
      tone,
      additionalInstructions,
      specificPoints: additionalInstructions ? [additionalInstructions] : undefined
    };

    // Execute the agent to get responses from multiple providers
    const agentResponse = await emailAgent.execute(agentInput, agentContext);

    // Format the response for the client
    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        originalMessage: {
          messageId,
          from: originalHeaders.from,
          subject: originalHeaders.subject,
          snippet: originalMessage.snippet
        },
        draftReplies: agentResponse.responses.map((providerResponse: ProviderResponse) => ({
          provider: providerResponse.provider,
          model: providerResponse.model,
          draftContent: providerResponse.content,
          usage: providerResponse.usage,
          responseTime: providerResponse.metadata?.responseTime,
          error: providerResponse.metadata?.error
        })),
        aggregation: agentResponse.aggregatedResult,
        recommendations: {
          bestProvider: agentResponse.aggregatedResult?.bestResponse?.provider,
          providerComparison: agentResponse.responses.map((r: ProviderResponse) => ({
            provider: r.provider,
            hasError: !!r.metadata?.error,
            contentLength: r.content.length,
            tone: analyzeTone(r.content),
            formality: analyzeFormalityLevel(r.content)
          }))
        },
        metadata: {
          requestedProviders: providers,
          successfulProviders: agentResponse.responses.filter((r: ProviderResponse) => !r.metadata?.error).length,
          totalResponseTime: agentResponse.aggregatedResult?.metadata.averageResponseTime,
          timestamp: agentResponse.timestamp
        }
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail multi-provider reply draft error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to draft email replies",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /reply/compare
 * @description Generates email drafts from multiple AI providers and provides a detailed comparison based on specified criteria.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with a detailed comparison of the generated drafts.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "replyText": "Explain the delay.",
 *   "providers": ["gemini", "anthropic"],
 *   "comparisonCriteria": ["tone", "directness"],
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/reply/compare", async (c) => {
  try {
    const {
      messageId,
      replyText,
      providers = ["gemini", "anthropic", "openai", "workersAI"],
      comparisonCriteria = ["tone", "directness", "politeness", "completeness"],
      user
    } = await c.req.json();

    if (!messageId) {
      return c.json({ error: "messageId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get the original message
    const originalMessage: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${messageId}`,
      { method: "GET" },
      user
    );

    let originalContent = "";
    if (originalMessage.payload.body?.data) {
      originalContent = decodeBase64Url(originalMessage.payload.body.data);
    } else if (originalMessage.payload.parts) {
      for (const part of originalMessage.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          originalContent += decodeBase64Url(part.body.data);
        }
      }
    }

    const originalHeaders = extractEmailFromHeaders(originalMessage.payload.headers);

    // Create agent factory and email reply agent
    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: providers,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });
    const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
      temperature: 0.7,
      maxTokens: 2048,
      aggregationStrategy: "all"
    });

    // Get drafts from all providers
    const agentInput = {
      originalEmail: {
        from: originalHeaders.from,
        to: originalHeaders.to,
        subject: originalHeaders.subject,
        date: originalHeaders.date,
        content: originalContent
      },
      replyContext: replyText || "Please provide a professional response to this email"
    };

    const agentResponse = await emailAgent.execute(agentInput, {
      tone: "professional"
    });

    // Analyze and compare the responses
    const comparisons = agentResponse.responses.map((response: ProviderResponse) => {
      const analysis = {
        provider: response.provider,
        model: response.model,
        content: response.content,
        analysis: {
          wordCount: response.content.split(/\s+/).length,
          sentenceCount: response.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length,
          tone: analyzeTone(response.content),
          formalityLevel: analyzeFormalityLevel(response.content),
          directness: analyzeDirectness(response.content),
          politeness: analyzePoliteness(response.content),
          completeness: analyzeCompleteness(response.content, originalContent)
        },
        usage: response.usage,
        responseTime: response.metadata?.responseTime,
        hasError: !!response.metadata?.error,
        error: response.metadata?.error
      };

      return analysis;
    });

    // Generate summary comparison
    const summary = {
      totalProviders: providers.length,
      successfulResponses: comparisons.filter((c: any) => !c.hasError).length,
      averageWordCount: Math.round(
        comparisons.filter((c: any) => !c.hasError).reduce((sum: number, c: any) => sum + c.analysis.wordCount, 0) /
        comparisons.filter((c: any) => !c.hasError).length
      ),
      toneDistribution: summarizeToneDistribution(comparisons),
      recommendedProvider: determineRecommendedProvider(comparisons),
      providerCharacteristics: {
        mostFormal: findMostFormal(comparisons),
        mostDirect: findMostDirect(comparisons),
        mostPolite: findMostPolite(comparisons),
        mostComplete: findMostComplete(comparisons)
      }
    };

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        originalMessage: {
          messageId,
          from: originalHeaders.from,
          subject: originalHeaders.subject,
          content: originalContent.substring(0, 500) + "..."
        },
        comparisons,
        summary,
        comparisonCriteria,
        timestamp: agentResponse.timestamp
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail reply comparison error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to compare email replies",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /reply/draft-single
 * @description Drafts an email reply using a single specified AI provider and includes an enhanced analysis of the draft.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the draft, its analysis, and any suggested improvements.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "provider": "gemini",
 *   "replyText": "Confirm the meeting.",
 *   "tone": "professional",
 *   "includeAnalysis": true,
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/reply/draft-single", async (c) => {
  try {
    const { messageId, provider = "gemini", replyText, tone = "professional", includeAnalysis = true, user } = await c.req.json();

    if (!messageId) {
      return c.json({ error: "messageId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get the original message
    const originalMessage: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${messageId}`,
      { method: "GET" },
      user
    );

    let originalContent = "";
    if (originalMessage.payload.body?.data) {
      originalContent = decodeBase64Url(originalMessage.payload.body.data);
    } else if (originalMessage.payload.parts) {
      for (const part of originalMessage.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          originalContent += decodeBase64Url(part.body.data);
        }
      }
    }

    const originalHeaders = extractEmailFromHeaders(originalMessage.payload.headers);

    // Create agent factory and email reply agent with single provider
    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: [provider],
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });
    const emailAgent = agentFactory.createAgent('email-reply', {
      providers: [provider],
      temperature: 0.7,
      maxTokens: 2048,
      aggregationStrategy: "first_success"
    });

    const agentInput = {
      originalEmail: {
        from: originalHeaders.from,
        to: originalHeaders.to,
        subject: originalHeaders.subject,
        date: originalHeaders.date,
        content: originalContent
      },
      replyContext: replyText || "Please provide a professional response to this email"
    };

    const agentResponse = await emailAgent.execute(agentInput, { tone });

    const providerResponse = agentResponse.responses[0];

    let analysis = null;
    if (includeAnalysis && providerResponse && !providerResponse.metadata?.error) {
      analysis = {
        wordCount: providerResponse.content.split(/\s+/).length,
        sentenceCount: providerResponse.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length,
        tone: analyzeTone(providerResponse.content),
        formalityLevel: analyzeFormalityLevel(providerResponse.content),
        directness: analyzeDirectness(providerResponse.content),
        politeness: analyzePoliteness(providerResponse.content),
        completeness: analyzeCompleteness(providerResponse.content, originalContent),
        suggestedImprovements: generateImprovementSuggestions(providerResponse.content, tone)
      };
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        originalMessage: {
          messageId,
          from: originalHeaders.from,
          subject: originalHeaders.subject,
          snippet: originalMessage.snippet
        },
        draft: {
          provider: providerResponse?.provider,
          model: providerResponse?.model,
          content: providerResponse?.content,
          hasError: !!providerResponse?.metadata?.error,
          error: providerResponse?.metadata?.error
        },
        analysis,
        usage: providerResponse?.usage,
        metadata: {
          responseTime: providerResponse?.metadata?.responseTime,
          timestamp: agentResponse.timestamp
        }
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Gmail single provider draft error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to draft email reply",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route GET /providers
 * @description Retrieves a list of available AI providers and their configurations.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response listing the available providers and their details.
 */
gmailRoutes.get("/providers", async (c) => {
  try {
    // Create providers using ProviderFactory
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    const availableProviders = Array.from(providers.keys());

    // Ensure defaultProvidersConfig is an object
    if (!defaultProvidersConfig || typeof defaultProvidersConfig !== 'object') {
      throw new Error('Default providers configuration is not available');
    }

    const providerDetails = Object.entries(defaultProvidersConfig).map(([name, config]) => ({
      name: name,
      displayName: config.name,
      model: config.model,
      enabled: config.enabled,
      available: availableProviders.includes(name),
      characteristics: getProviderCharacteristics(name),
      maxTokens: config.maxTokens,
      temperature: config.temperature
    }));

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        providers: providerDetails,
        totalAvailable: availableProviders.length,
        recommendedCombinations: [
          {
            name: "Professional Comparison",
            providers: ["gemini", "anthropic", "openai"],
            description: "Compare responses from the three major providers for professional email drafting"
          },
          {
            name: "Speed vs Quality",
            providers: ["workersAI", "gemini"],
            description: "Fast local processing vs high-quality cloud models"
          },
          {
            name: "Tone Variety",
            providers: ["anthropic", "openai"],
            description: "Claude's directness vs OpenAI's diplomatic approach"
          }
        ]
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Provider listing error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to list providers",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /generate-embedding
 * @description Generates embeddings for email content using AI providers.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the generated embeddings.
 * @example
 *
 * {
 *   "content": "Email content to embed",
 *   "provider": "gemini",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/generate-embedding", async (c) => {
  try {
    const { content, provider = "gemini", user } = await c.req.json();

    if (!content) {
      return c.json({ error: "content parameter is required" }, 400);
    }

    // Create providers using ProviderFactory
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    const selectedProvider = providers.get(provider);

    if (!selectedProvider) {
      return c.json({ error: `Provider ${provider} is not available` }, 400);
    }

    // Generate embedding using the provider
    const startTime = Date.now();
    const embeddingResult = await selectedProvider.generate(`Create an embedding for this email content: ${content}`);
    const responseTime = Date.now() - startTime;

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        embedding: embeddingResult,
        provider,
        contentLength: content.length,
        metadata: {
          provider,
          responseTime,
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Embedding generation error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to generate embedding",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /draft-reply
 * @description Drafts email replies using AI providers.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the draft reply.
 * @example
 *
 * {
 *   "messageId": "message-id-string",
 *   "replyText": "A brief on what to reply.",
 *   "provider": "gemini",
 *   "tone": "professional",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/draft-reply", async (c) => {
  try {
    const {
      messageId,
      replyText,
      provider = "gemini",
      tone = "professional",
      additionalInstructions,
      user
    } = await c.req.json();

    if (!messageId) {
      return c.json({ error: "messageId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);
    
    // Get the original message
    const originalMessage = await googleApi.makeRequest(`/gmail/v1/users/me/messages/${messageId}`, {
      method: 'GET'
    }, user);
    const originalContent = originalMessage.payload.body?.data || originalMessage.snippet;
    const originalHeaders = extractEmailFromHeaders(originalMessage.payload.headers);

    // Create providers using ProviderFactory
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    const selectedProvider = providers.get(provider);

    if (!selectedProvider) {
      return c.json({ error: `Provider ${provider} is not available` }, 400);
    }

    // Create prompt for email reply
    const prompt = `You are drafting a ${tone} email reply. 
    
Original email:
From: ${originalHeaders.from}
Subject: ${originalHeaders.subject}
Content: ${originalContent}

Reply context: ${replyText || "Please provide a professional response to this email"}
${additionalInstructions ? `Additional instructions: ${additionalInstructions}` : ''}

Please draft a ${tone} reply that addresses the original email appropriately.`;

    // Generate reply using the provider
    const startTime = Date.now();
    const replyResponse = await selectedProvider.generate(prompt, {
      temperature: 0.7,
      maxTokens: 2048
    });
    const replyContent = replyResponse.content;
    const responseTime = Date.now() - startTime;

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        originalMessage: {
          messageId,
          from: originalHeaders.from,
          subject: originalHeaders.subject,
          content: originalContent
        },
        draftReply: {
          content: replyContent,
          provider,
          tone,
          wordCount: replyContent.split(' ').length,
          analysis: {
            tone: analyzeTone(replyContent),
            formality: analyzeFormalityLevel(replyContent)
          }
        },
        metadata: {
          provider,
          tone,
          responseTime,
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Draft reply error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to generate draft reply",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /multi-provider-analysis
 * @description Performs multi-provider analysis on email content.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing analysis from multiple providers.
 * @example
 *
 * {
 *   "content": "Email content to analyze",
 *   "providers": ["gemini", "anthropic"],
 *   "analysisType": "tone",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/multi-provider-analysis", async (c) => {
  try {
    const {
      content,
      providers = ["gemini", "anthropic"],
      analysisType = "comprehensive",
      user
    } = await c.req.json();

    if (!content) {
      return c.json({ error: "content parameter is required" }, 400);
    }

    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create analysis prompt
    const prompt = `Analyze the following email content for ${analysisType} analysis:
    
Content: ${content}

Please provide a detailed analysis including:
- Tone and sentiment
- Formality level
- Directness
- Politeness
- Completeness
- Any recommendations for improvement`;

    // Process with each provider
    const analyses = [];
    const startTime = Date.now();

    for (const providerName of providers) {
      const provider = providerMap.get(providerName);
      if (provider) {
        try {
          const analysisResponse = await provider.generate(prompt, {
            temperature: 0.3,
            maxTokens: 1024
          });
          const analysisResult = analysisResponse.content;

          analyses.push({
            provider: providerName,
            content: analysisResult,
            analysis: {
              tone: analyzeTone(analysisResult),
              formality: analyzeFormalityLevel(analysisResult),
              directness: analyzeDirectness(analysisResult),
              politeness: analyzePoliteness(analysisResult),
              completeness: analyzeCompleteness(analysisResult, content)
            },
            metadata: {
              provider: providerName,
              responseTime: Date.now() - startTime
            }
          });
        } catch (error: any) {
          console.error(`Analysis failed for provider ${providerName}:`, error);
          analyses.push({
            provider: providerName,
            content: `Analysis failed: ${error.message}`,
            analysis: {
              tone: 'error',
              formality: 'unknown',
              directness: 'unknown',
              politeness: 'unknown',
              completeness: 'unknown'
            },
            metadata: {
              provider: providerName,
              error: error.message
            }
          });
        }
      }
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        originalContent: content,
        analyses,
        summary: {
          totalProviders: providers.length,
          successfulAnalyses: analyses.filter(a => !a.analysis.tone.includes('error')).length,
          averageTone: summarizeToneDistribution(analyses),
          recommendedProvider: determineRecommendedProvider(analyses),
          qualityScore: calculateQualityScore(analyses)
        },
        metadata: {
          analysisType,
          providers,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Multi-provider analysis error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to perform multi-provider analysis",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * Retrieves the known characteristics of a given AI provider.
 * @param {string} providerName The name of the provider.
 * @returns {Record<string, string>} An object containing the provider's characteristics.
 */
function getProviderCharacteristics(providerName: string): Record<string, string> {
  const characteristics: Record<string, Record<string, string>> = {
    gemini: {
      tone: "Balanced and professional",
      strength: "Context understanding and structured responses",
      typical_use: "Professional communications requiring nuanced understanding"
    },
    anthropic: {
      tone: "Direct and analytical",
      strength: "Clear reasoning and concise communication",
      typical_use: "Situations requiring honest, straightforward responses"
    },
    openai: {
      tone: "Diplomatic and gentle",
      strength: "Polite phrasing and conflict avoidance",
      typical_use: "Sensitive communications requiring tact"
    },
    workersAI: {
      tone: "Functional and efficient",
      strength: "Fast processing and local execution",
      typical_use: "Quick responses and high-volume processing"
    }
  };

  return characteristics[providerName] || {
    tone: "Unknown",
    strength: "Not characterized",
    typical_use: "General purpose"
  };
}

/**
 * @route POST /providers/test
 * @description Tests the multi-provider system with a sample email scenario.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the test results and performance summary.
 * @example
 *
 * {
 *   "providers": ["gemini", "anthropic"],
 *   "testScenario": "professional_inquiry"
 * }
 */
gmailRoutes.post("/providers/test", async (c) => {
  try {
    const {
      providers = ["gemini", "anthropic", "openai"],
      testScenario = "professional_inquiry"
    } = await c.req.json();

    const testScenarios = {
      professional_inquiry: {
        originalEmail: {
          from: "client@example.com",
          to: "contractor@example.com",
          subject: "Project Timeline Update Required",
          date: new Date().toISOString(),
          content: "Hi, I wanted to check on the status of our kitchen renovation project. The original timeline indicated completion by the end of this month, but I haven't received any recent updates. Could you please provide a status update and revised timeline if needed? Thanks."
        },
        replyContext: "Provide a professional response explaining a 2-week delay due to permit issues"
      },
      difficult_situation: {
        originalEmail: {
          from: "client@example.com",
          to: "contractor@example.com",
          subject: "Concerns About Work Quality",
          date: new Date().toISOString(),
          content: "I am very disappointed with the quality of work completed last week. The tiles are uneven and the paint job looks rushed. This is not what we agreed upon. I expect this to be fixed immediately or I will be seeking other options."
        },
        replyContext: "Acknowledge the concerns professionally and propose a solution"
      }
    };

    const scenario = testScenarios[testScenario as keyof typeof testScenarios] || testScenarios.professional_inquiry;

    // Create agent and test with selected providers
    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: providers,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });
    const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
      temperature: 0.7,
      maxTokens: 1500,
      aggregationStrategy: "all"
    });

    const agentResponse = await emailAgent.execute(scenario, {
      tone: "professional"
    });

    // Analyze the test results
    const testResults = agentResponse.responses.map((response: ProviderResponse) => {
      const analysis = {
        provider: response.provider,
        model: response.model,
        hasError: !!response.metadata?.error,
        error: response.metadata?.error,
        responseTime: response.metadata?.responseTime,
        content: response.content,
        analysis: response.content ? {
          wordCount: response.content.split(/\s+/).length,
          tone: analyzeTone(response.content),
          formalityLevel: analyzeFormalityLevel(response.content),
          directness: analyzeDirectness(response.content),
          politeness: analyzePoliteness(response.content)
        } : null
      };

      return analysis;
    });

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        testScenario,
        scenario,
        testResults,
        summary: {
          totalProviders: providers.length,
          successfulResponses: testResults.filter((r: any) => !r.hasError).length,
          averageResponseTime: Math.round(
            testResults.filter((r: any) => !r.hasError && r.responseTime)
              .reduce((sum: number, r: any) => sum + (r.responseTime || 0), 0) /
            testResults.filter((r: any) => !r.hasError && r.responseTime).length
          ),
          providerPerformance: testResults.map((r: any) => ({
            provider: r.provider,
            status: r.hasError ? 'failed' : 'success',
            responseTime: r.responseTime,
            qualityScore: r.analysis ? calculateQualityScore(r.analysis) : 0
          }))
        },
        timestamp: agentResponse.timestamp
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Provider test error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to test providers",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});


/**
 * @route POST /workflow/analyze-and-draft
 * @description A comprehensive workflow that analyzes an email thread for context and then drafts replies using multiple AI providers.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing thread analysis, draft replies, and comprehensive recommendations.
 * @example
 *
 * {
 *   "threadId": "thread-id-string",
 *   "replyToMessageId": "message-id-string",
 *   "providers": ["gemini", "anthropic"],
 *   "enableThreadAnalysis": true,
 *   "tone": "professional",
 *   "additionalInstructions": "Address the client's concern about the timeline.",
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/workflow/analyze-and-draft", async (c) => {
  try {
    const {
      threadId,
      replyToMessageId,
      providers = ["gemini", "anthropic"],
      enableThreadAnalysis = true,
      tone = "professional",
      additionalInstructions,
      user
    } = await c.req.json();

    if (!threadId || !replyToMessageId) {
      return c.json({
        error: "threadId and replyToMessageId parameters are required"
      }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);
    let threadAnalysis: {
      threadId: string;
      messageCount: number;
      analysis: any;
      inlineRepliesCount?: number;
      riskIndicators?: any;
      analysisResults?: any;
    } | null = null;

    // Step 1: Analyze the thread for context if requested
    if (enableThreadAnalysis) {
      try {
        const thread: GmailThread = await googleApi.makeRequest(
          `/gmail/v1/users/me/threads/${threadId}`,
          { method: "GET" },
          user
        );

        const processedThread = await processThreadForRAG(
          thread,
          c.env,
          false, // Don't generate embeddings
          true   // Enable AI analysis
        );

        threadAnalysis = {
          threadId: processedThread.threadId,
          messageCount: processedThread.messages.length,
          analysis: { totalAnalysisCount: processedThread.totalAnalysisCount },
          inlineRepliesCount: processedThread.messages.reduce(
            (sum: number, msg: ProcessedMessage) => sum + msg.inlineReplies.length, 0
          ),
          analysisResults: processedThread.messages.flatMap((msg: ProcessedMessage) =>
            msg.inlineReplies.filter((reply: InlineReply) => reply.analysis).map((reply: InlineReply) => ({
              speaker: reply.responseSpeaker,
              tactic: reply.analysis!.tactic,
              flags: reply.analysis!.flags,
              confidence: reply.analysis!.confidence,
              isSuspicious: reply.analysis!.isSuspicious
            }))
          ),
          riskIndicators: {
            evasiveResponses: processedThread.messages.flatMap((msg: ProcessedMessage) =>
              msg.inlineReplies.filter((reply: InlineReply) =>
                reply.analysis?.tactic === "Evasion" ||
                reply.analysis?.flags.includes("evasive_language")
              )
            ).length,
            contradictions: processedThread.messages.flatMap((msg: ProcessedMessage) =>
              msg.inlineReplies.filter((reply: InlineReply) => reply.analysis?.tactic === "Contradiction")
            ).length,
            topicShifts: processedThread.messages.flatMap((msg: ProcessedMessage) =>
              msg.inlineReplies.filter((reply: InlineReply) =>
                reply.analysis?.flags.includes("topic_shift")
              )
            ).length
          }
        };
      } catch (analysisError) {
        console.warn("Thread analysis failed, continuing with reply drafting:", analysisError);
      }
    }

    // Step 2: Get the specific message to reply to
    const replyToMessage: GmailMessage = await googleApi.makeRequest(
      `/gmail/v1/users/me/messages/${replyToMessageId}`,
      { method: "GET" },
      user
    );

    let replyToContent = "";
    if (replyToMessage.payload.body?.data) {
      replyToContent = decodeBase64Url(replyToMessage.payload.body.data);
    } else if (replyToMessage.payload.parts) {
      for (const part of replyToMessage.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          replyToContent += decodeBase64Url(part.body.data);
        }
      }
    }

    const replyToHeaders = extractEmailFromHeaders(replyToMessage.payload.headers);

    // Step 3: Enhanced context preparation
    let contextualInstructions = additionalInstructions || "";

    if (threadAnalysis?.riskIndicators) {
      const risks = threadAnalysis.riskIndicators;
      if (risks.evasiveResponses > 0) {
        contextualInstructions += "\nNote: Previous responses in this thread show evasive patterns. Be direct and specific in your reply.";
      }
      if (risks.contradictions > 0) {
        contextualInstructions += "\nNote: There have been contradictory statements in this thread. Address inconsistencies professionally.";
      }
      if (risks.topicShifts > 0) {
        contextualInstructions += "\nNote: Keep the response focused on the main topic to avoid further topic shifts.";
      }
    }

    // Step 4: Draft replies using multiple providers
    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: providers,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });
    const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
      temperature: 0.7,
      maxTokens: 2048,
      aggregationStrategy: "all"
    });

    const agentInput = {
      originalEmail: {
        from: replyToHeaders.from,
        to: replyToHeaders.to,
        subject: replyToHeaders.subject,
        date: replyToHeaders.date,
        content: replyToContent
      },
      replyContext: "Draft a professional response considering the thread context and communication patterns"
    };

    const agentContext = {
      tone,
      additionalInstructions: contextualInstructions,
      threadContext: threadAnalysis
    };

    const agentResponse = await emailAgent.execute(agentInput, agentContext);

    // Step 5: Enhanced analysis of drafts considering thread context
    const draftAnalyses = agentResponse.responses.map((response: ProviderResponse) => {
      const analysis = {
        provider: response.provider,
        model: response.model,
        content: response.content,
        hasError: !!response.metadata?.error,
        error: response.metadata?.error,
        usage: response.usage,
        responseTime: response.metadata?.responseTime
      };

      if (!analysis.hasError && response.content) {
        const contentAnalysis = {
          wordCount: response.content.split(/\s+/).length,
          tone: analyzeTone(response.content),
          formalityLevel: analyzeFormalityLevel(response.content),
          directness: analyzeDirectness(response.content),
          politeness: analyzePoliteness(response.content),
          completeness: analyzeCompleteness(response.content, replyToContent),
          addressesRisks: analyzeRiskAddressing(response.content, threadAnalysis?.riskIndicators)
        };

        return { ...analysis, contentAnalysis };
      }

      return analysis;
    });

    // Step 6: Generate comprehensive recommendations
    const recommendations = generateWorkflowRecommendations(draftAnalyses, threadAnalysis);

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        workflow: {
          threadId,
          replyToMessageId,
          analysisEnabled: enableThreadAnalysis,
          requestedProviders: providers,
          tone
        },
        threadAnalysis,
        originalMessage: {
          from: replyToHeaders.from,
          subject: replyToHeaders.subject,
          snippet: replyToMessage.snippet,
          contentPreview: replyToContent.substring(0, 200) + "..."
        },
        draftReplies: draftAnalyses,
        recommendations,
        next_steps: [
          "Review the thread analysis for communication patterns",
          "Compare draft replies across providers",
          "Select the most appropriate draft based on recommendations",
          "Consider manual adjustments based on risk indicators",
          "Create Gmail draft using the selected reply"
        ],
        timestamp: agentResponse.timestamp
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Workflow analyze-and-draft error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to execute analyze-and-draft workflow",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});


/**
 * @route POST /draft/create
 * @description Creates a Gmail draft with optional AI agent assistance for content generation.
 * This endpoint integrates the workspace-tools agents as an optional service for intelligent draft creation.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the created draft details and any AI-generated content.
 * @example
 * // Basic draft creation
 * {
 *   "to": "contractor@example.com",
 *   "subject": "Project Update Required",
 *   "text": "Please provide an update on the project status.",
 *   "user": "user-identifier"
 * }
 *
 * // AI-assisted draft creation
 * {
 *   "to": "contractor@example.com",
 *   "subject": "Project Update Required",
 *   "useAI": true,
 *   "aiOptions": {
 *     "type": "reply", // or "compose"
 *     "context": "Professional follow-up on delayed kitchen renovation project",
 *     "tone": "diplomatic",
 *     "replyToMessageId": "original-message-id", // if replying
 *     "providers": ["gemini", "anthropic"], // optional provider selection
 *     "includeAnalysis": true
 *   },
 *   "user": "user-identifier"
 * }
 */
gmailRoutes.post("/draft/create", async (c) => {
  try {
    const requestData = await c.req.json();
    
    // Validate input
    const validation = validateEmailDraftRequest(requestData);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid draft request',
          details: validation.errors
        }
      }, 400);
    }

    const {
      to,
      subject,
      text,
      cc,
      bcc,
      useAI = false,
      aiOptions = {},
      user
    } = validation.sanitizedData!;

    const googleApi = new GoogleApiClient(c.env);
    let finalText = text;
    let aiGeneratedContent = null;
    let aiAnalysis = null;

    // AI-assisted content generation if requested
    if (useAI && (!text || text.trim() === "")) {
      console.log("[Gmail Draft] Using AI assistance for content generation");

      try {
        // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: aiOptions.providers || ['gemini'],
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });
        const {
          type = "compose",
          context = "Professional email communication",
          tone = "professional",
          replyToMessageId,
          providers = ["gemini", "anthropic"],
          includeAnalysis = false,
          additionalInstructions
        } = aiOptions;

        if (type === "reply" && replyToMessageId) {
          // Handle reply generation using existing workflow
          const originalMessage: GmailMessage = await googleApi.makeRequest(
            `/gmail/v1/users/me/messages/${replyToMessageId}`,
            { method: "GET" },
            user
          );

          let originalContent = "";
          if (originalMessage.payload.body?.data) {
            originalContent = decodeBase64Url(originalMessage.payload.body.data);
          } else if (originalMessage.payload.parts) {
            for (const part of originalMessage.payload.parts) {
              if (part.mimeType === "text/plain" && part.body.data) {
                originalContent += decodeBase64Url(part.body.data);
              }
            }
          }

          const originalHeaders = extractEmailFromHeaders(originalMessage.payload.headers);
          const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
            temperature: tone === "formal" ? 0.3 : 0.7,
            maxTokens: 2048,
            aggregationStrategy: "best"
          });

          const agentInput = {
            originalEmail: {
              from: originalHeaders.from,
              to: originalHeaders.to,
              subject: originalHeaders.subject,
              date: originalHeaders.date,
              content: originalContent
            },
            replyContext: context
          };

          const agentResponse = await emailAgent.execute(agentInput, {
            tone,
            additionalInstructions
          });

          const bestResponse = agentResponse.aggregatedResult?.bestResponse || agentResponse.responses[0];
          if (bestResponse && !bestResponse.metadata?.error) {
            finalText = bestResponse.content;
            aiGeneratedContent = {
              provider: bestResponse.provider,
              model: bestResponse.model,
              type: "reply",
              generatedAt: new Date().toISOString()
            };

            if (includeAnalysis) {
              aiAnalysis = {
                tone: analyzeTone(finalText),
                formality: analyzeFormalityLevel(finalText),
                directness: analyzeDirectness(finalText),
                politeness: analyzePoliteness(finalText),
                alternatives: agentResponse.responses.map((r: any) => ({
                  provider: r.provider,
                  contentPreview: r.content.substring(0, 100) + "...",
                  hasError: !!r.metadata?.error
                }))
              };
            }
          }

        } else {
          // Handle new composition using email reply agent with custom context
          const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
            temperature: tone === "formal" ? 0.3 : 0.7,
            maxTokens: 2048,
            aggregationStrategy: "best"
          });

          const agentInput = {
            originalEmail: {
              from: "",
              to: to,
              subject: subject,
              date: new Date().toISOString(),
              content: context
            },
            replyContext: "Compose a professional email based on the provided context"
          };

          const agentResponse = await emailAgent.execute(agentInput, {
            tone,
            additionalInstructions: additionalInstructions || `Address the recipient professionally about: ${context}`
          });

          const bestResponse = agentResponse.aggregatedResult?.bestResponse || agentResponse.responses[0];
          if (bestResponse && !bestResponse.metadata?.error) {
            finalText = bestResponse.content;
            aiGeneratedContent = {
              provider: bestResponse.provider,
              model: bestResponse.model,
              type: "compose",
              generatedAt: new Date().toISOString()
            };

            if (includeAnalysis) {
              aiAnalysis = {
                tone: analyzeTone(finalText),
                formality: analyzeFormalityLevel(finalText),
                directness: analyzeDirectness(finalText),
                politeness: analyzePoliteness(finalText),
                alternatives: agentResponse.responses.map((r: any) => ({
                  provider: r.provider,
                  contentPreview: r.content.substring(0, 100) + "...",
                  hasError: !!r.metadata?.error
                }))
              };
            }
          }
        }

      } catch (aiError: any) {
        console.warn("[Gmail Draft] AI assistance failed, proceeding without:", aiError.message);
        // Continue with manual text or fallback
        if (!text || text.trim() === "") {
          return c.json({
            error: "AI assistance failed and no fallback text provided",
            aiError: aiError.message
          }, 500);
        }
      }
    }

    // Create email headers
    const headers = [`To: ${to}`, `Subject: ${subject}`];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);

    // Create the raw email content
    const emailContent = [...headers, "", finalText || ""].join("\r\n");
    const rawEmail = btoa(emailContent);

    // Create the draft via Gmail API
    const draftResponse = await googleApi.makeRequest(
      `/gmail/v1/users/me/drafts`,
      {
        method: "POST",
        body: JSON.stringify({
          message: { raw: rawEmail }
        })
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        draft: {
          id: draftResponse.id,
          message: {
            id: draftResponse.message?.id,
            threadId: draftResponse.message?.threadId,
            to,
            subject,
            text: finalText,
            cc,
            bcc
          }
        },
        aiAssistance: useAI ? {
          enabled: true,
          contentGenerated: !!aiGeneratedContent,
          details: aiGeneratedContent,
          analysis: aiAnalysis,
          fallbackUsed: useAI && !aiGeneratedContent
        } : {
          enabled: false
        },
        recommendations: aiAnalysis ? [
          "Review the AI-generated content for accuracy and tone",
          "Consider the alternative drafts if available",
          "Customize the content based on your specific relationship with the recipient",
          "Send or save the draft based on your workflow needs"
        ] : [
          "Review the draft content before sending",
          "Consider enabling AI assistance for future drafts"
        ]
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);

  } catch (error: any) {
    console.error("Gmail draft creation error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create Gmail draft",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /draft/enhance
 * @description Enhances an existing draft text using AI agents before creating the Gmail draft.
 * This endpoint allows you to improve draft content using multiple AI providers.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with enhanced versions of the draft from different AI providers.
 * @example
 * {
 *   "originalText": "Please send me the project update.",
 *   "enhancementType": "professional", // or "diplomatic", "direct", "detailed"
 *   "context": "Following up on delayed kitchen renovation project with contractor",
 *   "providers": ["gemini", "anthropic", "openai"],
 *   "tone": "diplomatic",
 *   "to": "contractor@example.com",
 *   "subject": "Project Status Update Request"
 * }
 */
gmailRoutes.post("/draft/enhance", async (c) => {
  try {
    const {
      originalText,
      enhancementType = "professional",
      context = "",
      providers = ["gemini", "anthropic"],
      tone = "professional",
      to,
      subject,
      user
    } = await c.req.json();

    if (!originalText || !to || !subject) {
      return c.json({
        error: "originalText, to, and subject parameters are required"
      }, 400);
    }

    // Create providers using ProviderFactory
    const providerMap = ProviderFactory.createProviders(defaultProvidersConfig, c.env as Env);
    
    // Create agent factory
    const agentFactory = new AgentFactory(providerMap, {
      defaultProviders: providers,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultAggregationStrategy: 'all'
    });
    const emailAgent = agentFactory.createAgent('email-reply', {
      providers: providers,
      temperature: 0.7,
      maxTokens: 2048,
      aggregationStrategy: "all"
    });

    const enhancementPrompts = {
      professional: "Enhance this email to be more professional and well-structured",
      diplomatic: "Rewrite this email to be more diplomatic and tactful",
      direct: "Make this email more direct and clear while maintaining professionalism",
      detailed: "Expand this email with more details and context",
      concise: "Make this email more concise while retaining all important information"
    };

    const agentInput = {
      originalEmail: {
        from: "",
        to: to,
        subject: subject,
        date: new Date().toISOString(),
        content: originalText
      },
      replyContext: `${enhancementPrompts[enhancementType as keyof typeof enhancementPrompts] || enhancementPrompts.professional}. ${context ? `Additional context: ${context}` : ""}`
    };

    const agentResponse = await emailAgent.execute(agentInput, {
      tone,
      additionalInstructions: `Original text to enhance: "${originalText}"`
    });

    const enhancedVersions = agentResponse.responses.map((response: any) => {
      const analysis = response.content ? {
        wordCount: response.content.split(/\s+/).length,
        tone: analyzeTone(response.content),
        formality: analyzeFormalityLevel(response.content),
        directness: analyzeDirectness(response.content),
        politeness: analyzePoliteness(response.content)
      } : null;

      return {
        provider: response.provider,
        model: response.model,
        enhancedText: response.content,
        hasError: !!response.metadata?.error,
        error: response.metadata?.error,
        analysis,
        responseTime: response.metadata?.responseTime
      };
    });

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        originalText,
        enhancementType,
        enhancedVersions: enhancedVersions.filter((v: any) => !v.hasError),
        comparison: {
          originalWordCount: originalText.split(/\s+/).length,
          originalTone: analyzeTone(originalText),
          alternatives: enhancedVersions.length,
          successfulEnhancements: enhancedVersions.filter((v: any) => !v.hasError).length
        },
        recommendations: {
          best: agentResponse.aggregatedResult?.bestResponse?.provider,
          considerations: [
            "Compare the enhanced versions with your original text",
            "Choose the version that best matches your intended tone",
            "Consider combining elements from different versions",
            "Use the enhanced text to create your Gmail draft"
          ]
        }
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);

  } catch (error: any) {
    console.error("Gmail draft enhancement error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to enhance draft text",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});
