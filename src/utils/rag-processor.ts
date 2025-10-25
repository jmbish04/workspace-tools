/**
 * @module rag-processor
 * @description Provides utilities for processing Gmail threads to optimize them for Retrieval-Augmented Generation (RAG).
 * This module includes functions for parsing email content, separating new and quoted text,
 * identifying inline replies, and performing AI-driven analysis on conversational tactics.
 * The main goal is to structure email conversations in a way that is easily consumable by AI models
 * for tasks like summarization, question answering, and generating context-aware replies.
 */

import { GmailThread } from "../types/index.js";

/**
 * @interface InlineReplyAnalysis
 * @description Defines the structure for the AI-driven analysis of an inline reply.
 * This includes the determination of the conversational tactic, confidence score, and any suspicious flags.
 */
export interface InlineReplyAnalysis {
  determination: string;
  tactic: "Direct Answer" | "Evasion" | "Deflection" | "Contradiction" | "Agreement" | "Clarification" | "Unrelated";
  confidence: number; // 0-100
  flags: string[];
  isSuspicious: boolean;
}

/**
 * @interface InlineReply
 * @description Represents an inline reply within an email, where a speaker responds directly to a specific statement.
 */
export interface InlineReply {
  statement: string;
  statementSpeaker: string;
  response: string;
  responseSpeaker: string;
  context: string;
  analysis?: InlineReplyAnalysis;
}

/**
 * @interface ProcessedMessage
 * @description Represents a single email message after being processed for RAG.
 * It contains separated new and quoted content, identified inline replies, and metadata.
 */
export interface ProcessedMessage {
  messageId: string;
  threadId: string;
  sender: string;
  messageDate: string;
  subject: string;
  newContent: string[];
  quotedContent: Array<{ sentence: string; originalSpeaker: string }>;
  inlineReplies: InlineReply[];
  textContent: string;
  hasAnalysis: boolean;
  inlineReplyCount: number;
}

/**
 * @interface ProcessedThread
 * @description Represents an entire email thread after being processed for RAG.
 * It includes all processed messages, a list of participants, and a knowledge base for sentence attribution.
 */
export interface ProcessedThread {
  threadId: string;
  subject: string;
  firstMessageDate: string;
  lastMessageDate: string;
  participants: string[];
  messages: ProcessedMessage[];
  knowledgeBase: Record<string, string>;
  analysisEnabled: boolean;
  totalAnalysisCount: number;
}

/**
 * Processes a raw Gmail thread into a structured format suitable for RAG.
 * It separates new content from quoted replies, identifies inline responses,
 * attributes sentences to speakers, and can optionally trigger AI analysis.
 * @param {GmailThread} thread The raw Gmail thread object from the Gmail API.
 * @param {any} env The worker's environment object, containing bindings for AI services.
 * @param {boolean} [generateEmbeddings=false] A flag to indicate if embeddings should be generated (currently unused).
 * @param {boolean} [enableAiAnalysis=false] A flag to enable AI-powered analysis of inline replies.
 * @returns {Promise<ProcessedThread>} A promise that resolves to the processed thread object.
 */
