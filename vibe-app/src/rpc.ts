import { z } from "zod";
import * as S from "./schemas/apiSchemas";
import type { Env, RPCMethod } from "./types";

const createTask = async (params: unknown) => {
  const input = S.CreateTaskRequest.parse(params);
  const task = {
    id: crypto.randomUUID(),
    title: input.title,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  return { success: true as const, task };
};

const listTasks = async () => {
  return { success: true as const, tasks: [] };
};

const runAnalysis = async (params: unknown) => {
  const input = S.AnalysisRequest.parse(params);
  return { success: true as const, report: { taskId: input.taskId, score: 0.82, notes: "ok" } };
};

export const rpcRegistry: Record<RPCMethod, (p: unknown, env: Env, ctx: ExecutionContext) => Promise<unknown>> = {
  createTask: async (p, env, ctx) => createTask(p),
  listTasks: async (p, env, ctx) => listTasks(),
  runAnalysis: async (p, env, ctx) => runAnalysis(p),
};

export async function dispatchRPC(method: string, params: unknown, env: Env, ctx: ExecutionContext) {
  if (!(method in rpcRegistry)) throw new Error(`Unknown method: ${method}`);
  // @ts-expect-error runtime check above guarantees safety
  return await rpcRegistry[method](params, env, ctx);
}
