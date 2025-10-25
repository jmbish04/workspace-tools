/**
 * @module ThreadProcessor
 * @description Real-time incremental email thread processing with conversational memory
 *
 * This system processes each new message incrementally, maintaining:
 * - Sentence knowledge base (who said what first)
 * - Cross-thread semantic similarity via Vectorize
 * - AI-powered tactical analysis of inline replies
 * - Efficient D1 storage with proper indexing
 */

interface ProcessedMessage {
  messageId: string;
  threadId: string;
  from: string;
  date: string;
  subject: string;
  newContent: string[];
  quotedContent: Array<{ sentence: string; originalSpeaker: string }>;
  inlineReplies: InlineReply[];
  textContent: string;
  hasAnalysis: boolean;
  inlineReplyCount: number;
}

interface InlineReply {
  statement: string;
  statementSpeaker: string;
  response: string;
  responseSpeaker: string;
  context: string;
  analysis?: InlineReplyAnalysis;
}

interface InlineReplyAnalysis {
  determination: string;
  tactic: "Direct Answer" | "Evasion" | "Deflection" | "Contradiction" | "Agreement" | "Clarification" | "Unrelated";
  confidence: number; // 0-100
  flags: string[];
  isSuspicious: boolean;
}

interface SimilarSentence {
  sentence: string;
  threadId: string;
  speaker: string;
  similarity: number;
}

/**
 * Processes a single new message incrementally for an existing or new thread.
 * This is the core real-time processing function that maintains conversational memory.
 *
 * @param messageData - Raw Gmail message data
 * @param env - Cloudflare Worker environment with D1 and Vectorize bindings
 * @returns Processed message with analysis
 */
export async function processIncrementalMessage(
  messageData: {
    messageId: string;
    threadId: string;
    from: string;
    date: string;
    subject: string;
    body: string;
  },
  env: any
): Promise<ProcessedMessage> {
  console.log(`🔄 Processing incremental message ${messageData.messageId} for thread ${messageData.threadId}`);

  // 1. Fetch existing conversational memory from D1
  const sentenceKnowledgeBase = await fetchThreadKnowledgeBase(messageData.threadId, env);

  // 2. Query Vectorize for similar sentences across all threads
  const similarSentences = await findSimilarSentences(messageData.body, env);

  // 3. Parse the new message content
  const senderEmail = extractEmail(messageData.from);
  const parsedResult = parseMessageContent(
    messageData.body,
    senderEmail,
    sentenceKnowledgeBase
  );

  // 4. Analyze inline replies with Gemini
  const analyzedInlineReplies = await analyzeInlineReplies(
    parsedResult.inlineReplies,
    env,
    similarSentences
  );

  // 5. Create processed message object
  const processedMessage: ProcessedMessage = {
    messageId: messageData.messageId,
    threadId: messageData.threadId,
    from: senderEmail,
    date: messageData.date,
    subject: messageData.subject,
    newContent: parsedResult.newContent,
    quotedContent: parsedResult.quotedContent,
    inlineReplies: analyzedInlineReplies,
    textContent: messageData.body,
    hasAnalysis: analyzedInlineReplies.some(reply => reply.analysis),
    inlineReplyCount: analyzedInlineReplies.length
  };

  // 6. Update D1 with new message and updated knowledge base
  await Promise.all([
    saveProcessedMessage(processedMessage, env),
    updateThreadKnowledgeBase(messageData.threadId, sentenceKnowledgeBase, env)
  ]);

  // 7. Generate and store embeddings for new sentences
  await vectorizeNewSentences(
    parsedResult.newContent,
    messageData,
    env
  );

  console.log(`✅ Successfully processed message ${messageData.messageId}`);
  return processedMessage;
}

/**
 * Fetches the sentence knowledge base for a thread from D1.
 * This is the "conversational memory" that tracks who said what first.
 */
