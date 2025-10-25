-- Migration for Email + RAG Optimized Storage
-- Run with: wrangler d1 execute workspace-rag --file=./migrations.sql

-- ========================
-- Authentication
-- ========================
CREATE TABLE IF NOT EXISTS tokens (
    user TEXT PRIMARY KEY,
    token_json TEXT NOT NULL
);

-- ========================
-- Threads & Labels
-- ========================
CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT UNIQUE,
    subject TEXT,
    tags TEXT, -- Comma-separated list of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thread_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gmail_label (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE,
    labelId TEXT UNIQUE,
    name TEXT,
    description TEXT,
    color TEXT, -- JSON string {textColor, backgroundColor}
    gmail_autofilter_rules TEXT, -- JSON rules
    is_worker_trigger INTEGER DEFAULT 0,
    worker_trigger_ai_instruction TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Messages & Attachments
-- ========================
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT UNIQUE,
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

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT,
    file_drive_id TEXT,
    file_drive_url TEXT,
    file_r2_key TEXT,
    tags TEXT,
    fileName TEXT,
    mimeType TEXT,
    fileSize_bytes INTEGER,
    internal_metadata TEXT, -- JSON string
    md5_hash TEXT
);

-- ========================
-- Rolodex / Parties
-- ========================
CREATE TABLE IF NOT EXISTS rolodex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT, -- gmail messageId
    address TEXT,
    displayName TEXT,
    type TEXT, -- ENUM: SENDER, TO, CC, BCC
    domain TEXT
);

-- ========================
-- Generated Artifacts
-- ========================
CREATE TABLE IF NOT EXISTS generated_pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT UNIQUE,
    pdf BLOB,
    generatedAt TEXT
);

CREATE TABLE IF NOT EXISTS generated_htmls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT UNIQUE,
    html TEXT,            -- Full HTML content
    generatedAt TEXT      -- ISO timestamp (e.g., CURRENT_TIMESTAMP)
);

-- ========================
-- Tags
-- ========================
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

CREATE TABLE IF NOT EXISTS tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    examples_for_ai_context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- RAG-Optimized Storage
-- ========================
CREATE TABLE IF NOT EXISTS rag_threads (
    threadId TEXT PRIMARY KEY,
    subject TEXT,
    firstMessageDate TEXT,
    lastMessageDate TEXT,
    participants TEXT, -- Comma-separated list
    knowledgeBase TEXT, -- JSON object
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_messages (
    messageId TEXT PRIMARY KEY,
    threadId TEXT,
    sender TEXT,
    messageDate TEXT,
    subject TEXT,
    newContent TEXT, -- JSON array
    quotedContent TEXT, -- JSON array
    inlineReplies TEXT, -- JSON array
    textContent TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (threadId) REFERENCES rag_threads(threadId)
);

CREATE INDEX IF NOT EXISTS idx_rag_messages_thread ON rag_messages(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_messages_sender ON rag_messages(sender);
CREATE INDEX IF NOT EXISTS idx_rag_messages_date ON rag_messages(messageDate);
CREATE INDEX IF NOT EXISTS idx_rag_threads_participants ON rag_threads(participants);

CREATE TABLE IF NOT EXISTS rag_embeddings_status (
    messageId TEXT PRIMARY KEY,
    threadId TEXT,
    embeddingsGenerated INTEGER DEFAULT 0,
    vectorCount INTEGER DEFAULT 0,
    lastProcessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES rag_messages(messageId)
);

CREATE TABLE IF NOT EXISTS rag_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId TEXT,
    insightType TEXT,
    insight TEXT, -- JSON
    confidence REAL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (threadId) REFERENCES rag_threads(threadId)
);

CREATE INDEX IF NOT EXISTS idx_rag_insights_thread ON rag_insights(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_insights_type ON rag_insights(insightType);

-- ========================
-- Thread Stats View
-- ========================
CREATE VIEW IF NOT EXISTS thread_stats AS
SELECT
    t.threadId,
    t.subject,
    MIN(m.sentDate) AS firstMessageDate,
    MAX(m.sentDate) AS lastMessageDate,
    COUNT(DISTINCT m.id) AS totalMessages,
    GROUP_CONCAT(DISTINCT p.address) AS involvedParties
FROM threads AS t
LEFT JOIN messages AS m ON t.threadId = m.threadId
LEFT JOIN rolodex AS p ON m.messageId = p.messageId
GROUP BY t.threadId, t.subject;