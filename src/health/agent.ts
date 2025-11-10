import { AiRouterService } from "../services/ai-router";
import { Env } from "../types";
import { LoggerAdapter } from "../utils/logger-adapter";

export interface HealthAnalysis {
  human_summary: string;
  dev_agent_prompt: string;
  overall_fix_prompt: string;
}

export async function analyzeHealthReport(
  reportId: string,
  env: Env,
  logger?: LoggerAdapter,
): Promise<HealthAnalysis> {
  const runsResult = await env.DB.prepare(
    "SELECT id FROM health_runs WHERE report_id = ?",
  )
    .bind(reportId)
    .all();

  const runs = (runsResult.results ?? []) as Array<{ id: string }>;

  if (!runs.length) {
    throw new Error(`No health runs found for report ${reportId}`);
  }

  const runIds = runs.map((run) => run.id);
  const placeholders = runIds.map(() => "?").join(",");

  const logsResult = await env.DB.prepare(
    `SELECT * FROM health_logs WHERE run_id IN (${placeholders})`,
  )
    .bind(...runIds)
    .all();

  const logs = logsResult.results ?? [];

  const contextPayload = {
    reportId,
    runs,
    logs,
  };

  const aiRouter = new AiRouterService(env, logger);
  const response = await aiRouter.route({
    input: "Analyze the latest Drive health check results.",
    context: JSON.stringify(contextPayload),
    instructions: [
      "You are a specialized Google Workspace system health analyst.",
      "Provide a structured JSON object with the following fields:",
      "1. human_summary - a concise summary suitable for operational teams.",
      "2. dev_agent_prompt - guidance for an automated remediation agent.",
      "3. overall_fix_prompt - a follow-up prompt for engineering investigation.",
      "Respond with valid JSON only. Do not include markdown or commentary.",
    ].join(" "),
    reasoningLevel: "high",
  });

  const sanitized = response.aggregatedResponse.trim();

  try {
    const parsed = JSON.parse(sanitized);

    if (
      typeof parsed.human_summary !== "string" ||
      typeof parsed.dev_agent_prompt !== "string" ||
      typeof parsed.overall_fix_prompt !== "string"
    ) {
      throw new Error("AI response missing required fields");
    }

    return parsed;
  } catch (error) {
    logger?.error("Failed to parse health analysis response", {
      reportId,
      response: sanitized,
      error,
    });

    throw new Error("Failed to parse AI health analysis response");
  }
}

