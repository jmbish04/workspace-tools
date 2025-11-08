# Agent Overview

## AI Router Service
- **Name:** AI Router Service
- **Purpose:** Route Workspace Tools AI requests between Cloudflare Workers AI models with schema-aware payloads, response sanitisation, and chunked execution for large prompts.
- **Class:** `AiRouterService` (`src/services/ai-router.ts`)
- **Bindings:** `AI`
- **Dependencies:** Utilises `LoggerAdapter` for structured logging and Workers AI native binding.
- **Migration Tag:** _Not applicable_
- **Usage Example:**
  ```json
  POST /ai/route
  {
    "input": "Summarise the following document...",
    "context": "<long document text>",
    "reasoningLevel": "high"
  }
  ```

## Routing Endpoints
- `GET /ai/health` — Lightweight readiness probe returning the configured model map.
- `POST /ai/route` — Normalised AI request entry point that enforces payload validation, rate limiting (`ai` bucket), and unified response schema.

## Implementation Notes
- All responses are sanitised to remove markdown / JSON code fences before returning to callers.
- Requests exceeding the selected model context window are chunked with a safety buffer before dispatching sequential calls to Workers AI.
- Model selection heuristics favour `@cf/openai/gpt-oss-120b` for high-reasoning or long-text inputs and fall back to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for shorter prompts.
- Health checks include `/ai/health`; ensure any future AI endpoints extend `HealthCheckService.checks` accordingly.
- When adding new AI models, update `AiRouterService.MODEL_CONFIG`, sanitisation rules, and document the change here to keep runtime behaviour traceable.