async function fetchThreadKnowledgeBase(
  threadId: string,
  env: any
): Promise<Record<string, string>> {
  try {
    const result = await env.DB.prepare(`
      SELECT knowledgeBase
      FROM rag_threads
      WHERE threadId = ?
    `).bind(threadId).first();

    if (result?.knowledgeBase) {
      return JSON.parse(result.knowledgeBase as string);
    }

    // Initialize empty knowledge base for new threads
    console.log(`🆕 Initializing new knowledge base for thread ${threadId}`);
    return {};
  } catch (error) {
    console.error('Failed to fetch thread knowledge base:', error);
    return {};
  }
}

/**
 * Updates the thread's sentence knowledge base in D1.
 * This maintains the "memory" of who said what first in the conversation.
 */
async function updateThreadKnowledgeBase(
  threadId: string,
  knowledgeBase: Record<string, string>,
  env: any
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO rag_threads (threadId, knowledgeBase, updatedAt)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(threadId) DO UPDATE SET
        knowledgeBase = excluded.knowledgeBase,
        updatedAt = excluded.updatedAt
    `).bind(
      threadId,
      JSON.stringify(knowledgeBase)
    ).run();

    console.log(`💾 Updated knowledge base for thread ${threadId}`);
  } catch (error) {
    console.error('Failed to update thread knowledge base:', error);
  }
}

/**
 * Finds semantically similar sentences across all threads using Vectorize.
 * This provides cross-thread context for the AI analysis.
 */
async function findSimilarSentences(
  messageBody: string,
  env: any
): Promise<SimilarSentence[]> {
  try {
    // Check if OpenAI API key and Vectorize are available
    if (!env.OPENAI_API_KEY) {
      console.warn('⚠️ OPENAI_API_KEY not configured - skipping similarity search');
      return [];
    }

    if (!env.VECTORIZE) {
      console.warn('⚠️ VECTORIZE binding not configured - skipping similarity search');
      return [];
    }

    // Extract key sentences for similarity search
    const sentences = messageBody.match(/[^.!?]+[.!?]+/g) || [];
    const keySentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 20) // Focus on substantial sentences
      .slice(0, 3); // Limit to top 3 sentences for efficiency

    if (keySentences.length === 0) return [];

    // Generate embedding for the combined key sentences
    const searchText = keySentences.join(' ');
    const embedding = await generateEmbedding(searchText, env);

    // Query Vectorize for similar sentences
    const results = await env.VECTORIZE.query(embedding, {
      topK: 10,
      returnMetadata: true
    });

    return results.matches.map((match: any) => ({
      sentence: match.metadata?.sentence as string || '',
      threadId: match.metadata?.threadId as string || '',
      speaker: match.metadata?.speaker as string || '',
      similarity: match.score || 0
    }));
  } catch (error) {
    console.error('Failed to find similar sentences:', error);
    return []; // Return empty array to continue processing without similarity context
  }
}

/**
 * Core parsing function that separates new content from quoted content
 * and identifies inline replies using the sentence fingerprinting method.
 */
function parseMessageContent(
  body: string,
  senderEmail: string,
  knowledgeBase: Record<string, string>
): {
  newContent: string[];
  quotedContent: Array<{ sentence: string; originalSpeaker: string }>;
  inlineReplies: InlineReply[];
} {
  const newContent: string[] = [];
  const quotedContent: Array<{ sentence: string; originalSpeaker: string }> = [];
  const inlineReplies: InlineReply[] = [];

  // Extract sentences from the email body
  const sentences = body.replace(/(\r\n|\n|\r)/gm, " ").match(/[^.!?]+[.!?]+/g) || [];

  let previousSentence: string | null = null;
  let previousSpeaker: string | null = null;

  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (cleanSentence.length < 5) continue;

    // Create fingerprint for sentence matching
    const sentenceFingerprint = cleanSentence.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (knowledgeBase.hasOwnProperty(sentenceFingerprint)) {
      // This is a quoted sentence - we've seen it before
      const originalSpeaker = knowledgeBase[sentenceFingerprint];
      quotedContent.push({
        sentence: cleanSentence,
        originalSpeaker: originalSpeaker
      });

      // Track for inline reply detection
      previousSentence = cleanSentence;
      previousSpeaker = originalSpeaker;
    } else {
      // This is new content
      newContent.push(cleanSentence);
      knowledgeBase[sentenceFingerprint] = senderEmail;

      // Check for inline reply pattern
      if (previousSentence && previousSpeaker && previousSpeaker !== senderEmail) {
        inlineReplies.push({
          statement: previousSentence,
          statementSpeaker: previousSpeaker,
          response: cleanSentence,
          responseSpeaker: senderEmail,
          context: `${previousSentence} → ${cleanSentence}`
        });
      }

      // Reset tracking
      previousSentence = null;
      previousSpeaker = null;
    }
  }

  return { newContent, quotedContent, inlineReplies };
}

/**
 * Analyzes inline replies using Gemini AI to identify conversational tactics.
 * This provides the "tactical analysis" layer for bad faith detection.
 */
async function analyzeInlineReplies(
  inlineReplies: InlineReply[],
  env: any,
  similarSentences: SimilarSentence[]
): Promise<InlineReply[]> {
  if (inlineReplies.length === 0) return [];

  console.log(`🔍 Analyzing ${inlineReplies.length} inline replies with Gemini`);

  const analyzedReplies: InlineReply[] = [];

  for (const reply of inlineReplies) {
    try {
      // Build context from similar sentences
      const contextualEvidence = similarSentences
        .filter(s => s.speaker === reply.responseSpeaker)
        .slice(0, 3)
        .map(s => `Previous statement by ${s.speaker}: "${s.sentence}"`)
        .join('\n');

      const prompt = `
You are a neutral paralegal analyzing email conversations for communication tactics.

STATEMENT: "${reply.statement}" (by ${reply.statementSpeaker})
RESPONSE: "${reply.response}" (by ${reply.responseSpeaker})

${contextualEvidence ? `HISTORICAL CONTEXT:\n${contextualEvidence}` : ''}

Analyze this response for:
1. Tactic used (Direct Answer, Evasion, Deflection, Contradiction, Agreement, Clarification, Unrelated)
2. Confidence level (0-100)
3. Any suspicious patterns
4. Brief determination explanation

Return JSON only:
{
  "determination": "brief explanation",
  "tactic": "tactic_name",
  "confidence": number,
  "flags": ["flag1", "flag2"],
  "isSuspicious": boolean
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>
          }
        }>
      };
      const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as InlineReplyAnalysis;
        analyzedReplies.push({
          ...reply,
          analysis
        });
      } else {
        // Fallback if JSON parsing fails
        analyzedReplies.push({
          ...reply,
          analysis: {
            determination: "Analysis failed - unable to parse response",
            tactic: "Unrelated",
            confidence: 0,
            flags: ["parsing_error"],
            isSuspicious: false
          }
        });
      }
    } catch (error) {
      console.error('Failed to analyze inline reply:', error);
      analyzedReplies.push({
        ...reply,
        analysis: {
          determination: "Analysis failed due to API error",
          tactic: "Unrelated",
          confidence: 0,
          flags: ["api_error"],
          isSuspicious: false
        }
      });
    }
  }

  return analyzedReplies;
}

