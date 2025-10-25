/**
 * @module DeduplicationService
 * @description Handles message deduplication to avoid processing the same emails twice
 */

export interface ProcessingStatus {
  lastProcessedDate: string | null;
  processedMessageIds: Set<string>;
  totalProcessed: number;
}

export interface MessageInfo {
  messageId: string;
  threadId: string;
  sentDate: string;
  fromAddress: string;
  subject: string;
}

export class DeduplicationService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Get the last processed message date to determine starting point for new processing
   */
  async getLastProcessedDate(): Promise<string | null> {
    try {
      const result = await this.db
        .prepare(`
          SELECT MAX(sentDate) as lastDate
          FROM messages
          WHERE vectorizedAt IS NOT NULL
        `)
        .first<{ lastDate: string | null }>();

      return result?.lastDate || null;
    } catch (error) {
      console.error('[DeduplicationService] Error getting last processed date:', error);
      return null;
    }
  }

  /**
   * Get all processed message IDs since a given date
   */
  async getProcessedMessageIds(sinceDate?: string): Promise<Set<string>> {
    try {
      const query = sinceDate
        ? `SELECT messageId FROM messages WHERE sentDate >= ?`
        : `SELECT messageId FROM messages`;

      const stmt = sinceDate
        ? this.db.prepare(query).bind(sinceDate)
        : this.db.prepare(query);

      const results = await stmt.all<{ messageId: string }>();

      return new Set(results.results.map(row => row.messageId));
    } catch (error) {
      console.error('[DeduplicationService] Error getting processed message IDs:', error);
      return new Set();
    }
  }

  /**
   * Filter out already processed messages from a batch
   */
  async filterNewMessages(messages: MessageInfo[]): Promise<MessageInfo[]> {
    if (messages.length === 0) return [];

    try {
      // Get all message IDs in the batch
      const messageIds = messages.map(m => m.messageId);
      const placeholders = messageIds.map(() => '?').join(',');

      const existingResults = await this.db
        .prepare(`SELECT messageId FROM messages WHERE messageId IN (${placeholders})`)
        .bind(...messageIds)
        .all<{ messageId: string }>();

      const existingIds = new Set(existingResults.results.map(row => row.messageId));

      // Filter out existing messages
      const newMessages = messages.filter(msg => !existingIds.has(msg.messageId));

      console.log(`[DeduplicationService] Filtered ${messages.length} messages -> ${newMessages.length} new messages`);

      return newMessages;
    } catch (error) {
      console.error('[DeduplicationService] Error filtering messages:', error);
      return messages; // Return all if error (safer to potentially duplicate than lose data)
    }
  }

  /**
   * Check if a single message has been processed
   */
  async isMessageProcessed(messageId: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare(`SELECT 1 FROM messages WHERE messageId = ? LIMIT 1`)
        .bind(messageId)
        .first();

      return result !== null;
    } catch (error) {
      console.error('[DeduplicationService] Error checking message:', error);
      return false; // Assume not processed if error
    }
  }

  /**
   * Get processing status for monitoring/reporting
   */
  async getProcessingStatus(): Promise<ProcessingStatus> {
    try {
      const [lastDateResult, countResult] = await Promise.all([
        this.getLastProcessedDate(),
        this.db.prepare(`SELECT COUNT(*) as total FROM messages`).first<{ total: number }>()
      ]);

      const processedIds = await this.getProcessedMessageIds();

      return {
        lastProcessedDate: lastDateResult,
        processedMessageIds: processedIds,
        totalProcessed: countResult?.total || 0
      };
    } catch (error) {
      console.error('[DeduplicationService] Error getting status:', error);
      return {
        lastProcessedDate: null,
        processedMessageIds: new Set(),
        totalProcessed: 0
      };
    }
  }

  /**
   * Mark message as processed (for RAG embeddings)
   */
  async markMessageAsVectorized(messageId: string): Promise<void> {
    try {
      await this.db
        .prepare(`
          UPDATE messages
          SET vectorizedAt = datetime('now')
          WHERE messageId = ?
        `)
        .bind(messageId)
        .run();
    } catch (error) {
      console.error('[DeduplicationService] Error marking message as vectorized:', error);
    }
  }

  /**
   * Batch mark multiple messages as processed
   */
  async markMessagesAsVectorized(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    try {
      const stmt = this.db.prepare(`
        UPDATE messages
        SET vectorizedAt = datetime('now')
        WHERE messageId = ?
      `);

      const batch = messageIds.map(id => stmt.bind(id));
      await this.db.batch(batch);

      console.log(`[DeduplicationService] Marked ${messageIds.length} messages as vectorized`);
    } catch (error) {
      console.error('[DeduplicationService] Error batch marking messages:', error);
    }
  }

  /**
   * Get duplicate threads (for cleanup/analysis)
   */
  async findDuplicateThreads(): Promise<{ threadId: string; count: number }[]> {
    try {
      const results = await this.db
        .prepare(`
          SELECT threadId, COUNT(*) as count
          FROM threads
          GROUP BY threadId
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `)
        .all<{ threadId: string; count: number }>();

      return results.results;
    } catch (error) {
      console.error('[DeduplicationService] Error finding duplicates:', error);
      return [];
    }
  }
}
