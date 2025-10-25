-- Spam Detection D1 Schema (Separate Instance)
-- Run with: wrangler d1 execute workspace-spam --file=./migrations/spam-detection.sql

-- ========================
-- Spam Detection & Quarantine
-- ========================
CREATE TABLE IF NOT EXISTS spam_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT UNIQUE NOT NULL,
    threadId TEXT,
    fromAddress TEXT,
    subject TEXT,
    bodyPlain TEXT,
    bodyHtml TEXT,
    sentDate TEXT,

    -- Spam Detection Results
    spam_score REAL DEFAULT 0.0,
    spam_reasons TEXT, -- JSON array of reasons
    detection_method TEXT, -- 'AI', 'RULES', 'HYBRID'
    confidence REAL DEFAULT 0.0,

    -- Classification
    spam_type TEXT, -- 'PHISHING', 'PROMOTIONAL', 'MALWARE', 'SUSPICIOUS'
    risk_level TEXT, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'

    -- Processing
    quarantined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    false_positive INTEGER DEFAULT 0,

    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    authentication_results TEXT, -- SPF, DKIM, DMARC results
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spam_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT, -- 'SUBJECT', 'SENDER', 'CONTENT', 'ATTACHMENT'
    pattern TEXT,
    regex_pattern TEXT,
    weight REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sender_reputation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_address TEXT UNIQUE,
    domain TEXT,
    reputation_score REAL DEFAULT 0.0,
    total_emails INTEGER DEFAULT 0,
    spam_count INTEGER DEFAULT 0,
    legitimate_count INTEGER DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_blocked INTEGER DEFAULT 0,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS spam_learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT,
    original_classification TEXT,
    corrected_classification TEXT,
    feedback_source TEXT, -- 'USER', 'ADMIN', 'AI_RETRAIN'
    feedback_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    model_version TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_spam_messages_sender ON spam_messages(fromAddress);
CREATE INDEX IF NOT EXISTS idx_spam_messages_date ON spam_messages(sentDate);
CREATE INDEX IF NOT EXISTS idx_spam_messages_score ON spam_messages(spam_score);
CREATE INDEX IF NOT EXISTS idx_sender_reputation_domain ON sender_reputation(domain);
CREATE INDEX IF NOT EXISTS idx_sender_reputation_score ON sender_reputation(reputation_score);

-- Views for analysis
CREATE VIEW IF NOT EXISTS spam_stats AS
SELECT
    DATE(quarantined_at) as date,
    spam_type,
    risk_level,
    COUNT(*) as count,
    AVG(spam_score) as avg_score,
    COUNT(CASE WHEN false_positive = 1 THEN 1 END) as false_positives
FROM spam_messages
GROUP BY DATE(quarantined_at), spam_type, risk_level;

CREATE VIEW IF NOT EXISTS top_spam_senders AS
SELECT
    fromAddress,
    COUNT(*) as spam_count,
    AVG(spam_score) as avg_score,
    MAX(quarantined_at) as last_spam
FROM spam_messages
GROUP BY fromAddress
ORDER BY spam_count DESC;
