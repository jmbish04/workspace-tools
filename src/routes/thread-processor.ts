/**
 * @module ThreadProcessorRoutes
 * @description API routes for real-time incremental email thread processing
 */

import { Hono } from "hono";
import { Env } from "../types";
import { WorkspaceToolResponse } from "../types";
import { LoggerAdapter } from "../utils/logger-adapter";
import {
  batchProcessMessages,
  processIncrementalMessage,
  queryTacticalPatterns
} from "../processors/thread-processor";

const threadProcessorRoutes = new Hono<{ 
  Bindings: Env & Record<string, unknown>;
  Variables: {
    logger: LoggerAdapter;
  };
}>();

/**
 * POST /process-message
 * Process a single new email message incrementally
 */
threadProcessorRoutes.post("/process-message", async (c) => {
  try {
    const { messageId, threadId, from, date, subject, body } = await c.req.json();

    if (!messageId || !threadId || !from || !body) {
      return c.json({
        success: false,
        error: "messageId, threadId, from, and body are required"
      }, 400);
    }

    console.log(`[ThreadProcessor] Processing incremental message ${messageId}`);

    const processedMessage = await processIncrementalMessage({
      messageId,
      threadId,
      from,
      date: date || new Date().toISOString(),
      subject: subject || "",
      body
    }, c.env);

    return c.json({
      success: true,
      data: {
        messageId: processedMessage.messageId,
        threadId: processedMessage.threadId,
        newContentCount: processedMessage.newContent.length,
        quotedContentCount: processedMessage.quotedContent.length,
        inlineReplyCount: processedMessage.inlineReplyCount,
        hasAnalysis: processedMessage.hasAnalysis,
        suspiciousReplies: processedMessage.inlineReplies.filter(reply =>
          reply.analysis?.isSuspicious
        ).length
      },
      processing: {
        timestamp: new Date().toISOString(),
        version: "incremental-v1"
      }
    });

  } catch (error: any) {
    console.error('[ThreadProcessor] Error processing message:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to process message'
    }, 500);
  }
});

/**
 * POST /batch-process
 * Process multiple messages for initial thread setup or catch-up
 */
threadProcessorRoutes.post("/batch-process", async (c) => {
  try {
    const { messages, threadId } = await c.req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({
        success: false,
        error: "messages array is required"
      }, 400);
    }

    console.log(`[ThreadProcessor] Batch processing ${messages.length} messages`);

    const processedMessages = await batchProcessMessages(messages, c.env);

    const summary = {
      totalMessages: processedMessages.length,
      messagesWithAnalysis: processedMessages.filter(msg => msg.hasAnalysis).length,
      totalInlineReplies: processedMessages.reduce((sum, msg) => sum + msg.inlineReplyCount, 0),
      suspiciousReplies: processedMessages.reduce((sum, msg) =>
        sum + msg.inlineReplies.filter(reply => reply.analysis?.isSuspicious).length, 0
      ),
      threadsProcessed: new Set(processedMessages.map(msg => msg.threadId)).size
    };

    return c.json({
      success: true,
      data: summary,
      processing: {
        timestamp: new Date().toISOString(),
        version: "batch-v1"
      }
    });

  } catch (error: any) {
    console.error('[ThreadProcessor] Error batch processing:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to batch process messages'
    }, 500);
  }
});

/**
 * POST /analyze-tactical-patterns
 * Query the database for tactical communication patterns
 */
threadProcessorRoutes.post("/analyze-tactical-patterns", async (c) => {
  try {
    const filters = await c.req.json();

    console.log(`[ThreadProcessor] Analyzing tactical patterns with filters:`, filters);

    const matches = await queryTacticalPatterns(filters, c.env);

    // Group by tactic for better analysis
    const tacticSummary: Record<string, number> = {};
    const suspiciousSpeakers = new Set<string>();
    let totalSuspicious = 0;

    matches.forEach(match => {
      if (match.inlineReply.analysis) {
        const tactic = match.inlineReply.analysis.tactic;
        tacticSummary[tactic] = (tacticSummary[tactic] || 0) + 1;

        if (match.inlineReply.analysis.isSuspicious) {
          suspiciousSpeakers.add(match.speaker);
          totalSuspicious++;
        }
      }
    });

    return c.json({
      success: true,
      data: {
        totalMatches: matches.length,
        totalSuspicious,
        uniqueSuspiciousSpeakers: suspiciousSpeakers.size,
        tacticBreakdown: tacticSummary,
        matches: matches.map(match => ({
          messageId: match.messageId,
          threadId: match.threadId,
          speaker: match.speaker,
          date: match.date,
          tactic: match.inlineReply.analysis?.tactic,
          confidence: match.inlineReply.analysis?.confidence,
          isSuspicious: match.inlineReply.analysis?.isSuspicious,
          flags: match.inlineReply.analysis?.flags,
          statement: match.inlineReply.statement.substring(0, 100) + "...",
          response: match.inlineReply.response.substring(0, 100) + "..."
        }))
      },
      analysis: {
        timestamp: new Date().toISOString(),
        filters: filters
      }
    });

  } catch (error: any) {
    console.error('[ThreadProcessor] Error analyzing patterns:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to analyze tactical patterns'
    }, 500);
  }
});

/**
 * GET /thread-stats/:threadId
 * Get comprehensive statistics for a specific thread
 */
