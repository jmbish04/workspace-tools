/**
 * @module EmailProcessingOrchestrator
 * @description Main orchestrator that handles deduplication, spam detection, and email processing
 */

import { EmailForAnalysis, SpamAnalysis, SpamDetectionAgent } from '../agents/spam-detection';
import { BaseProvider } from '../providers';
import { DeduplicationService, MessageInfo } from '../services/deduplication';

export interface ProcessingResult {
  totalMessages: number;
  newMessages: number;
  spamMessages: number;
  processedMessages: number;
  errors: number;
  skippedDuplicates: number;
}

export interface ProcessingConfig {
  batchSize: number;
  enableSpamDetection: boolean;
  spamThreshold: number; // 0.0-1.0, messages above this are quarantined
  maxRetries: number;
  delayBetweenBatches: number; // milliseconds
}

export class EmailProcessingOrchestrator {
  private primaryDb: D1Database;
  private spamDb: D1Database;
  private deduplicationService: DeduplicationService;
  private spamDetectionAgent: SpamDetectionAgent;

  constructor(
    primaryDb: D1Database,
    spamDb: D1Database,
    providers: Map<string, BaseProvider>
  ) {
    this.primaryDb = primaryDb;
    this.spamDb = spamDb;
    this.deduplicationService = new DeduplicationService(primaryDb);

    // Initialize spam detection agent
    const spamAgentConfig = {
      name: "SpamDetectionAgent",
      description: "AI-powered spam detection and classification",
      systemPrompt: "", // Set in the agent constructor
      providers: ["anthropic", "openai"], // Use multiple providers for better accuracy
      temperature: 0.1, // Low temperature for consistent classification
      maxTokens: 1000,
      aggregationStrategy: "best" as const
    };

    this.spamDetectionAgent = new SpamDetectionAgent(spamAgentConfig, providers, spamDb);
  }

  /**
   * Main processing method - orchestrates the entire email processing pipeline
   */
  async processEmails(
    incomingMessages: MessageInfo[],
    config: ProcessingConfig = this.getDefaultConfig()
  ): Promise<ProcessingResult> {
    console.log(`[EmailOrchestrator] Starting processing of ${incomingMessages.length} messages`);

    const result: ProcessingResult = {
      totalMessages: incomingMessages.length,
      newMessages: 0,
      spamMessages: 0,
      processedMessages: 0,
      errors: 0,
      skippedDuplicates: 0
    };

    try {
      // Step 1: Deduplication
      console.log('[EmailOrchestrator] Step 1: Deduplication');
      const newMessages = await this.deduplicationService.filterNewMessages(incomingMessages);
      result.newMessages = newMessages.length;
      result.skippedDuplicates = incomingMessages.length - newMessages.length;

      if (newMessages.length === 0) {
        console.log('[EmailOrchestrator] No new messages to process');
        return result;
      }

      // Step 2: Process in batches
      console.log(`[EmailOrchestrator] Step 2: Processing ${newMessages.length} new messages in batches of ${config.batchSize}`);

      for (let i = 0; i < newMessages.length; i += config.batchSize) {
        const batch = newMessages.slice(i, i + config.batchSize);
        console.log(`[EmailOrchestrator] Processing batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(newMessages.length / config.batchSize)}`);

        const batchResult = await this.processBatch(batch, config);

        result.spamMessages += batchResult.spamMessages;
        result.processedMessages += batchResult.processedMessages;
        result.errors += batchResult.errors;

        // Delay between batches to avoid overwhelming the system
        if (i + config.batchSize < newMessages.length && config.delayBetweenBatches > 0) {
          await this.delay(config.delayBetweenBatches);
        }
      }

      console.log(`[EmailOrchestrator] Processing complete: ${result.processedMessages} processed, ${result.spamMessages} spam, ${result.errors} errors`);
      return result;

    } catch (error) {
      console.error('[EmailOrchestrator] Fatal error during processing:', error);
      result.errors++;
      return result;
    }
  }

  /**
   * Process a batch of messages
   */
  private async processBatch(
    batch: MessageInfo[],
    config: ProcessingConfig
  ): Promise<Pick<ProcessingResult, 'spamMessages' | 'processedMessages' | 'errors'>> {
    const result = { spamMessages: 0, processedMessages: 0, errors: 0 };

    for (const message of batch) {
      try {
        const processed = await this.processMessage(message, config);
        if (processed.isSpam) {
          result.spamMessages++;
        } else {
          result.processedMessages++;
        }
      } catch (error) {
        console.error(`[EmailOrchestrator] Error processing message ${message.messageId}:`, error);
        result.errors++;
      }
    }

    return result;
  }

