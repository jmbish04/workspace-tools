CREATE TABLE IF NOT EXISTS tokens ( user TEXT PRIMARY KEY, token_json TEXT NOT NULL );
-- Table: tokens
-- Stores user tokens as JSON blobs, keyed by user.
-- Used for authentication, session management, and secure API access.
CREATE TABLE IF NOT EXISTS tokens (
    user TEXT PRIMARY KEY,
    token_json TEXT NOT NULL
);

-- Table: threads
-- Stores metadata for conversation threads, including subject and tags.
-- Each thread can be associated with multiple messages and labels.
CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    subject TEXT,
    tags TEXT, -- Comma-separated list of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- View: thread_stats
-- Aggregates statistics for each thread, including message counts, first/last message dates, and involved parties.
-- Useful for analytics, summarization, and AI-driven insights.
CREATE VIEW IF NOT EXISTS thread_stats AS
    WITH
        message_parties AS (
            SELECT
                messageId,
                address,
                type,
                count(distinct id) AS num_messages
            FROM rolodex
            GROUP BY messageId, address, type
        )
            SELECT
                t.threadId,
                t.subject,
                MIN(m.sendDate) AS firstMessageDate,
                MAX(m.sendDate) AS lastMessageDate,
                COUNT(DISTINCT m.id) AS totalMessages,
                GROUP_CONCAT(DISTINCT p.address) AS involvedParties
            FROM threads AS t
            LEFT JOIN messages AS m
                ON t.threadId = m.threadId
            LEFT JOIN message_parties AS p
                ON m.id = p.messageId
            GROUP BY t.threadId, t.subject;

-- Table: thread_labels
-- Associates labels with threads for categorization and filtering.
-- Enables multi-label classification for threads.
CREATE TABLE IF NOT EXISTS thread_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: gmail_label
-- Stores definitions for Gmail labels, including path, labelId, name, and description.
-- Supports label management and mapping for email integration.
CREATE TABLE IF NOT EXISTS gmail_label (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE,
    labelId TEXT UNIQUE,
    name TEXT,
    description TEXT
-- ...
);


-- Table: threads
-- Stores metadata for conversation threads, including subject and tags.
-- Each thread can be associated with multiple messages and labels.
CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    subject TEXT,
    tags TEXT, -- Comma-separated list of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- View: thread_stats
-- Aggregates statistics for each thread, including message counts, first/last message dates, and involved parties.
-- Useful for analytics, summarization, and AI-driven insights.
CREATE VIEW IF NOT EXISTS thread_stats AS
    WITH
        message_parties AS (
            SELECT
                messageId,
                address,
                type,
                count(distinct id) AS num_messages
            FROM rolodex
            GROUP BY messageId, address, type
        )
            SELECT
                t.threadId,
                t.subject,
                MIN(m.sendDate) AS firstMessageDate,
                MAX(m.sendDate) AS lastMessageDate,
                COUNT(DISTINCT m.id) AS totalMessages,
                GROUP_CONCAT(DISTINCT p.address) AS involvedParties
            FROM threads AS t
            LEFT JOIN messages AS m
                ON t.threadId = m.threadId
            LEFT JOIN message_parties AS p
                ON m.id = p.messageId
            GROUP BY t.threadId, t.subject;

-- Table: thread_labels
-- Associates labels with threads for categorization and filtering.
-- Enables multi-label classification for threads.
CREATE TABLE IF NOT EXISTS thread_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: gmail_label
-- Stores definitions for Gmail labels, including path, labelId, name, and description.
-- Supports label management and mapping for email integration.
CREATE TABLE IF NOT EXISTS  gmail_label (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE,
    labelId TEXT UNIQUE,
    name TEXT,
    description TEXT,
    color TEXT, -- JSON string with {textColor, backgroundColor}
    gmail_autofilter_rules TEXT, -- Json to capture any special routing rules setup in gmail
    is_worker_trigger INTEGER DEFAULT 0, -- signifies that emails tagged this way should have special logic in the worker
    worker_trigger_ai_instruction TEXT, -- ai instructions if this label is detected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- Table: messages
-- Stores individual email messages, including sender, recipient, subject, and body.
-- Supports full-text search and vectorization for AI processing.
CREATE TABLE IF NOT EXISTS  messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT,
    replyToMessageId TEXT,
    threadId TEXT,
    threadPosition INTEGER,
    sentDate TEXT,
    fromAddress TEXT,
    toAddresses TEXT,
    ccAddresses TEXT,
    bccAddresses TEXT,
    subject TEXT,
    bodyPlain TEXT,
    bodyHtml TEXT,
    vectorizedAt TEXT,
    isPdfRequested INTEGER,
    pdf_r2_url TEXT,
    pdf_date TEXT,
    isHtmlRequested INTEGER,
    html_r2_url TEXT,
    html_date TEXT
);