export async function processThreadForRAG(
  thread: GmailThread,
  env: any,
  generateEmbeddings: boolean = false,
  enableAiAnalysis: boolean = false
): Promise<ProcessedThread> {
  console.log(`[ragProcessor] Starting RAG processing for thread ID: ${thread.id}. AI Analysis: ${enableAiAnalysis}`);
  const startTime = Date.now();

  const processedMessages: ProcessedMessage[] = [];
  const knowledgeBase: Record<string, string> = {};
  const participants = new Set<string>();
  let analysisCount = 0;

  for (const [index, gmailMessage] of thread.messages.entries()) {
    console.log(`[ragProcessor] Processing message ${index + 1} of ${thread.messages.length} (ID: ${gmailMessage.id})`);
    const messageHeaders = gmailMessage.payload.headers;
    const fromHeader = messageHeaders.find(h => h.name.toLowerCase() === 'from')?.value || 'unknown';
    const sender = extractSenderName(fromHeader);
    const dateHeader = messageHeaders.find(h => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();
    const subjectHeader = messageHeaders.find(h => h.name.toLowerCase() === 'subject')?.value || '';

    participants.add(sender);

    // Extract text content
    let textContent = '';
    if (gmailMessage.payload.body?.data) {
      textContent = decodeBase64Url(gmailMessage.payload.body.data);
    }
    else if (gmailMessage.payload.parts) {
      for (const part of gmailMessage.payload.parts) {
        if (part.mimeType === "text/plain" && part.body.data) {
          textContent += decodeBase64Url(part.body.data);
        }
      }
    }

    // Parse content into new/quoted/inline replies
    const { newContent, quotedContent, inlineReplies } = parseEmailContent(
      textContent,
      sender,
      Array.from(participants)
    );
    console.log(`[ragProcessor] Parsed message content: ${newContent.length} new lines, ${quotedContent.length} quoted lines, ${inlineReplies.length} inline replies.`);

    // Perform AI analysis on inline replies if enabled
    let processedInlineReplies = inlineReplies;
    if (enableAiAnalysis && inlineReplies.length > 0) {
      console.log(`[ragProcessor] Performing AI analysis on ${inlineReplies.length} inline replies.`);
      processedInlineReplies = await analyzeInlineReplies(inlineReplies, env);
      analysisCount += processedInlineReplies.filter(reply => reply.analysis).length;
    }

    // Update knowledge base with sentence fingerprints
    newContent.forEach(sentence => {
      const fingerprint = generateSentenceFingerprint(sentence);
      knowledgeBase[fingerprint] = sender;
    });

    const processedMessage: ProcessedMessage = {
      messageId: gmailMessage.id,
      threadId: gmailMessage.threadId,
      sender,
      messageDate: dateHeader,
      subject: subjectHeader,
      newContent,
      quotedContent,
      inlineReplies: processedInlineReplies,
      textContent,
      hasAnalysis: processedInlineReplies.some(reply => reply.analysis),
      inlineReplyCount: processedInlineReplies.length
    };

    processedMessages.push(processedMessage);
  }

  // Sort messages by date
  processedMessages.sort((a, b) => new Date(a.messageDate).getTime() - new Date(b.messageDate).getTime());
  console.log(`[ragProcessor] Sorted ${processedMessages.length} messages by date.`);

  const duration = Date.now() - startTime;
  console.log(`[ragProcessor] Finished RAG processing for thread ID: ${thread.id}. Duration: ${duration}ms`);

  return {
    threadId: thread.id,
    subject: processedMessages[0]?.subject || '',
    firstMessageDate: processedMessages[0]?.messageDate || new Date().toISOString(),
    lastMessageDate: processedMessages[processedMessages.length - 1]?.messageDate || new Date().toISOString(),
    participants: Array.from(participants),
    messages: processedMessages,
    knowledgeBase,
    analysisEnabled: enableAiAnalysis,
    totalAnalysisCount: analysisCount
  };
}

/**
 * Extracts the sender's name from a "From" email header.
 * It handles common formats like "Display Name <email@example.com>".
 * @param {string} fromHeader The raw "From" header string.
 * @returns {string} The extracted sender name or the original header if parsing fails.
 */
function extractSenderName(fromHeader: string): string {
  const match = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  return match && match[1] ? match[1].trim() : fromHeader.trim();
}

/**
 * Decodes a base64url-encoded string into a UTF-8 string.
 * Handles conversion from base64url to standard base64 and adds padding if necessary.
 * @param {string} data The base64url-encoded string.
 * @returns {string} The decoded string, or an empty string on failure.
 */
function decodeBase64Url(data: string): string {
  try {
    // Convert base64url to base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    return atob(base64 + padding);
  } catch (error) {
    console.warn('[ragProcessor] Failed to decode base64url data:', error);
    return '';
  }
}

/**
 * Parses the plaintext content of an email to separate new content, quoted content, and inline replies.
 * It uses common email quoting conventions (e.g., lines starting with '>') to distinguish between different parts of the message.
 * @param {string} content The plaintext content of the email.
 * @param {string} sender The sender of the current message.
 * @param {string[]} participants An array of all known participants in the thread.
 * @returns {{ newContent: string[]; quotedContent: Array<{ sentence: string; originalSpeaker: string }>; inlineReplies: InlineReply[]; }} An object containing the parsed content.
 */
function parseEmailContent(
  content: string,
  sender: string,
  participants: string[]
): {
  newContent: string[];
  quotedContent: Array<{ sentence: string; originalSpeaker: string }>;
  inlineReplies: InlineReply[];
} {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const newContent: string[] = [];
  const quotedContent: Array<{ sentence: string; originalSpeaker: string }> = [];
  const inlineReplies: InlineReply[] = [];

  let inQuotedSection = false;
  let currentQuotedSpeaker = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip undefined lines

    // Detect quoted sections (lines starting with > or common quote patterns)
    if (line.startsWith('>') || line.includes('wrote:') || line.includes('said:')) {
      inQuotedSection = true;

      // Try to extract original speaker from quote header
      const speakerMatch = line.match(/(.+?)\s+wrote: |(.+?)\s+said: |(.+?)\s*<(.+?)>\s+wrote:/);
      if (speakerMatch) {
        currentQuotedSpeaker = speakerMatch[1] || speakerMatch[2] || speakerMatch[3] || 'unknown';
        currentQuotedSpeaker = currentQuotedSpeaker.trim();
      }
      continue;
    }

    // End of quoted section
    if (inQuotedSection && !line.startsWith('>') && line.length > 20) {
      inQuotedSection = false;
    }

    if (inQuotedSection) {
      // Clean quoted line
      const cleanLine = line.replace(/^>\s*/, '').trim();
      if (cleanLine.length > 10) {
        quotedContent.push({ sentence: cleanLine, originalSpeaker: currentQuotedSpeaker });
      }
    } else {
      // This is new content from the current sender
      if (line.length > 10) {
        newContent.push(line);

        // Check if this might be an inline reply (new content following quoted content)
        if (quotedContent.length > 0 && i > 0) {
          const previousQuoted = quotedContent[quotedContent.length - 1];
          if (previousQuoted && previousQuoted.sentence.length > 20) {
            inlineReplies.push({
              statement: previousQuoted.sentence,
              statementSpeaker: previousQuoted.originalSpeaker,
              response: line,
              responseSpeaker: sender,
              context: `${previousQuoted.sentence} → ${line}`
            });
          }
        }
      }
    }
  }

  return { newContent, quotedContent, inlineReplies };
}