/**
 * Saves the processed message to D1 database.
 * Ensures the thread exists before inserting the message to avoid foreign key constraint errors.
 */
async function saveProcessedMessage(message: ProcessedMessage, env: any): Promise<void> {
  try {
    // Use a batch transaction to ensure atomicity
    const statements = [
      // First ensure the thread exists in rag_threads to avoid foreign key constraint error
      env.DB.prepare(`
        INSERT INTO rag_threads (
          threadId, subject, firstMessageDate, lastMessageDate, 
          participants, knowledgeBase
        ) VALUES (?, ?, ?, ?, ?, '{}')
        ON CONFLICT(threadId) DO UPDATE SET
          lastMessageDate = excluded.lastMessageDate,
          updatedAt = datetime('now')
      `).bind(
        message.threadId,     // threadId
        message.subject,      // subject  
        message.date,         // firstMessageDate
        message.date,         // lastMessageDate
        message.from          // participants
      ),
      
      // Now save the message with foreign key constraint satisfied
      env.DB.prepare(`
        INSERT INTO rag_messages (
          messageId, threadId, sender, messageDate, subject,
          newContent, quotedContent, inlineReplies,
          textContent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(messageId) DO UPDATE SET
          newContent = excluded.newContent,
          quotedContent = excluded.quotedContent,
          inlineReplies = excluded.inlineReplies,
          textContent = excluded.textContent,
          threadId = excluded.threadId
      `).bind(
        message.messageId,
        message.threadId,
        message.from,
        message.date,
        message.subject,
        JSON.stringify(message.newContent),
        JSON.stringify(message.quotedContent),
        JSON.stringify(message.inlineReplies),
        message.textContent
      )
    ];

    // Execute both statements in a transaction
    await env.DB.batch(statements);

    console.log(`💾 Saved processed message ${message.messageId} to thread ${message.threadId}`);
  } catch (error) {
    console.error('Failed to save processed message:', error);
    
    // Specific handling for foreign key constraint errors
    if (error && error.toString().includes('FOREIGN KEY constraint failed')) {
      console.error(`🚨 Foreign Key Error: Thread ${message.threadId} may not exist in rag_threads table`);
      console.error('Message details:', {
        messageId: message.messageId,
        threadId: message.threadId,
        subject: message.subject,
        from: message.from,
        date: message.date
      });
      
      // Try to verify the thread exists
      try {
        const threadCheck = await env.DB.prepare(`
          SELECT threadId FROM rag_threads WHERE threadId = ?
        `).bind(message.threadId).first();
        
        console.error(`Thread exists check: ${threadCheck ? 'EXISTS' : 'MISSING'}`);
      } catch (checkError) {
        console.error('Failed to check thread existence:', checkError);
      }
    }
    
    throw error; // Re-throw to handle gracefully at higher level
  }
}