-- Table: attachments
-- Stores attachments (PDFs, images, etc.) associated with messages.
-- Supports file management, metadata storage, and AI-driven analysis.
CREATE TABLE IF NOT EXISTS  attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT,
    file_drive_id TEXT,
    file_drive_url TEXT,
    file_r2_key TEXT,
    tags TEXT, -- invoice, contract, photos, etc.
    fileName TEXT,
    mimeType TEXT,
    fileSize_bytes INTEGER,
    internal_metadata TEXT, --optional json string (like photo exif, etc.)
    md5_hash TEXT
);


-- Table: rolodex
-- Stores contact information for email senders and recipients.
-- Supports address book management, AI-driven insights, and contact enrichment.
CREATE TABLE IF NOT EXISTS  rolodex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT, -- gmail messageId
    address TEXT, -- jimbob@example.com
    displayName TEXT, -- Jim Bob
    type TEXT, -- ENUM: SENDER, TO, CC, BCC
    domain TEXT -- @example.com
);


-- Table: generated_pdfs
-- Stores generated PDFs for email messages.
-- Supports PDF management, storage, and AI-driven analysis.
CREATE TABLE IF NOT EXISTS generated_pdfs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messageId TEXT UNIQUE,
  pdf BLOB,
  generatedAt TEXT
);


-- Table: email_tags
-- Associates tags with email messages for categorization and filtering.
-- Enables multi-tag classification for messages.
CREATE TABLE IF NOT EXISTS email_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT NOT NULL,
    messageId TEXT NOT NULL,
    tag TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ai_analysis TEXT,
    legitimacy_score REAL
);

-- Table: tag
-- Stores tag definitions, including name, description, and examples for AI context.
-- Supports tag management, categorization, and AI-driven insights.
CREATE TABLE IF NOT EXISTS tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    examples_for_ai_context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: rag_threads
-- Stores processed email threads, including subject, participants, and knowledge base.
-- Supports RAG-based email processing and AI-driven insights.
CREATE TABLE IF NOT EXISTS rag_threads (
    threadId TEXT PRIMARY KEY,
    subject TEXT,
    firstMessageDate TEXT,
    lastMessageDate TEXT,
    participants TEXT, -- Comma-separated list of email addresses
    knowledgeBase TEXT, -- JSON object mapping sentence fingerprints to speakers
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: rag_messages
-- Stores individual processed messages, including sender, message date, and content.
-- Supports RAG-based email processing and AI-driven insights.
CREATE TABLE IF NOT EXISTS rag_messages (
    messageId TEXT PRIMARY KEY,
    threadId TEXT,
    sender TEXT,
    messageDate TEXT,
    subject TEXT,
    newContent TEXT, -- JSON array of sentences attributed to this sender
    quotedContent TEXT, -- JSON array of {sentence, originalSpeaker} objects
    inlineReplies TEXT, -- JSON array of inline reply objects
    textContent TEXT, -- Full raw text content
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (threadId) REFERENCES rag_threads(threadId)
);

CREATE INDEX IF NOT EXISTS idx_rag_messages_thread ON rag_messages(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_messages_sender ON rag_messages(sender);
CREATE INDEX IF NOT EXISTS idx_rag_messages_date ON rag_messages(messageDate);
CREATE INDEX IF NOT EXISTS idx_rag_threads_participants ON rag_threads(participants);

-- Table: rag_embeddings_status
-- Tracks the status of embeddings generation for messages.
-- Supports RAG-based email processing and AI-driven insights.
CREATE TABLE IF NOT EXISTS rag_embeddings_status (
    messageId TEXT PRIMARY KEY,
    threadId TEXT,
    embeddingsGenerated BOOLEAN DEFAULT FALSE,
    vectorCount INTEGER DEFAULT 0,
    lastProcessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES rag_messages(messageId)
);

-- Table: rag_insights
-- Caches conversation insights, including inline replies, quote patterns, speaker changes, etc.
-- Supports RAG-based email processing and AI-driven insights.
CREATE TABLE IF NOT EXISTS rag_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    insightType TEXT, -- 'inline_reply', 'quote_pattern', 'speaker_change', etc.
    insight TEXT, -- JSON object with the insight data
    confidence REAL, -- 0.0 to 1.0
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (threadId) REFERENCES rag_threads(threadId)
);

CREATE INDEX IF NOT EXISTS idx_rag_messages_thread ON rag_messages(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_messages_sender ON rag_messages(sender);
CREATE INDEX IF NOT EXISTS idx_rag_messages_date ON rag_messages(messageDate);
CREATE INDEX IF NOT EXISTS idx_rag_threads_participants ON rag_threads(participants);

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_status_thread ON rag_embeddings_status(threadId);

CREATE INDEX IF NOT EXISTS idx_rag_insights_thread ON rag_insights(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_insights_insight ON rag_insights(insight);
CREATE INDEX IF NOT EXISTS idx_rag_insights_confidence ON rag_insights(confidence);
CREATE INDEX IF NOT EXISTS idx_rag_insights_createdAt ON rag_insights(createdAt);

