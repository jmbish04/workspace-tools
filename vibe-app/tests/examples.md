# REST
```bash
curl -sX POST $BASE/api/tasks -H 'content-type: application/json' -d '{"title":"demo"}' | jq
curl -s "$BASE/api/tasks" | jq
```

# MCP
```bash
curl -s "$BASE/mcp/tools" | jq
curl -sX POST "$BASE/mcp/execute" -H 'content-type: application/json' -d '{"tool":"runAnalysis","params":{"taskId":"00000000-0000-4000-8000-000000000000","depth":2}}' | jq
```

# RPC (HTTP harness)
```bash
curl -sX POST "$BASE/rpc" -H 'content-type: application/json' -d '{"method":"createTask","params":{"title":"fromRPC"}}' | jq
```

# WS (browser console)
```js
const ws = new WebSocket(`${location.origin.replace('http','ws')}/ws?projectId=demo`);
ws.onmessage = e => console.log('msg', e.data);
ws.onopen = () => ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
```
