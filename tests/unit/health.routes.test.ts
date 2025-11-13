import { strict as assert } from "node:assert";
import healthRoutes from "../../src/health/routes";
import { Env } from "../../src/types";

interface StatementRecord {
  query: string;
  params: unknown[];
  type: "run" | "all";
}

type HealthReport = { id: string; status: string };
type HealthRun = { id: string; report_id: string; service_name: string; status: string };
type HealthLog = { id: string; run_id: string; logs_json: string };
type HealthAnalysis = {
  id: string;
  report_id: string;
  human_summary: string;
  dev_agent_prompt: string;
  overall_fix_prompt: string;
};

class MockPreparedStatement {
  constructor(
    private readonly db: MockD1Database,
    private readonly query: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new MockPreparedStatement(this.db, this.query, params);
  }

  async run() {
    return this.db.handleRun(this.query, this.params);
  }

  async all() {
    return this.db.handleAll(this.query, this.params);
  }
}

class MockD1Database {
  public readonly statements: StatementRecord[] = [];
  public readonly reports = new Map<string, HealthReport>();
  public readonly runs = new Map<string, HealthRun>();
  public readonly logs = new Map<string, HealthLog>();
  public readonly analyses = new Map<string, HealthAnalysis>();
  public readonly testDefinitionsByCode = new Map<string, {
    id: number;
    code: string;
    name: string;
    description: string;
    error_mapping_json: string;
    is_active: number;
  }>();
  public readonly testResults = new Map<number, {
    id: number;
    session_uuid: string;
    test_id: number;
    status: "pass" | "fail";
    total_ms: number;
    raw_output: string | null;
    ai_prompt_to_fix_error: string | null;
    ai_human_readable_error_description: string | null;
    created_at: string;
  }>();
  private testDefinitionAutoId = 1;
  private testResultAutoId = 1;

  prepare(query: string) {
    return new MockPreparedStatement(this, query);
  }

  async handleRun(query: string, params: unknown[]) {
    this.statements.push({ query, params, type: "run" });
    const normalized = query.replace(/\s+/g, " ").trim().toUpperCase();

    if (normalized.startsWith("INSERT INTO HEALTH_REPORTS")) {
      const [id, status] = params as [string, string];
      this.reports.set(id, { id, status });
    } else if (normalized.startsWith("UPDATE HEALTH_REPORTS")) {
      const [status, id] = params as [string, string];
      const existing = this.reports.get(id);
      if (existing) {
        existing.status = status;
      } else {
        this.reports.set(id, { id, status });
      }
    } else if (normalized.startsWith("INSERT INTO HEALTH_RUNS")) {
      const [id, reportId, serviceName, status] = params as [string, string, string, string];
      this.runs.set(id, { id, report_id: reportId, service_name: serviceName, status });
    } else if (normalized.startsWith("INSERT INTO HEALTH_LOGS")) {
      const [id, runId, logsJson] = params as [string, string, string];
      this.logs.set(id, { id, run_id: runId, logs_json: logsJson });
    } else if (normalized.startsWith("INSERT INTO AI_ANALYSIS")) {
      const [id, reportId, humanSummary, devPrompt, overallPrompt] = params as [
        string,
        string,
        string,
        string,
        string,
      ];
      this.analyses.set(id, {
        id,
        report_id: reportId,
        human_summary: humanSummary,
        dev_agent_prompt: devPrompt,
        overall_fix_prompt: overallPrompt,
      });
    } else if (normalized.includes("INSERT INTO HEALTH_TEST_DEFINITIONS")) {
      const [code, name, description, errorMappingJson] = params as [string, string, string, string];
      const existing = this.testDefinitionsByCode.get(code);
      if (existing) {
        existing.name = name;
        existing.description = description;
        existing.error_mapping_json = errorMappingJson;
        existing.is_active = 1;
      } else {
        const id = this.testDefinitionAutoId++;
        this.testDefinitionsByCode.set(code, {
          id,
          code,
          name,
          description,
          error_mapping_json: errorMappingJson,
          is_active: 1,
        });
      }
    } else if (normalized.startsWith("INSERT INTO HEALTH_TEST_RESULTS")) {
      const [
        sessionUuid,
        testId,
        status,
        totalMs,
        rawOutput,
        aiPrompt,
        aiSummary,
      ] = params as [string, number, "pass" | "fail", number, string | null, string | null, string | null];
      const id = this.testResultAutoId++;
      const createdAt = new Date().toISOString();
      this.testResults.set(id, {
        id,
        session_uuid: sessionUuid,
        test_id: testId,
        status,
        total_ms: totalMs,
        raw_output: rawOutput ?? null,
        ai_prompt_to_fix_error: aiPrompt ?? null,
        ai_human_readable_error_description: aiSummary ?? null,
        created_at: createdAt,
      });
    }

    return { success: true, meta: {} };
  }

