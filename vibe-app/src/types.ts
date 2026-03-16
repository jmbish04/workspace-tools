export interface Env {
  ROOM_DO: DurableObjectNamespace;
  DB: D1Database;
  AI: any; // Cloudflare Workers AI binding
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

export type RPCMethod = "createTask" | "listTasks" | "runAnalysis";
