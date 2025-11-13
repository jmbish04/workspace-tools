export interface TestErrorMappingEntry {
  meaning: string;
  solution: string;
}

export interface TestDefinitionSeed {
  code: string;
  name: string;
  description: string;
  errorMapping: Record<string, TestErrorMappingEntry>;
}

export const TEST_DEFINITION_SEEDS: TestDefinitionSeed[] = [
  {
    code: "db_connection",
    name: "D1 Database Connectivity",
    description: "Validates that the primary D1 database is reachable and can execute a trivial query.",
    errorMapping: {
      NO_CONNECTION: {
        meaning: "The worker could not execute a basic query against the D1 database.",
        solution: "Verify the D1 binding configuration and ensure migrations have been applied.",
      },
      TIMEOUT: {
        meaning: "The database query timed out.",
        solution: "Check for long-running transactions or throttling on the D1 instance.",
      },
    },
  },
  {
    code: "drive_health",
    name: "Drive Module Smoke Test",
    description: "Executes the Drive health checks to ensure Drive-related workflow is operational.",
    errorMapping: {
      DRIVE_BASIC_OPS: {
        meaning: "Drive health checks reported a failure in basic Drive operations.",
        solution: "Confirm that service account permissions are intact and Drive APIs are reachable.",
      },
    },
  },
  {
    code: "ai_router",
    name: "AI Router Sanity Check",
    description: "Routes a minimal prompt through the AI Router to confirm Workers AI accessibility.",
    errorMapping: {
      AI_BINDING_MISSING: {
        meaning: "The Workers AI binding was not present or misconfigured.",
        solution: "Review wrangler configuration and ensure the AI binding (AI) is provisioned.",
      },
      AI_RESPONSE_INVALID: {
        meaning: "The AI router returned an unexpected or empty response.",
        solution: "Inspect AI model selection and logs for upstream service issues.",
      },
    },
  },
  {
    code: "kv_cache",
    name: "KV Cache Read/Write",
    description: "Writes and reads a temporary key in KV to guarantee cache operations succeed.",
    errorMapping: {
      KV_WRITE_FAILED: {
        meaning: "Writing to the KV namespace failed.",
        solution: "Ensure KV binding is configured and that the namespace is available.",
      },
      KV_READ_FAILED: {
        meaning: "Reading from the KV namespace failed.",
        solution: "Confirm the worker has read permissions and the write operation completed.",
      },
    },
  },
  {
    code: "vectorize_binding",
    name: "Vectorize Binding",
    description: "Describes the Vectorize index to confirm vector search capabilities are reachable.",
    errorMapping: {
      VECTORIZE_UNAVAILABLE: {
        meaning: "The Vectorize binding is missing or returned an error.",
        solution: "Verify the Vectorize index binding in wrangler.toml and ensure the index exists.",
      },
    },
  },
];

