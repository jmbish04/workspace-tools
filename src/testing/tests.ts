import { DriveClient, runDriveHealthChecks } from "../drive";
import { AiRouterService } from "../services/ai-router";
import type { Env } from "../types";
import type { LoggerAdapter } from "../utils/logger-adapter";

export type TestStatus = "pass" | "fail";

export interface TestExecutionResult {
  status: TestStatus;
  rawOutput: string;
  errorCode?: string;
}

export interface TestExecutionContext {
  env: Env;
  logger?: LoggerAdapter;
}

type TestHandler = (context: TestExecutionContext) => Promise<TestExecutionResult>;

async function runDbConnection({ env }: TestExecutionContext): Promise<TestExecutionResult> {
  try {
    const row = await env.DB.prepare("SELECT 1 as value").first();
    if (!row || ((row as { value?: number }).value ?? 0) !== 1) {
      return {
        status: "fail",
        rawOutput: JSON.stringify(row),
        errorCode: "NO_CONNECTION",
      };
    }

    return {
      status: "pass",
      rawOutput: JSON.stringify(row),
    };
  } catch (error) {
    return {
      status: "fail",
      rawOutput: error instanceof Error ? error.message : String(error),
      errorCode: "NO_CONNECTION",
    };
  }
}

async function runDriveHealth(context: TestExecutionContext): Promise<TestExecutionResult> {
  try {
    const client = new DriveClient(context.env);
    const { results, logs } = await runDriveHealthChecks(client);
    const failing = results.find((result) => !result.success);

    if (failing) {
      return {
        status: "fail",
        rawOutput: JSON.stringify({ results, logs }),
        errorCode: failing.testName?.toUpperCase() || "DRIVE_BASIC_OPS",
      };
    }

    return {
      status: "pass",
      rawOutput: JSON.stringify({ results, logs }),
    };
  } catch (error) {
    return {
      status: "fail",
      rawOutput: error instanceof Error ? error.message : String(error),
      errorCode: "DRIVE_BASIC_OPS",
    };
  }
}

async function runAiRouter(context: TestExecutionContext): Promise<TestExecutionResult> {
  if (!context.env.AI) {
    return {
      status: "fail",
      rawOutput: "AI binding is not configured",
      errorCode: "AI_BINDING_MISSING",
    };
  }

  try {
    const router = new AiRouterService(context.env, context.logger);
    const response = await router.route({
      input: "Respond with the single word OK.",
      instructions: "Return exactly the word 'OK' to confirm availability.",
      reasoningLevel: "low",
      maxOutputTokens: 32,
    });

    const sanitized = response.aggregatedResponse.trim().toUpperCase();

    if (sanitized !== "OK") {
      return {
        status: "fail",
        rawOutput: JSON.stringify(response),
        errorCode: "AI_RESPONSE_INVALID",
      };
    }

    return {
      status: "pass",
      rawOutput: JSON.stringify(response),
    };
  } catch (error) {
    return {
      status: "fail",
      rawOutput: error instanceof Error ? error.message : String(error),
      errorCode: "AI_BINDING_MISSING",
    };
  }
}

async function runKvCache({ env }: TestExecutionContext): Promise<TestExecutionResult> {
  const key = `health-test-${crypto.randomUUID()}`;
  try {
    await env.KV.put(key, "ok", { expirationTtl: 120 });
  } catch (error) {
    return {
      status: "fail",
      rawOutput: error instanceof Error ? error.message : String(error),
      errorCode: "KV_WRITE_FAILED",
    };
  }

  try {
    const value = await env.KV.get(key);
    if (value !== "ok") {
      return {
        status: "fail",
        rawOutput: String(value),
        errorCode: "KV_READ_FAILED",
      };
    }

    return {
      status: "pass",
      rawOutput: JSON.stringify({ key, value }),
    };
  } catch (error) {
    return {
      status: "fail",
      rawOutput: error instanceof Error ? error.message : String(error),
      errorCode: "KV_READ_FAILED",
    };
  }
}

async function runVectorize({ env }: TestExecutionContext): Promise<TestExecutionResult> {
  try {
    if (!env.VECTORIZE || typeof env.VECTORIZE.describe !== "function") {
      return {
        status: "fail",
        rawOutput: "Vectorize binding is not available.",
        errorCode: "VECTORIZE_UNAVAILABLE",
      };
    }

    const description = await env.VECTORIZE.describe();

    return {
      status: "pass",
      rawOutput: JSON.stringify(description),
    };
  } catch (error) {
    return {
      status: "fail",
      rawOutput: error instanceof Error ? error.message : String(error),
      errorCode: "VECTORIZE_UNAVAILABLE",
    };
  }
}

export const TEST_HANDLERS: Record<string, TestHandler> = {
  db_connection: runDbConnection,
  drive_health: runDriveHealth,
  ai_router: runAiRouter,
  kv_cache: runKvCache,
  vectorize_binding: runVectorize,
};

