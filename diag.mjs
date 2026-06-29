const base = "https://nano-banana-remote-mcp.onrender.com";
const tok = "03e3806aab27f5bc78162421432a4568";
const url = `${base}/mcp/${tok}`;
const headers = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

async function post(label, body) {
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = r.headers.get("mcp-session-id");
  const ct = r.headers.get("content-type");
  const text = await r.text();
  console.log(`\n[${label}] HTTP ${r.status} | content-type=${ct} | mcp-session-id=${sid}`);
  console.log("body:", text.slice(0, 400));
  return { status: r.status, sid };
}

const init = await post("initialize", {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "diag", version: "1.0" } },
});

// Replay the initialized notification, echoing any session id the server gave us.
if (init.sid) headers["mcp-session-id"] = init.sid;
await post("notifications/initialized", { jsonrpc: "2.0", method: "notifications/initialized" });

await post("tools/list", { jsonrpc: "2.0", id: 2, method: "tools/list" });
process.exit(0);
