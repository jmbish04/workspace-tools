export const DEFAULT_TESTS = [
  {
    id: "test-001",
    name: "OpenAPI JSON Endpoint",
    description: "Verifies the dynamic OpenAPI schema endpoint is active and returns valid JSON.",
    category: "API",
    severity: "High",
    is_active: 1,
    error_map: JSON.stringify({
      "NOT_FOUND": { meaning: "Endpoint missing", fix: "Check router index.ts mounting" }
    })
  },
  {
    id: "test-002",
    name: "Durable Object Registry",
    description: "Verifies DO instantiation and WebSocket upgrade paths are configured.",
    category: "Realtime",
    severity: "Critical",
    is_active: 1,
    error_map: JSON.stringify({
      "UPGRADE_FAILED": { meaning: "WS negotiation failed", fix: "Check wrangler.jsonc DO bindings" }
    })
  }
];
