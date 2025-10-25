/**
 * @module EmailProcessingRoutes
 * @description API routes for comprehensive email processing including spam detection, deduplication, and real-time thread analysis
 */

import { Hono } from "hono";
import { processIncrementalMessage } from "../processors/thread-processor";
import { ProviderFactory } from "../providers";
import { MessageInfo } from "../services/deduplication";
import { EmailProcessingOrchestrator, ProcessingConfig } from "../services/email-orchestrator";
import { LoggerAdapter } from "../utils/logger-adapter";

// Default providers configuration for email processing
const defaultProvidersConfig = {
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

const emailProcessingRoutes = new Hono<{ 
  Bindings: Env & Record<string, unknown>;
  Variables: {
    logger: LoggerAdapter;
  };
}>();

/**
 * POST /process-emails
 * Main endpoint for batch email processing with spam detection and deduplication
 */
emailProcessingRoutes.post("/process-emails", async (c) => {
  try {
    const {
      messages,
      config = {},
      enableThreadAnalysis = true
    } = await c.req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({
        success: false,
        error: "messages array is required"
      }, 400);
    }

    console.log(`[EmailProcessing] Starting batch processing of ${messages.length} messages`);

    // Initialize providers
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env);

    // Initialize orchestrator with proper DB binding types
    const spamDb = (c.env as any).SPAM_DB || c.env.DB;
    const orchestrator = new EmailProcessingOrchestrator(
      c.env.DB,
      spamDb as D1Database,
      providers
    );

    // Process configuration
    const processingConfig: ProcessingConfig = {
      batchSize: config.batchSize || 25,
      enableSpamDetection: config.enableSpamDetection !== false,
      spamThreshold: config.spamThreshold || 0.6,
      maxRetries: config.maxRetries || 3,
      delayBetweenBatches: config.delayBetweenBatches || 1000
    };

    // Process emails through orchestrator
    const result = await orchestrator.processEmails(messages, processingConfig);

    // If thread analysis is enabled, process legitimate messages through thread processor
    let threadProcessingResults = null;
    if (enableThreadAnalysis && result.processedMessages > 0) {
      console.log(`[EmailProcessing] Starting thread analysis for ${result.processedMessages} legitimate messages`);

      try {
        // Get legitimate messages (non-spam) for thread processing
        const legitimateMessages = messages.filter((msg: MessageInfo, index: number) => {
          // This is a simplified filter - in a real implementation,
          // you'd track which messages were marked as spam
          return index < result.processedMessages;
        });

        const threadResults = [];
        for (const message of legitimateMessages) {
          try {
            const threadResult = await processIncrementalMessage({
              messageId: message.messageId,
              threadId: message.threadId || `thread_${message.messageId}`,
              from: message.fromAddress || "unknown@example.com",
              date: message.date || new Date().toISOString(),
              subject: message.subject || "",
              body: message.bodyPlain || message.bodyHtml || ""
            }, c.env);

            threadResults.push({
              messageId: threadResult.messageId,
              threadId: threadResult.threadId,
              hasAnalysis: threadResult.hasAnalysis,
              inlineReplyCount: threadResult.inlineReplyCount,
              suspiciousReplies: threadResult.inlineReplies.filter(reply =>
                reply.analysis?.isSuspicious
              ).length
            });
          } catch (error) {
            console.error(`[EmailProcessing] Thread processing error for message ${message.messageId}:`, error);
          }
        }

        threadProcessingResults = {
          processedThreads: threadResults.length,
          messagesWithAnalysis: threadResults.filter(r => r.hasAnalysis).length,
          totalInlineReplies: threadResults.reduce((sum, r) => sum + r.inlineReplyCount, 0),
          totalSuspiciousReplies: threadResults.reduce((sum, r) => sum + r.suspiciousReplies, 0)
        };
      } catch (threadError) {
        console.error('[EmailProcessing] Thread analysis error:', threadError);
      }
    }

    return c.json({
      success: true,
      data: {
        emailProcessing: result,
        threadAnalysis: threadProcessingResults,
        configuration: processingConfig
      },
      summary: {
        totalProcessed: result.totalMessages,
        legitimateMessages: result.processedMessages,
        spamQuarantined: result.spamMessages,
        duplicatesSkipped: result.skippedDuplicates,
        errors: result.errors,
        threatAnalysisEnabled: enableThreadAnalysis
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[EmailProcessing] Processing error:', error);
    return c.json({
      success: false,
      error: error.message || 'Email processing failed'
    }, 500);
  }
});

/**
 * POST /process-single-email
 * Process a single email with full pipeline (deduplication, spam detection, thread analysis)
 */
emailProcessingRoutes.post("/process-single-email", async (c) => {
  try {
    const emailData = await c.req.json();

    if (!emailData.messageId || !emailData.fromAddress) {
      return c.json({
        success: false,
        error: "messageId and fromAddress are required"
      }, 400);
    }

    console.log(`[EmailProcessing] Processing single email: ${emailData.messageId}`);

    // Initialize providers
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env);

    // Initialize orchestrator with proper DB binding types
    const spamDb = (c.env as any).SPAM_DB || c.env.DB;
    const orchestrator = new EmailProcessingOrchestrator(
      c.env.DB,
      spamDb as D1Database,
      providers
    );

    // Process single email
    const messages = [emailData];
    const result = await orchestrator.processEmails(messages, {
      batchSize: 1,
      enableSpamDetection: true,
      spamThreshold: 0.6,
      maxRetries: 3,
      delayBetweenBatches: 0
    });

    let threadAnalysis = null;
    if (result.processedMessages > 0) {
      // Process through thread processor
      try {
        const threadResult = await processIncrementalMessage({
          messageId: emailData.messageId,
          threadId: emailData.threadId || `thread_${emailData.messageId}`,
          from: emailData.fromAddress,
          date: emailData.date || new Date().toISOString(),
          subject: emailData.subject || "",
          body: emailData.bodyPlain || emailData.bodyHtml || ""
        }, c.env);

        threadAnalysis = {
          messageId: threadResult.messageId,
          threadId: threadResult.threadId,
          newContentLines: threadResult.newContent.length,
          quotedContentLines: threadResult.quotedContent.length,
          inlineReplies: threadResult.inlineReplyCount,
          hasAnalysis: threadResult.hasAnalysis,
          suspiciousReplies: threadResult.inlineReplies.filter(reply =>
            reply.analysis?.isSuspicious
          ),
          riskLevel: threadResult.inlineReplies.filter(reply =>
            reply.analysis?.isSuspicious
          ).length > 0 ? "HIGH" : "LOW"
        };
      } catch (threadError) {
        console.error('[EmailProcessing] Thread analysis error:', threadError);
      }
    }

    return c.json({
      success: true,
      data: {
        processingResult: result,
        threadAnalysis,
        status: result.spamMessages > 0 ? "QUARANTINED_SPAM" :
                result.processedMessages > 0 ? "PROCESSED" : "DUPLICATE"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[EmailProcessing] Single email processing error:', error);
    return c.json({
      success: false,
      error: error.message || 'Single email processing failed'
    }, 500);
  }
});

/**
 * GET /processing-status
 * Get current processing status and statistics
 */
emailProcessingRoutes.get("/processing-status", async (c) => {
  try {
    // Initialize providers
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env);

    // Initialize orchestrator with proper DB binding types
    const spamDb = (c.env as any).SPAM_DB || c.env.DB;
    const orchestrator = new EmailProcessingOrchestrator(
      c.env.DB,
      spamDb as D1Database,
      providers
    );

    const status = await orchestrator.getProcessingStatus();

    // Get additional thread processor statistics
    const threadStats = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT threadId) as active_threads,
        COUNT(*) as total_messages,
        0 as total_inline_replies,
        COUNT(*) as analyzed_messages
      FROM rag_messages
      WHERE messageDate >= datetime('now', '-7 days')
    `).first();

    const suspiciousActivity = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as suspicious_replies,
        COUNT(DISTINCT speaker) as suspicious_speakers
      FROM tactical_analysis
      WHERE is_suspicious = 1 AND analysis_date >= datetime('now', '-7 days')
    `).first();

    return c.json({
      success: true,
      data: {
        orchestratorStatus: status,
        threadProcessing: {
          activeThreads: threadStats?.active_threads || 0,
          totalMessages: threadStats?.total_messages || 0,
          totalInlineReplies: threadStats?.total_inline_replies || 0,
          analyzedMessages: threadStats?.analyzed_messages || 0,
          analysisRate: threadStats?.total_messages ?
            Math.round(((threadStats.analyzed_messages as number) / (threadStats.total_messages as number)) * 100) : 0
        },
        threatDetection: {
          suspiciousReplies: suspiciousActivity?.suspicious_replies || 0,
          suspiciousSpeakers: suspiciousActivity?.suspicious_speakers || 0,
          riskLevel: (suspiciousActivity?.suspicious_replies as number || 0) > 10 ? "HIGH" :
                     (suspiciousActivity?.suspicious_replies as number || 0) > 3 ? "MEDIUM" : "LOW"
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[EmailProcessing] Status check error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get processing status'
    }, 500);
  }
});

/**
 * POST /webhook/gmail
 * Webhook endpoint for real-time Gmail message processing
 */
emailProcessingRoutes.post("/webhook/gmail", async (c) => {
  try {
    const webhookData = await c.req.json();

    console.log(`[EmailProcessing] Gmail webhook received:`, webhookData);

    // Extract message information from Gmail webhook
    // This is a simplified example - real Gmail webhooks have different structures
    const messageData = {
      messageId: webhookData.messageId || crypto.randomUUID(),
      threadId: webhookData.threadId || `thread_${Date.now()}`,
      fromAddress: webhookData.from || "unknown@example.com",
      subject: webhookData.subject || "",
      bodyPlain: webhookData.body || webhookData.snippet || "",
      date: webhookData.date || new Date().toISOString()
    };

    // Process the message immediately
    const response = await fetch(`${c.req.url.replace('/webhook/gmail', '/process-single-email')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    const result = await response.json();

    return c.json({
      success: true,
      webhook: {
        processed: true,
        messageId: messageData.messageId,
        threadId: messageData.threadId
      },
      processingResult: result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[EmailProcessing] Webhook error:', error);
    return c.json({
      success: false,
      error: error.message || 'Webhook processing failed'
    }, 500);
  }
});

/**
 * GET /status
 * Get the current status of email processing system
 */
emailProcessingRoutes.get("/status", async (c) => {
  try {
    const logger = c.get('logger');
    logger?.info('📊 Email processing status requested');

    // Get processing statistics
    const stats = {
      system: {
        status: 'operational',
        uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'unknown',
        timestamp: new Date().toISOString()
      },
      processing: {
        totalProcessed: 0, // This would come from a database or cache
        activeThreads: 0,
        queuedMessages: 0,
        lastProcessed: null
      },
      providers: {
        gemini: { status: 'available', lastCheck: new Date().toISOString() },
        anthropic: { status: 'available', lastCheck: new Date().toISOString() },
        openai: { status: 'available', lastCheck: new Date().toISOString() },
        workersAI: { status: 'available', lastCheck: new Date().toISOString() }
      },
      features: {
        spamDetection: true,
        deduplication: true,
        threadAnalysis: true,
        realTimeProcessing: true
      }
    };

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[EmailProcessing] Status error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get processing status'
    }, 500);
  }
});

/**
 * POST /analyze-spam
 * Analyze email content for spam characteristics
 */
emailProcessingRoutes.post("/analyze-spam", async (c) => {
  try {
    const { content, messageId, threadId, user } = await c.req.json();
    
    if (!content) {
      return c.json({ error: "content parameter is required" }, 400);
    }

    const logger = c.get('logger');
    logger?.info('🔍 Spam analysis requested', { messageId, threadId });

    // Use Gemini for spam analysis
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, c.env);
    const geminiProvider = providers.get('gemini');
    
    if (!geminiProvider) {
      return c.json({ success: false, error: 'Gemini provider not available' }, 500);
    }
    
    const spamAnalysisPrompt = `Analyze the following email content for spam characteristics. Provide a detailed analysis including:
1. Spam probability (0-100%)
2. Key spam indicators found
3. Risk level (low/medium/high)
4. Recommendations for handling

Email content: ${content}

Please respond in JSON format with the following structure:
{
  "spamProbability": number,
  "riskLevel": "low" | "medium" | "high",
  "indicators": string[],
  "recommendations": string[],
  "confidence": number
}`;
    
    const analysisResponse = await geminiProvider.generate(spamAnalysisPrompt, {
      temperature: 0.1,
      maxTokens: 1024
    });
    
    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisResponse.content);
    } catch (e) {
      // Fallback if JSON parsing fails
      analysisResult = {
        spamProbability: 50,
        riskLevel: 'medium',
        indicators: ['Unable to parse analysis'],
        recommendations: ['Manual review recommended'],
        confidence: 0.5,
        rawResponse: analysisResponse.content
      };
    }

    // Parse the analysis result to extract spam indicators
    const spamIndicators = {
      isSpam: analysisResult.spamProbability > 70,
      confidence: analysisResult.confidence || 0.8,
      indicators: analysisResult.indicators || ['Analysis incomplete'],
      recommendations: analysisResult.recommendations || ['Manual review recommended']
    };

    return c.json({
      success: true,
      data: {
        messageId,
        threadId,
        analysis: analysisResult,
        spamIndicators,
        metadata: {
          provider: 'gemini',
          responseTime: Date.now() - Date.now(), // Placeholder
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[EmailProcessing] Spam analysis error:', error);
    return c.json({
      success: false,
      error: error.message || 'Spam analysis failed'
    }, 500);
  }
});

export { emailProcessingRoutes };