/**
 * Validates database foreign key constraints and reports any issues
 */
async function validateDatabaseConstraints(env: any): Promise<boolean> {
  try {
    // Check for orphaned messages (messages without threads)
    const orphanedMessages = await env.DB.prepare(`
      SELECT m.messageId, m.threadId 
      FROM rag_messages m 
      LEFT JOIN rag_threads t ON m.threadId = t.threadId 
      WHERE t.threadId IS NULL
      LIMIT 5
    `).all();
    
    if (orphanedMessages.results.length > 0) {
      console.error(`🚨 Found ${orphanedMessages.results.length} orphaned messages:`, orphanedMessages.results);
      return false;
    }
    
    console.log('✅ Database constraints validation passed');
    return true;
  } catch (error) {
    console.error('❌ Database validation failed:', error);
    return false;
  }
}

/**
 * Generates embeddings for new sentences and stores them in Vectorize.
 * This builds the "conceptual brain" for cross-thread analysis.
 */
async function vectorizeNewSentences(
  newSentences: string[],
  messageData: { messageId: string; threadId: string; from: string; date: string },
  env: any
): Promise<void> {
  if (newSentences.length === 0) return;

  // Check if OpenAI API key is configured
  if (!env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not configured - skipping sentence embedding generation');
    console.log('💡 To enable embeddings: wrangler secret put OPENAI_API_KEY');
    return;
  }

  // Check if Vectorize binding is available
  if (!env.VECTORIZE) {
    console.warn('⚠️ VECTORIZE binding not configured - skipping embedding storage');
    return;
  }

  console.log(`🧠 Vectorizing ${newSentences.length} new sentences`);

  const vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }> = [];

  for (const [index, sentence] of newSentences.entries()) {
    try {
      const embedding = await generateEmbedding(sentence, env);
      const vectorId = `${messageData.messageId}-${index}`;

      vectors.push({
        id: vectorId,
        values: embedding,
        metadata: {
          sentence: sentence,
          messageId: messageData.messageId,
          threadId: messageData.threadId,
          speaker: extractEmail(messageData.from),
          date: messageData.date,
          sentenceIndex: index
        }
      });
    } catch (error) {
      console.error(`Failed to generate embedding for sentence ${index}:`, error);
      // Continue processing other sentences
    }
  }

  if (vectors.length > 0) {
    try {
      await env.VECTORIZE.upsert(vectors);
      console.log(`✅ Stored ${vectors.length} sentence embeddings in Vectorize`);
    } catch (error) {
      console.error('Failed to store embeddings:', error);
    }
  } else {
    console.log('⚠️ No embeddings generated - all sentences failed');
  }
}

