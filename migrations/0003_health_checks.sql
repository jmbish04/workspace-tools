-- Health checks table for comprehensive system health monitoring
CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pass', 'fail', 'warning', 'skip')),
    response_time_ms INTEGER,
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Health check results table for aggregated reports
CREATE TABLE IF NOT EXISTS health_check_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    overall_status TEXT NOT NULL CHECK(overall_status IN ('pass', 'fail', 'warning')),
    total_tests INTEGER NOT NULL,
    passed_tests INTEGER NOT NULL,
    failed_tests INTEGER NOT NULL,
    warning_tests INTEGER NOT NULL,
    skipped_tests INTEGER NOT NULL,
    workers_ai_evaluation TEXT,
    ai_fix_prompt TEXT,
    logs_summary TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying recent health checks
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_name ON health_checks(check_name);

-- Index for health check reports
CREATE INDEX IF NOT EXISTS idx_health_check_reports_timestamp ON health_check_reports(timestamp DESC);

