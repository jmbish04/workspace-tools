export function formatWsMessage(type: string, payload: any, meta = {}) {
  return JSON.stringify({ type, payload, meta });
}

export function parseWsMessage(data: string | ArrayBuffer) {
  const text = typeof data === "string" ? data : new TextDecoder().decode(data);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
