import { DurableObject } from "cloudflare:workers";
import { formatWsMessage } from "../utils/ws";

export class RoomDO extends DurableObject {
  // Accept WS using the hibernatable API
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept connection for hibernation
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // ignore invalid json
      return;
    }

    // Broadcast to all other connected sockets in this room
    for (const sock of this.ctx.getWebSockets()) {
      if (sock !== ws) {
        sock.send(formatWsMessage("broadcast", parsed, { timestamp: Date.now() }));
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    try { ws.close(code, reason || "closing"); } catch {}
  }

  async webSocketError(ws: WebSocket, err: unknown) {
    console.error("WS error", err);
    try { ws.close(1011, "error"); } catch {}
  }
}
