-- Test framework metadata table
CREATE TABLE IF NOT EXISTS health_test_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    error_mapping_json TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_test_definitions_active
    ON health_test_definitions(is_active, code);

-- Individual test execution results
CREATE TABLE IF NOT EXISTS health_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid TEXT NOT NULL,
    test_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pass', 'fail')),
    total_ms INTEGER NOT NULL,
    raw_output TEXT,
    ai_prompt_to_fix_error TEXT,
    ai_human_readable_error_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(test_id) REFERENCES health_test_definitions(id)
);

CREATE INDEX IF NOT EXISTS idx_health_test_results_session
    ON health_test_results(session_uuid);

CREATE INDEX IF NOT EXISTS idx_health_test_results_test
    ON health_test_results(test_id, created_at DESC);

