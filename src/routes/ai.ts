import { MODEL_CONFIG } from "../services/ai-router";
import { Hono } from "hono";
import { Env } from "../types";
import { AiRouterRequest, AiRouterService } from "../services/ai-router";
import { LoggerAdapter } from "../utils/logger-adapter";

const app = new Hono<{
  Bindings: Env & Record<string, unknown>;
  Variables: {
    logger: LoggerAdapter;
  };
}>();

app.get("/health", (c) => {
  return c.json({
    success: true,
    message: "AI routing service operational",
    models: {
      primary: "@cf/openai/gpt-oss-120b",
      secondary: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    },
    timestamp: new Date().toISOString(),
  });
});

app.post("/route", async (c) => {
  let body: Partial<AiRouterRequest> = {};

  try {
    body = await c.req.json();
  } catch (error) {
    c.get("logger")?.error("Invalid JSON payload received for AI routing", error);
    return c.json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON",
      },
    }, 400);
  }

  if (!body || typeof body.input !== "string" || body.input.trim().length === 0) {
    return c.json({
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Field 'input' is required and must be a non-empty string",
      },
    }, 400);
  }

  const normalized: AiRouterRequest = {
    input: body.input,
    context: typeof body.context === "string" ? body.context : undefined,
    instructions: typeof body.instructions === "string" ? body.instructions : undefined,
    reasoningLevel: isReasoningLevel(body.reasoningLevel) ? body.reasoningLevel : undefined,
    preferredModel: isPreferredModel(body.preferredModel) ? body.preferredModel : undefined,
    maxOutputTokens: typeof body.maxOutputTokens === "number" && body.maxOutputTokens > 0 ? body.maxOutputTokens : undefined,
  };

  const router = new AiRouterService(c.env, c.get("logger"));

  try {
    const result = await router.route(normalized);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    c.get("logger")?.error("AI routing request failed", error);
    return c.json({
      success: false,
      error: {
        code: "AI_ROUTER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error while routing AI request",
      },
    }, 500);
  }
});

function isReasoningLevel(value: unknown): value is AiRouterRequest["reasoningLevel"] {
  return value === "low" || value === "medium" || value === "high";
}

function isPreferredModel(value: unknown): value is AiRouterRequest["preferredModel"] {
  return typeof value === 'string' && Object.keys(MODEL_CONFIG).includes(value);
}

export default app;
