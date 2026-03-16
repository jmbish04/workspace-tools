import { buildRouter } from "./router";
import { RoomDO } from "./do/RoomDO";
import { buildOpenAPIDocument } from "./utils/openapi";
import { runAllTests } from "./tests/runner";
import type { Env } from "./types";
import { stringify } from "yaml";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/openapi.json") {
      const doc = buildOpenAPIDocument(`${url.origin}`);
      return Response.json(doc, { headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    if (url.pathname === "/openapi.yaml") {
      const doc = buildOpenAPIDocument(`${url.origin}`);
      const yaml = stringify(doc);
      return new Response(yaml, { headers: { "content-type": "application/yaml", "Access-Control-Allow-Origin": "*" } });
    }

    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const projectId = url.searchParams.get("projectId") ?? "default";
      const id = env.ROOM_DO.idFromName(projectId);
      const stub = env.ROOM_DO.get(id);
      return stub.fetch(request);
    }

    // MCP endpoints
    if (url.pathname.startsWith("/mcp/")) {
      const { mcpRoutes } = await import("./mcp");
      const routes = mcpRoutes();
      if (url.pathname === "/mcp/tools" && request.method === "GET") {
        return Response.json(await routes.tools());
      }
      if (url.pathname === "/mcp/execute" && request.method === "POST") {
        const body = await request.json();
        try {
          const res = await routes.execute(env, ctx, body);
          return Response.json(res);
        } catch (e: any) {
          return Response.json({ success: false, error: e?.message ?? "MCP error" }, { status: 400 });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    // Pass matching api/rpc through Hono
    if (url.pathname.startsWith("/api/") || url.pathname === "/rpc") {
      const app = buildRouter();
      return app.fetch(request, env, ctx);
    }

    // Fallback to ASSETS
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const session_uuid = crypto.randomUUID();
    ctx.waitUntil(runAllTests(env, session_uuid));
  }
} satisfies ExportedHandler<Env>;

export { RoomDO };
