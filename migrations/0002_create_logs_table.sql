-- Create logs table for storing application logs
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    context TEXT, -- JSON string for additional context
    service TEXT,
    request_id TEXT,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    duration INTEGER, -- in milliseconds
    error_code TEXT,
    error_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Create a view for recent logs (last 24 hours)
CREATE VIEW IF NOT EXISTS recent_logs AS
SELECT 
    id,
    timestamp,
    level,
    message,
    context,
    service,
    request_id,
    user_id,
    ip_address,
    duration,
    error_code,
    created_at
FROM logs 
WHERE created_at >= datetime('now', '-1 day')
ORDER BY created_at DESC;

-- Create a view for error logs only
CREATE VIEW IF NOT EXISTS error_logs AS
SELECT 
    id,
    timestamp,
    level,
    message,
    context,
    service,
    request_id,
    user_id,
    ip_address,
    duration,
    error_code,
    error_details,
    created_at
FROM logs 
WHERE level IN ('ERROR', 'FATAL')
ORDER BY created_at DESC;
