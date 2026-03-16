import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { dispatchRPC } from "./rpc";
import { getLatestSession, listActiveTests } from "./utils/db";
import { runAllTests } from "./tests/runner";
import type { Env } from "./types";

export function buildRouter() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:"],
    },
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
  }));

  app.use("/api/*", cors());

  app.get("/api/health", async (c) => {
    // Quick snapshot
    const results = await getLatestSession(c.env.DB);
    const pass = results.every(r => r.status === 'pass');
    return c.json({
      success: true,
      ts: new Date().toISOString(),
      version: "1.0.0",
      status: results.length ? (pass ? 'pass' : 'fail') : 'unknown',
      lastSession: results.length > 0 ? results[0].session_uuid : null
    });
  });

  app.post("/api/tests/run", async (c) => {
    const session_uuid = crypto.randomUUID();
    // Run async, don't await response in real-world large suites
    // For demo, we await to ensure rows exist immediately, or just fire and forget
    c.executionCtx.waitUntil(runAllTests(c.env, session_uuid));
    return c.json({ success: true, session_uuid, message: "Tests started" });
  });

  app.get("/api/tests/defs", async (c) => {
    const tests = await listActiveTests(c.env.DB);
    return c.json({ success: true, tests });
  });

  app.get("/api/tests/latest", async (c) => {
    const results = await getLatestSession(c.env.DB);
    return c.json({ success: true, results });
  });

  app.post("/api/tasks", async (c) => {
    const body = await c.req.json();
    const res = await dispatchRPC("createTask", body, c.env, c.executionCtx);
    return c.json(res);
  });

  app.get("/api/tasks", async (c) => {
    const res = await dispatchRPC("listTasks", null, c.env, c.executionCtx);
    return c.json(res);
  });

  app.post("/api/analyze", async (c) => {
    const body = await c.req.json();
    const res = await dispatchRPC("runAnalysis", body, c.env, c.executionCtx);
    return c.json(res);
  });

  app.post("/rpc", async (c) => {
    const body = await c.req.json();
    const { method, params } = body;
    try {
      const result = await dispatchRPC(method, params, c.env, c.executionCtx);
      return c.json({ success: true, result });
    } catch (e: any) {
      return c.json({ success: false, error: e?.message ?? "RPC error" }, 400);
    }
  });

  return app;
}
