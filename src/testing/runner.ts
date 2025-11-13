import { AiRouterService } from "../services/ai-router";
import type { Env } from "../types";
import { LoggerAdapter } from "../utils/logger-adapter";
import { TEST_DEFINITION_SEEDS } from "./definitions";
import { TEST_HANDLERS, TestExecutionContext, TestExecutionResult } from "./tests";

export interface PersistedTestDefinition {
  id: number;
  code: string;
  name: string;
  description: string;
  errorMapping: Record<string, { meaning: string; solution: string }>;
  isActive: boolean;
}

export interface PersistedTestResult {
  id: number;
  testId: number;
  code: string;
  status: "pass" | "fail";
  totalMs: number;
  sessionUuid: string;
  createdAt: string;
  rawOutput: string | null;
  aiPromptToFixError: string | null;
  aiHumanReadableErrorDescription: string | null;
}

export interface TestRunSummary {
  sessionUuid: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  results: PersistedTestResult[];
  counts: {
    total: number;
    passed: number;
    failed: number;
  };
}

async function runExecute(env: Env, sql: string, ...params: unknown[]) {
  const result = await env.DB.prepare(sql).bind(...params).run();
  if (!result.success) {
    // Throw an error to ensure the caller handles the failure.
    throw new Error(`DB execute failed for query: ${sql.substring(0, 100)}...`);
  }
  return result;
}

async function runQuery<T = Record<string, unknown>>(env: Env, sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await env.DB.prepare(sql).bind(...params).all<T>();
  return (result?.results as T[]) || [];
}

export async function ensureTestDefinitions(env: Env): Promise<void> {
  for (const seed of TEST_DEFINITION_SEEDS) {
    await runExecute(
      env,
      `INSERT INTO health_test_definitions (code, name, description, error_mapping_json, is_active, updated_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(code) DO UPDATE SET
         name=excluded.name,
         description=excluded.description,
         error_mapping_json=excluded.error_mapping_json,
         is_active=excluded.is_active,
         updated_at=CURRENT_TIMESTAMP`,
      seed.code,
      seed.name,
      seed.description,
      JSON.stringify(seed.errorMapping),
    );
  }
}

export async function getActiveTestDefinitions(env: Env): Promise<PersistedTestDefinition[]> {
  const rows = await runQuery<
    {
      id: number;
      code: string;
      name: string;
      description: string;
      error_mapping_json: string | null;
      is_active: number;
    }
  >(env, `SELECT id, code, name, description, error_mapping_json, is_active FROM health_test_definitions WHERE is_active = 1 ORDER BY code`);

  return rows.map((row) => {
    let errorMapping: Record<string, { meaning: string; solution: string }> = {};
    if (row.error_mapping_json) {
      try {
        errorMapping = JSON.parse(row.error_mapping_json);
      } catch (error) {
        console.warn(`[Testing] Failed to parse error mapping for ${row.code}:`, error);
      }
    }
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      errorMapping,
      isActive: row.is_active === 1,
    };
  });
}

interface AiEvaluationResult {
  aiPrompt: string;
  aiHumanSummary: string;
}

async function evaluateWithAi(
  env: Env,
  logger: LoggerAdapter | undefined,
  definition: PersistedTestDefinition,
  result: TestExecutionResult,
  durationMs: number,
): Promise<AiEvaluationResult> {
  try {
    const router = new AiRouterService(env, logger);
    const response = await router.route({
      input: [
        `Test code: ${definition.code}`,
        `Test name: ${definition.name}`,
        `Status: ${result.status}`,
        `DurationMs: ${durationMs}`,
        `Raw Output: ${result.rawOutput}`,
        `Error Mapping: ${JSON.stringify(definition.errorMapping)}`,
      ].join("\n"),
      instructions: [
        "You are the reliability advisor for Workspace Tools.",
        "Return a JSON object with `human_summary` and `prompt_to_fix_error` fields.",
        "If the status is pass, provide a concise confirmation in human_summary and set prompt_to_fix_error to 'No action required'.",
        "If the status is fail, explain the likely issue in human_summary and craft prompt_to_fix_error as a follow-up instruction for an engineer.",
      ].join(" "),
      reasoningLevel: result.status === "fail" ? "high" : "medium",
      maxOutputTokens: 256,
    });

    const safeText = response.aggregatedResponse.trim();
    const parsed = JSON.parse(safeText);

    if (typeof parsed.human_summary === "string" && typeof parsed.prompt_to_fix_error === "string") {
      return {
        aiHumanSummary: parsed.human_summary,
        aiPrompt: parsed.prompt_to_fix_error,
      };
    }
  } catch (error) {
    logger?.error("AI evaluation failed", error);
  }

  if (result.status === "pass") {
    return {
      aiHumanSummary: "All checks passed successfully. No action required.",
      aiPrompt: "No action required.",
    };
  }

  return {
    aiHumanSummary: "AI evaluation unavailable. Review raw output for details.",
    aiPrompt: "Manually inspect the raw logs and rerun the test after remediation.",
  };
}

