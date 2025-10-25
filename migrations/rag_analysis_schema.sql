-- filepath: /Volumes/Projects/workers/bad-actors-offensive/archive/workspace-tools/rag_analysis_schema.sql
-- Enhanced RAG database schema with AI analysis support
-- Run this to upgrade your D1 database for the enhanced email analysis features

-- Threads table (enhanced)
CREATE TABLE IF NOT EXISTS rag_threads (
    threadId TEXT PRIMARY KEY,
    subject TEXT,
    firstMessageDate TEXT,
    lastMessageDate TEXT,
    participants TEXT,
    knowledgeBase TEXT, -- JSON string of sentence fingerprints
    analysisEnabled INTEGER DEFAULT 0,
    totalAnalysisCount INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- Messages table (enhanced)
CREATE TABLE IF NOT EXISTS rag_messages (
    messageId TEXT PRIMARY KEY,
    threadId TEXT,
    sender TEXT,
    messageDate TEXT,
    subject TEXT,
    newContent TEXT, -- JSON array of new sentences
    quotedContent TEXT, -- JSON array of quoted content with speakers
    inlineReplies TEXT, -- JSON array of inline replies with analysis
    textContent TEXT, -- Full text content
    hasAnalysis INTEGER DEFAULT 0,
    inlineReplyCount INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (threadId) REFERENCES rag_threads(threadId)
);

-- Analysis table (new)
CREATE TABLE IF NOT EXISTS rag_analysis (
    analysisId TEXT PRIMARY KEY,
    threadId TEXT,
    messageId TEXT,
    statement TEXT,
    statementSpeaker TEXT,
    response TEXT,
    responseSpeaker TEXT,
    tactic TEXT, -- Direct Answer, Evasion, Deflection, etc.
    confidence INTEGER, -- 0-100
    flags TEXT, -- JSON array of flags
    determination TEXT, -- AI's summary analysis
    analysisDate TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (threadId) REFERENCES rag_threads(threadId),
    FOREIGN KEY (messageId) REFERENCES rag_messages(messageId)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_messages_thread ON rag_messages(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_messages_sender ON rag_messages(sender);
CREATE INDEX IF NOT EXISTS idx_rag_messages_date ON rag_messages(messageDate);
CREATE INDEX IF NOT EXISTS idx_rag_analysis_thread ON rag_analysis(threadId);
CREATE INDEX IF NOT EXISTS idx_rag_analysis_tactic ON rag_analysis(tactic);
CREATE INDEX IF NOT EXISTS idx_rag_analysis_confidence ON rag_analysis(confidence);
CREATE INDEX IF NOT EXISTS idx_rag_analysis_speaker ON rag_analysis(responseSpeaker);

-- Views for common queries
CREATE VIEW IF NOT EXISTS rag_thread_summary AS
SELECT
    t.threadId,
    t.subject,
    t.participants,
    t.totalAnalysisCount,
    COUNT(DISTINCT m.messageId) as messageCount,
    COUNT(DISTINCT a.analysisId) as analysisCount,
    GROUP_CONCAT(DISTINCT a.tactic) as detectedTactics,
    AVG(a.confidence) as avgConfidence
FROM rag_threads t
LEFT JOIN rag_messages m ON t.threadId = m.threadId
LEFT JOIN rag_analysis a ON t.threadId = a.threadId
GROUP BY t.threadId;

CREATE VIEW IF NOT EXISTS rag_speaker_analysis AS
SELECT
    responseSpeaker as speaker,
    COUNT(*) as totalResponses,
    tactic,
    COUNT(*) as tacticCount,
    AVG(confidence) as avgConfidence,
    MIN(confidence) as minConfidence,
    MAX(confidence) as maxConfidence
FROM rag_analysis
GROUP BY responseSpeaker, tactic
ORDER BY responseSpeaker, tacticCount DESC;

CREATE VIEW IF NOT EXISTS rag_high_risk_responses AS
SELECT
    a.*,
    t.subject,
    m.messageDate
FROM rag_analysis a
JOIN rag_threads t ON a.threadId = t.threadId
JOIN rag_messages m ON a.messageId = m.messageId
WHERE a.tactic IN ('Evasion', 'Deflection', 'Contradiction')
   OR a.confidence > 70
   OR a.flags LIKE '%evasive_language%'
   OR a.flags LIKE '%topic_shift%'
ORDER BY a.confidence DESC, m.messageDate DESC;
