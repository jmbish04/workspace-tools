import { ChatProvider, ChatChunkHandler, ChatMessage } from "./base";
export class CloudflareAIProvider implements ChatProvider {
  id = "cloudflare"; supportsTools = false;
  async streamChat(opts: { model: string; messages: ChatMessage[]; signal?: AbortSignal; env: any }, onDelta: ChatChunkHandler) {
    const model = opts.model || "@cf/meta/llama-3-8b-instruct";
    const url = `https://api.cloudflare.com/client/v4/accounts/${opts.env.CF_AI_ACCOUNT_ID}/ai/run/${encodeURIComponent(model)}?stream=true`;
    const r = await fetch(url, { method: "POST", headers: { "Authorization": `Bearer ${opts.env.CF_AI_API_TOKEN}`, "content-type": "application/json", "accept": "text/event-stream" }, body: JSON.stringify({ messages: opts.messages }) });
    const reader = r.body!.getReader(); const dec = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break;
      const s = dec.decode(value);
      for (const line of s.split("\n")) { if (!line.startsWith("data:")) continue; const payload = line.slice(5).trim(); if (!payload) continue;
        try { const j = JSON.parse(payload); const delta = j.response || j.delta || ""; if (delta) await onDelta(delta); } catch {} }
    }
  }
}
