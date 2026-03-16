import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import * as S from "../schemas/apiSchemas";

export function buildOpenAPIDocument(baseUrl: string) {
  const registry = new OpenAPIRegistry();

  // Register schemas
  registry.register("Task", S.Task);
  registry.register("CreateTaskRequest", S.CreateTaskRequest);
  registry.register("CreateTaskResponse", S.CreateTaskResponse);
  registry.register("ListTasksResponse", S.ListTasksResponse);
  registry.register("AnalysisRequest", S.AnalysisRequest);
  registry.register("AnalysisResponse", S.AnalysisResponse);
  registry.register("ErrorResponse", S.ErrorResponse);

  // Paths
  registry.registerPath({
    method: "post",
    path: "/api/tasks",
    operationId: "createTask",
    summary: "Create a task",
    description: "Creates a new task with the given title",
    request: { body: { content: { "application/json": { schema: S.CreateTaskRequest } } } },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: S.CreateTaskResponse } } },
      400: { description: "Bad Request", content: { "application/json": { schema: S.ErrorResponse } } },
    },
    tags: ["Tasks"],
  });

  registry.registerPath({
    method: "get",
    path: "/api/tasks",
    operationId: "listTasks",
    summary: "List tasks",
    description: "Returns a list of all current tasks",
    responses: {
      200: { description: "OK", content: { "application/json": { schema: S.ListTasksResponse } } },
    },
    tags: ["Tasks"],
  });

  registry.registerPath({
    method: "post",
    path: "/api/analyze",
    operationId: "runAnalysis",
    summary: "Run analysis",
    description: "Performs deep analysis on a specific task",
    request: { body: { content: { "application/json": { schema: S.AnalysisRequest } } } },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: S.AnalysisResponse } } },
      400: { description: "Bad Request", content: { "application/json": { schema: S.ErrorResponse } } },
    },
    tags: ["Analysis"],
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Multi-Protocol Worker API",
      version: "1.0.0",
      description: "REST + WS + RPC + MCP API definition",
    },
    servers: [{ url: baseUrl }],
    tags: [{ name: "Tasks" }, { name: "Analysis" }],
  });

  // Inject jsonSchemaDialect manually to comply with 3.1.0 requirement in prompt
  return { ...doc, jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema" };
}
