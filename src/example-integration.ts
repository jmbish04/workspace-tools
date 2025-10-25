/**
 * Example integration of spam detection and deduplication in your main worker
 */

import { ProviderFactory, defaultProvidersConfig } from './providers';
import { EmailProcessingOrchestrator } from './services/email-orchestrator';

export interface Env {
  DB: D1Database;
  SPAM_DB: D1Database;
  // ... other bindings
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // ... existing routes

    if (request.method === 'POST' && url.pathname === '/process-emails') {
      return handleEmailProcessing(request, env);
    }

    // ... other routes
    
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Run email processing on schedule
    await processEmailsScheduled(env);
  }
};

async function handleEmailProcessing(request: Request, env: Env): Promise<Response> {
  try {
    // Get incoming messages (from Gmail API, webhook, etc.)
    const incomingMessages = await getIncomingMessages(); // Your existing method

    // Create provider instances
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, env);

    // Initialize orchestrator
    const orchestrator = new EmailProcessingOrchestrator(env.DB, env.SPAM_DB, providers);

    // Process emails with spam detection and deduplication
    const result = await orchestrator.processEmails(incomingMessages, {
      batchSize: 25,
      enableSpamDetection: true,
      spamThreshold: 0.6, // Adjust based on your tolerance
      maxRetries: 3,
      delayBetweenBatches: 2000
    });

    return Response.json({
      success: true,
      result,
      message: `Processed ${result.processedMessages} emails, quarantined ${result.spamMessages} spam`
    });

  } catch (error) {
    console.error('Email processing error:', error);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function processEmailsScheduled(env: Env): Promise<void> {
  console.log('[Scheduled] Starting email processing...');

  try {
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, env);
    const orchestrator = new EmailProcessingOrchestrator(env.DB, env.SPAM_DB, providers);

    // Get messages since last processing
    const lastProcessedDate = await orchestrator.getProcessingStatus();
    const newMessages = await getMessagesSince(lastProcessedDate.deduplication.lastProcessedDate);

    if (newMessages.length > 0) {
      const result = await orchestrator.processEmails(newMessages);
      console.log(`[Scheduled] Processed ${result.processedMessages} emails, quarantined ${result.spamMessages} spam`);
    } else {
      console.log('[Scheduled] No new messages to process');
    }

  } catch (error) {
    console.error('[Scheduled] Email processing error:', error);
  }
}

// Example helper functions (implement based on your Gmail integration)
async function getIncomingMessages(): Promise<Array<{
  messageId: string;
  threadId: string;
  sentDate: string;
  fromAddress: string;
  subject: string;
}>> {
  // Your Gmail API integration logic here
  return [];
}

async function getMessagesSince(sinceDate: string | null): Promise<Array<{
  messageId: string;
  threadId: string;
  sentDate: string;
  fromAddress: string;
  subject: string;
}>> {
  // Your Gmail API integration logic here
  // Use sinceDate to query only new messages
  return [];
}