/**
 * Generates embeddings using OpenAI's embedding model.
 */
async function generateEmbedding(text: string, env: any): Promise<number[]> {
  // Check if OpenAI API key is available
  if (!env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured, skipping embedding generation');
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`OpenAI embedding API error ${response.status}:`, errorText);
    throw new Error(`OpenAI embedding API error: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

/**
 * Extracts email address from "Name <email@domain.com>" format.
 */
function extractEmail(senderString: string): string {
  if (!senderString) return '';
  const match = senderString.match(/<(.+)>/);
  return match ? match[1] : senderString;
}

/**
 * Batch processes multiple messages for initial thread processing.
 * This is useful for processing historical threads or catching up on missed messages.
 */
export async function batchProcessMessages(
  messages: Array<{
    messageId: string;
    threadId: string;
    from: string;
    date: string;
    subject: string;
    body: string;
  }>,
  env: any
): Promise<ProcessedMessage[]> {
  console.log(`🔄 Batch processing ${messages.length} messages`);

  const processedMessages: ProcessedMessage[] = [];

  // Sort messages by date to maintain chronological order
  const sortedMessages = messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const message of sortedMessages) {
    try {
      const processed = await processIncrementalMessage(message, env);
      processedMessages.push(processed);
    } catch (error) {
      console.error(`Failed to process message ${message.messageId}:`, error);
    }
  }

  return processedMessages;
}

/**
 * Queries processed messages for tactical analysis.
 * This is the main interface for finding suspicious communication patterns.
 */
export async function queryTacticalPatterns(
  filters: {
    threadId?: string;
    speaker?: string;
    tactic?: string;
    minConfidence?: number;
    suspiciousOnly?: boolean;
    dateRange?: { start: string; end: string };
  },
  env: any
): Promise<Array<{
  messageId: string;
  threadId: string;
  speaker: string;
  date: string;
  inlineReply: InlineReply;
}>> {
  try {
    let query = `
      SELECT messageId, threadId, sender, messageDate, inlineReplies
      FROM rag_messages
      WHERE 1 = 1
    `;

    const bindings: any[] = [];

    if (filters.threadId) {
      query += ` AND threadId = ?`;
      bindings.push(filters.threadId);
    }

    if (filters.speaker) {
      query += ` AND sender = ?`;
      bindings.push(filters.speaker);
    }

    if (filters.dateRange) {
      query += ` AND date BETWEEN ? AND ?`;
      bindings.push(filters.dateRange.start, filters.dateRange.end);
    }

    query += ` ORDER BY date DESC LIMIT 100`;

    const results = await env.DB.prepare(query).bind(...bindings).all();

    const tacticalMatches: Array<{
      messageId: string;
      threadId: string;
      speaker: string;
      date: string;
      inlineReply: InlineReply;
    }> = [];

    for (const row of results.results) {
      const inlineReplies = JSON.parse(row.inline_replies as string) as InlineReply[];

      for (const reply of inlineReplies) {
        if (!reply.analysis) continue;

        // Apply filters
        if (filters.tactic && reply.analysis.tactic !== filters.tactic) continue;
        if (filters.minConfidence && reply.analysis.confidence < filters.minConfidence) continue;
        if (filters.suspiciousOnly && !reply.analysis.isSuspicious) continue;

        tacticalMatches.push({
          messageId: row.messageId as string,
          threadId: row.threadId as string,
          speaker: row.sender as string,
          date: row.messageDate as string,
          inlineReply: reply
        });
      }
    }

    return tacticalMatches;
  } catch (error) {
    console.error('Failed to query tactical patterns:', error);
    return [];
  }
}

// Export types for use in other modules
export type { InlineReply, InlineReplyAnalysis, ProcessedMessage, SimilarSentence };
export { validateDatabaseConstraints };