  async handleAll(query: string, params: unknown[]) {
    this.statements.push({ query, params, type: "all" });
    const normalized = query.replace(/\s+/g, " ").trim().toUpperCase();

    if (normalized.startsWith("SELECT * FROM HEALTH_RUNS")) {
      const [reportId] = params as [string];
      const results = Array.from(this.runs.values()).filter((run) => run.report_id === reportId);
      return { results };
    }

    if (normalized.startsWith("SELECT * FROM HEALTH_LOGS")) {
      const runIds = params as string[];
      const runIdSet = new Set(runIds);
      const results = Array.from(this.logs.values()).filter((log) => runIdSet.has(log.run_id));
      return { results };
    }

    if (normalized.startsWith("SELECT 1")) {
      return { results: [{ value: 1 }] };
    }

    if (normalized.startsWith("SELECT ID, CODE, NAME, DESCRIPTION, ERROR_MAPPING_JSON, IS_ACTIVE FROM HEALTH_TEST_DEFINITIONS")) {
      const results = Array.from(this.testDefinitionsByCode.values()).filter((row) => row.is_active === 1);
      results.sort((a, b) => a.code.localeCompare(b.code));
      return { results };
    }

    if (normalized.startsWith("SELECT ID, CREATED_AT FROM HEALTH_TEST_RESULTS WHERE SESSION_UUID = ? AND TEST_ID = ?")) {
      const [sessionUuid, testId] = params as [string, number];
      const results = Array.from(this.testResults.values())
        .filter((row) => row.session_uuid === sessionUuid && row.test_id === testId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({ id: row.id, created_at: row.created_at }));
      return { results };
    }

    if (normalized.startsWith("SELECT ID, STATUS, TOTAL_MS, SESSION_UUID, CREATED_AT, RAW_OUTPUT")) {
      const [testId] = params as [number];
      const result = Array.from(this.testResults.values())
        .filter((row) => row.test_id === testId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({
          id: row.id,
          status: row.status,
          total_ms: row.total_ms,
          session_uuid: row.session_uuid,
          created_at: row.created_at,
          raw_output: row.raw_output,
          ai_prompt_to_fix_error: row.ai_prompt_to_fix_error,
          ai_human_readable_error_description: row.ai_human_readable_error_description,
        }));
      return { results: result.slice(0, 1) };
    }

    return { results: [] };
  }
}

function createMockEnv() {
  const db = new MockD1Database();
  const dashboardHtml = "<!doctype html><title>Workspace Health Dashboard</title>";
  const mockResponse = JSON.stringify({
    human_summary: "Drive operations completed successfully.",
    dev_agent_prompt: "No action needed.",
    overall_fix_prompt: "All systems operational.",
  });

  const kvStore = new Map<string, string>();
  const env = {
    DB: db,
    KV: {
      put: async (key: string, value: string) => {
        kvStore.set(key, value);
      },
      get: async (key: string) => kvStore.get(key) ?? null,
    },
    VECTORIZE: {
      describe: async () => ({ index: "mock-index", status: "ok" }),
    },
    AI: {
      run: async () => ({
        response: { text: mockResponse },
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      }),
    },
    ASSETS: {
      fetch: async () => new Response(dashboardHtml, { status: 200 }),
    },
    AI_AGENT_WORKER: {
      fetch: async () => new Response("ok"),
    },
    WORKSPACE_TOOLS_VERSION: "test",
    GOOGLE_AUTH_BASE: "https://example.com/auth",
    GOOGLE_TOKEN_URL: "https://example.com/token",
    GOOGLE_API_BASE: "https://example.com/api",
    OAUTH_REDIRECT_URI: "https://example.com/callback",
    DEFAULT_USER: "test-user",
    GEMINI_API_KEY: "test",
    ANTHROPIC_API_KEY: "test",
    OPENAI_API_KEY: "test",
    GOOGLE_SERVICE_ACCOUNT_KEY: "{}",
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    ALLOWED_ORIGINS: "*",
    API_KEY: "test-key",
  } satisfies Record<string, unknown>;

  return { env: env as unknown as Env, db };
}

