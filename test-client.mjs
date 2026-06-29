import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Token in the URL PATH — the same form you'll paste into claude.ai.
const url = new URL("http://127.0.0.1:8910/mcp/test-secret-123");
const transport = new StreamableHTTPClientTransport(url);
const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const res = await client.callTool({
  name: "generate_image",
  arguments: { prompt: "a tiny green cartoon dinosaur waving, flat vector, white background" },
});
const img = res.content.find((c) => c.type === "image");
console.log("IMAGE returned:", img ? `${img.mimeType}, ${img.data.length} b64 chars` : "NONE");

await client.close();
process.exit(0);