/**
 * Generates a simple fingerprint for a sentence to aid in attribution and prevent contamination in the knowledge base.
 * This is used to uniquely identify sentences and associate them with their original speaker.
 * @param {string} sentence The sentence to fingerprint.
 * @returns {string} A hexadecimal string representing the sentence's fingerprint.
 */
function generateSentenceFingerprint(sentence: string): string {
  // Simple hash function for sentence fingerprinting
  const clean = sentence.toLowerCase().replace(/[^\w\s]/g, '').trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Analyzes a set of inline replies using an AI model to detect conversational tactics.
 * NOTE: This is currently a stub function. A full implementation would involve making
 * API calls to an AI service to perform the analysis.
 * @param {InlineReply[]} inlineReplies The array of inline replies to analyze.
 * @param {any} env The worker's environment object.
 * @returns {Promise<InlineReply[]>} A promise that resolves to the array of replies, updated with analysis results.
 */
async function analyzeInlineReplies(
  inlineReplies: InlineReply[],
  env: any
): Promise<InlineReply[]> {
  console.log("[ragProcessor] Stubbed AI analysis is running. Returning placeholder analysis.");
  // For now, return a simplified analysis
  // In a full implementation, this would call the analyzeInlineReply function
  // from the existing codebase or make API calls to an AI service

  return inlineReplies.map(reply => ({
    ...reply,
    analysis: {
      determination: "Response analysis pending - AI analysis not fully implemented",
      tactic: "Direct Answer" as const,
      confidence: 50,
      flags: [],
      isSuspicious: false
    }
  }));
}