async function testReadinessEndpoint() {
  const { env } = createMockEnv();
  const request = new Request("http://test/", { method: "GET" });
  const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined };
  const response = await healthRoutes.fetch(request, env, ctx as any);
  assert.equal(response.status, 200, "Readiness endpoint should return HTTP 200");
  const payload = (await response.json()) as any;
  assert.equal(payload.dbOk, true, "DB readiness flag should be true");
  assert.equal(payload.agentOk, true, "AI readiness flag should be true");
  console.log("✅ /health readiness check passed");
}

async function testHealthRunEndpoint() {
  const { env, db } = createMockEnv();
  const request = new Request("http://test/run", { method: "POST" });
  const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined };
  const response = await healthRoutes.fetch(request, env, ctx as any);
  assert.equal(response.status, 200, "Health run endpoint should return HTTP 200");
  const payload = (await response.json()) as any;
  assert.equal(payload.success, true, "Health run should complete successfully");
  assert.ok(typeof payload.reportId === "string" && payload.reportId.length > 0, "Report ID should be returned");
  assert.equal(db.reports.get(payload.reportId)?.status, "COMPLETE", "Report should be marked COMPLETE");
  assert.equal(Array.from(db.analyses.values()).length, 1, "AI analysis should be persisted");
  console.log("✅ /health/run execution passed");
}

async function testDashboardEndpoint() {
  const { env } = createMockEnv();
  const request = new Request("http://test/dashboard", { method: "GET" });
  const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined };
  const response = await healthRoutes.fetch(request, env, ctx as any);
  assert.equal(response.status, 200, "Dashboard endpoint should return HTTP 200");
  const html = await response.text();
  assert.ok(html.includes("Workspace Health Dashboard") || html.length > 0, "Dashboard HTML should be returned");
  console.log("✅ /health/dashboard asset serving passed");
}

async function testTestsSnapshotEndpoint() {
  const { env } = createMockEnv();
  const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined };
  const response = await healthRoutes.fetch(new Request("http://test/tests", { method: "GET" }), env, ctx as any);
  assert.equal(response.status, 200, "Snapshot endpoint should return HTTP 200");
  const payload = (await response.json()) as any;
  assert.equal(payload.success, true, "Snapshot endpoint should return success");
  assert.ok(Array.isArray(payload.data) && payload.data.length > 0, "Snapshot should include test definitions");
  console.log("✅ /health/tests snapshot passed");
}

async function testRunTestsEndpoint() {
  const { env } = createMockEnv();
  const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined };
  const response = await healthRoutes.fetch(new Request("http://test/tests/run", { method: "POST" }), env, ctx as any);
  assert.equal(response.status, 200, "Tests run endpoint should return HTTP 200");
  const payload = (await response.json()) as any;
  assert.equal(payload.success, true, "Diagnostic run should succeed");
  assert.ok(payload.data?.sessionUuid, "Session UUID should be set");
  assert.ok(Array.isArray(payload.data?.results), "Results should be present");
  console.log("✅ /health/tests/run execution passed");
}

export async function runTests() {
  await testReadinessEndpoint();
  await testHealthRunEndpoint();
  await testDashboardEndpoint();
  await testTestsSnapshotEndpoint();
  await testRunTestsEndpoint();
  console.log("🎉 Health route unit tests completed successfully");
}

declare const require: NodeRequire | undefined;
declare const module: NodeModule | undefined;

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  runTests().catch((error) => {
    console.error("❌ Health route unit tests failed", error);
    process.exitCode = 1;
  });
}