threadProcessorRoutes.get("/thread-stats/:threadId", async (c) => {
  try {
    const threadId = c.req.param("threadId");

    if (!threadId) {
      return c.json({
        success: false,
        error: "threadId is required"
      }, 400);
    }

    // Get thread info
    const threadResult = await c.env.DB.prepare(`
      SELECT * FROM rag_threads WHERE threadId = ?
    `).bind(threadId).first();

    if (!threadResult) {
      return c.json({
        success: false,
        error: "Thread not found"
      }, 404);
    }

    // Get messages in thread
    const messagesResult = await c.env.DB.prepare(`
      SELECT
        messageId, sender, messageDate, textContent
      FROM rag_messages
      WHERE threadId = ?
      ORDER BY messageDate ASC
    `).bind(threadId).all();

    // Skip tactical analysis for now as table doesn't exist
    const tacticalResult = { results: [] };

    // Calculate statistics
    const participants = new Set(messagesResult.results.map(msg => msg.sender as string));
    const totalInlineReplies = 0; // Disabled for now
    const suspiciousAnalyses = 0; // Disabled for now

    const tacticBreakdown: Record<string, number> = {}; // Disabled for now

    return c.json({
      success: true,
      data: {
        thread: {
          threadId,
          subject: threadResult.subject,
          participantCount: participants.size,
          participants: Array.from(participants),
          totalMessages: threadResult.total_messages,
          totalInlineReplies: threadResult.total_inline_replies,
          suspiciousReplyCount: threadResult.suspicious_reply_count,
          firstMessageDate: threadResult.first_message_date,
          lastMessageDate: threadResult.last_message_date
        },
        analysis: {
          totalTacticalAnalyses: tacticalResult.results.length,
          suspiciousAnalyses,
          tacticBreakdown,
          riskLevel: suspiciousAnalyses > 5 ? "HIGH" :
                     suspiciousAnalyses > 2 ? "MEDIUM" : "LOW"
        },
        knowledgeBase: JSON.parse(threadResult.knowledgeBase as string || '{}')
      }
    });

  } catch (error: any) {
    console.error('[ThreadProcessor] Error getting thread stats:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get thread statistics'
    }, 500);
  }
});

/**
 * GET /dashboard-summary
 * Get overall system dashboard statistics
 */
threadProcessorRoutes.get("/dashboard-summary", async (c) => {
  try {
    // Get overall thread statistics
    const threadsResult = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_threads,
        SUM(total_messages) as total_messages,
        SUM(total_inline_replies) as total_inline_replies,
        SUM(suspicious_reply_count) as total_suspicious
      FROM threads
    `).first();

    // Get recent activity (last 7 days)
    const recentResult = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as recent_messages,
        COUNT(CASE WHEN has_analysis = 1 THEN 1 END) as analyzed_messages
      FROM messages
      WHERE date >= datetime('now', '-7 days')
    `).first();

    // Get top suspicious speakers
    const suspiciousSpeakersResult = await c.env.DB.prepare(`
      SELECT
        sender_email,
        suspicious_reply_count,
        total_inline_replies,
        reputation_score
      FROM sender_patterns
      WHERE suspicious_reply_count > 0
      ORDER BY suspicious_reply_count DESC
      LIMIT 10
    `).all();

    // Get tactic distribution
    const tacticDistResult = await c.env.DB.prepare(`
      SELECT
        tactic,
        COUNT(*) as count,
        COUNT(CASE WHEN is_suspicious = 1 THEN 1 END) as suspicious_count
      FROM tactical_analysis
      GROUP BY tactic
      ORDER BY count DESC
    `).all();

    return c.json({
      success: true,
      data: {
        overview: {
          totalThreads: threadsResult?.total_threads || 0,
          totalMessages: threadsResult?.total_messages || 0,
          totalInlineReplies: threadsResult?.total_inline_replies || 0,
          totalSuspicious: threadsResult?.total_suspicious || 0
        },
        recentActivity: {
          recentMessages: recentResult?.recent_messages || 0,
          analyzedMessages: recentResult?.analyzed_messages || 0,
          analysisRate: recentResult?.recent_messages ?
            Math.round(((recentResult.analyzed_messages as number) / (recentResult.recent_messages as number)) * 100) : 0
        },
        suspiciousSpeakers: suspiciousSpeakersResult.results,
        tacticDistribution: tacticDistResult.results
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[ThreadProcessor] Error getting dashboard summary:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get dashboard summary'
    }, 500);
  }
});

/**
 * POST /query-patterns
 * Query tactical patterns from processed messages
 */
threadProcessorRoutes.post("/query-patterns", async (c) => {
  try {
    const { 
      threadId, 
      patternType = 'all', 
      timeRange = '7d', 
      limit = 100,
      user 
    } = await c.req.json();

    const logger = c.get('logger');
    logger?.info('🔍 Tactical patterns query requested', { threadId, patternType, timeRange });

    // Query patterns using the thread processor
    const patterns = await queryTacticalPatterns({
      threadId,
      tactic: patternType !== 'all' ? patternType : undefined,
      suspiciousOnly: patternType === 'suspicious',
      minConfidence: 0.7
    }, c.env);

    return c.json({
      success: true,
      data: {
        threadId,
        patternType,
        timeRange,
        patterns: patterns || [],
        totalFound: patterns?.length || 0,
        metadata: {
          queryTime: new Date().toISOString(),
          limit,
          user: user || 'default'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ThreadProcessor] Pattern query error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to query tactical patterns'
    }, 500);
  }
});

export { threadProcessorRoutes };