  /**
   * Process a single message through the entire pipeline
   */
  private async processMessage(
    message: MessageInfo,
    config: ProcessingConfig
  ): Promise<{ isSpam: boolean; spamAnalysis?: SpamAnalysis }> {
    console.log(`[EmailOrchestrator] Processing message: ${message.messageId}`);

    // Get full message data from database (assuming it's already stored)
    const fullMessage = await this.getFullMessageData(message.messageId);
    if (!fullMessage) {
      throw new Error(`Message ${message.messageId} not found in database`);
    }

    // Step 1: Spam Detection (if enabled)
    let spamAnalysis: SpamAnalysis | undefined;
    if (config.enableSpamDetection) {
      spamAnalysis = await this.spamDetectionAgent.analyzeEmail(fullMessage);

      // If message is spam above threshold, quarantine it
      if (spamAnalysis.spamScore >= config.spamThreshold) {
        console.log(`[EmailOrchestrator] Message ${message.messageId} identified as spam (score: ${spamAnalysis.spamScore})`);
        await this.quarantineSpamMessage(message.messageId, spamAnalysis);
        return { isSpam: true, spamAnalysis };
      }
    }

    // Step 2: Process legitimate message
    await this.processLegitimateMessage(message, fullMessage);

    // Step 3: Mark as vectorized
    await this.deduplicationService.markMessageAsVectorized(message.messageId);

    return { isSpam: false, spamAnalysis };
  }

  /**
   * Get full message data for processing
   */
  private async getFullMessageData(messageId: string): Promise<EmailForAnalysis | null> {
    try {
      const messageResult = await this.primaryDb
        .prepare(`
          SELECT messageId, fromAddress, subject, bodyPlain, bodyHtml
          FROM messages
          WHERE messageId = ?
        `)
        .bind(messageId)
        .first<{
          messageId: string;
          fromAddress: string;
          subject: string;
          bodyPlain: string | null;
          bodyHtml: string | null;
        }>();

      if (!messageResult) return null;

      // Get attachments
      const attachmentResults = await this.primaryDb
        .prepare(`
          SELECT fileName, mimeType, fileSize_bytes
          FROM attachments
          WHERE messageId = ?
        `)
        .bind(messageId)
        .all<{
          fileName: string;
          mimeType: string;
          fileSize_bytes: number;
        }>();

      return {
        messageId: messageResult.messageId,
        fromAddress: messageResult.fromAddress,
        subject: messageResult.subject,
        bodyPlain: messageResult.bodyPlain || undefined,
        bodyHtml: messageResult.bodyHtml || undefined,
        attachments: attachmentResults.results.map(att => ({
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSize: att.fileSize_bytes
        }))
      };
    } catch (error) {
      console.error(`[EmailOrchestrator] Error getting full message data for ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Quarantine spam message
   */
  private async quarantineSpamMessage(messageId: string, analysis: SpamAnalysis): Promise<void> {
    try {
      // Remove from main processing tables or mark as quarantined
      await this.primaryDb
        .prepare(`
          UPDATE messages
          SET vectorizedAt = 'QUARANTINED_SPAM'
          WHERE messageId = ?
        `)
        .bind(messageId)
        .run();

      console.log(`[EmailOrchestrator] Quarantined spam message: ${messageId}`);
    } catch (error) {
      console.error(`[EmailOrchestrator] Error quarantining spam message ${messageId}:`, error);
    }
  }

  /**
   * Process legitimate message (RAG, embeddings, etc.)
   */
  private async processLegitimateMessage(
    message: MessageInfo,
    fullMessage: EmailForAnalysis
  ): Promise<void> {
    // This is where you'd integrate with your existing RAG processing
    // For now, just log that it's being processed
    console.log(`[EmailOrchestrator] Processing legitimate message for RAG: ${message.messageId}`);

    // TODO: Integrate with existing RAG processing pipeline
    // - Extract content for embeddings
    // - Generate embeddings
    // - Store in vector database
    // - Update rag_threads and rag_messages tables
  }

  /**
   * Get processing status for monitoring
   */
  async getProcessingStatus(): Promise<{
    deduplication: any;
    spamStats: any;
    lastRun?: Date;
  }> {
    const [deduplicationStatus, spamStats] = await Promise.all([
      this.deduplicationService.getProcessingStatus(),
      this.getSpamStats()
    ]);

    return {
      deduplication: deduplicationStatus,
      spamStats,
      lastRun: new Date()
    };
  }

  /**
   * Get spam detection statistics
   */
  private async getSpamStats(): Promise<any> {
    try {
      const result = await this.spamDb
        .prepare(`
          SELECT
            COUNT(*) as total_spam,
            AVG(spam_score) as avg_score,
            COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high_risk,
            COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical_risk
          FROM spam_messages
          WHERE DATE(quarantined_at) = DATE('now')
        `)
        .first();

      return result;
    } catch (error) {
      console.error('[EmailOrchestrator] Error getting spam stats:', error);
      return {};
    }
  }

  private getDefaultConfig(): ProcessingConfig {
    return {
      batchSize: 50,
      enableSpamDetection: true,
      spamThreshold: 0.5,
      maxRetries: 3,
      delayBetweenBatches: 1000 // 1 second
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
