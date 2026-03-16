import type { Env } from "../types";

export async function analyzeFailure(env: Env, testName: string, errorPayload: any) {
  try {
    if (!env.AI) {
      return {
        description: "AI binding not configured.",
        prompt: "Check wrangler.jsonc and bindings.",
      };
    }

    const messages = [
      { role: "system", content: "You are an expert Cloudflare Workers engineer diagnosing an edge system failure. Provide a short human readable description, and an actionable fix prompt." },
      { role: "user", content: `Test '${testName}' failed. Payload: ${JSON.stringify(errorPayload)}` }
    ];

    const response = await env.AI.run("@cf/meta/llama-2-7b-chat-int8", { messages });
    const text = response.response || "";

    // Naive parsing for structure
    return {
      description: text.slice(0, 150) + "...",
      prompt: "Review logs and retry.", // Simplified for example
    };
  } catch (err) {
    return {
      description: "AI analysis failed.",
      prompt: "Manual investigation required.",
    };
  }
}
