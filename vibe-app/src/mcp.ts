import { z } from "zod";
import { dispatchRPC, rpcRegistry } from "./rpc";
import type { Env } from "./types";

const ExecuteBody = z.object({ tool: z.string(), params: z.any() });

export function mcpRoutes() {
  return {
    tools: async () => {
      const tools = Object.keys(rpcRegistry).map((name) => ({
        name,
        description: `Tool for ${name}`,
      }));
      return { tools };
    },
    execute: async (env: Env, ctx: ExecutionContext, body: unknown) => {
      const { tool, params } = ExecuteBody.parse(body);
      const result = await dispatchRPC(tool, params, env, ctx);
      return { success: true, result };
    },
  };
}