export async function runHealthTestSuite(
  env: Env,
  { logger }: { logger?: LoggerAdapter } = {},
): Promise<TestRunSummary> {
  await ensureTestDefinitions(env);
  const definitions = await getActiveTestDefinitions(env);

  const sessionUuid = crypto.randomUUID();
  const startedAt = new Date();

  const executionContext: TestExecutionContext = { env, logger };
  const results: PersistedTestResult[] = [];

  for (const definition of definitions) {
    const handler = TEST_HANDLERS[definition.code];
    const started = performance.now();
    let execution: TestExecutionResult;

    if (!handler) {
      execution = {
        status: "fail",
        rawOutput: `No test handler registered for code ${definition.code}`,
        errorCode: "UNKNOWN_TEST",
      };
    } else {
      execution = await handler(executionContext);
    }

    const durationMs = Math.round(performance.now() - started);
    const evaluation = await evaluateWithAi(env, logger, definition, execution, durationMs);

    await runExecute(
      env,
      `INSERT INTO health_test_results
        (session_uuid, test_id, status, total_ms, raw_output, ai_prompt_to_fix_error, ai_human_readable_error_description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      sessionUuid,
      definition.id,
      execution.status,
      durationMs,
      execution.rawOutput ?? null,
      evaluation.aiPrompt,
      evaluation.aiHumanSummary,
    );

    const [persistedRow] = await runQuery<
      {
        id: number;
        created_at: string;
      }
    >(env, `SELECT id, created_at FROM health_test_results WHERE session_uuid = ? AND test_id = ? ORDER BY created_at DESC LIMIT 1`, sessionUuid, definition.id);

    results.push({
      id: persistedRow?.id ?? -1,
      testId: definition.id,
      code: definition.code,
      status: execution.status,
      totalMs: durationMs,
      sessionUuid,
      createdAt: persistedRow?.created_at ?? new Date().toISOString(),
      rawOutput: execution.rawOutput,
      aiPromptToFixError: evaluation.aiPrompt,
      aiHumanReadableErrorDescription: evaluation.aiHumanSummary,
    });
  }

  const completedAt = new Date();
  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;

  return {
    sessionUuid,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalDurationMs: completedAt.getTime() - startedAt.getTime(),
    results,
    counts: {
      total: results.length,
      passed,
      failed,
    },
  };
}

export interface TestDashboardEntry {
  definition: PersistedTestDefinition;
  latestResult: PersistedTestResult | null;
}

export async function getTestDashboardSnapshot(env: Env): Promise<TestDashboardEntry[]> {
  await ensureTestDefinitions(env);
  const definitions = await getActiveTestDefinitions(env);
  const entries: TestDashboardEntry[] = [];

  for (const definition of definitions) {
    const [latest] = await runQuery<
      {
        id: number;
        status: "pass" | "fail";
        total_ms: number;
        session_uuid: string;
        created_at: string;
        raw_output: string | null;
        ai_prompt_to_fix_error: string | null;
        ai_human_readable_error_description: string | null;
      }
    >(env,
      `SELECT id, status, total_ms, session_uuid, created_at, raw_output,
              ai_prompt_to_fix_error, ai_human_readable_error_description
         FROM health_test_results
        WHERE test_id = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      definition.id,
    );

    const latestResult = latest
      ? ({
          id: latest.id,
          testId: definition.id,
          code: definition.code,
          status: latest.status,
          totalMs: latest.total_ms,
          sessionUuid: latest.session_uuid,
          createdAt: latest.created_at,
          rawOutput: latest.raw_output,
          aiPromptToFixError: latest.ai_prompt_to_fix_error,
          aiHumanReadableErrorDescription: latest.ai_human_readable_error_description,
        } as PersistedTestResult)
      : null;

    entries.push({
      definition,
      latestResult,
    });
  }

  return entries;
}
