import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL("https://nano-banana-remote-mcp.onrender.com/mcp/03e3806aab27f5bc78162421432a4568");
const transport = new StreamableHTTPClientTransport(url);
const client = new Client({ name: "verify", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const res = await client.callTool({
  name: "generate_image",
  arguments: { prompt: "a banana riding a surfboard on a wave, flat vector, white background" },
});
const img = res.content.find((c) => c.type === "image");
console.log("IMAGE:", img ? `${img.mimeType}, ${img.data.length} b64 chars` : "NONE");

await client.close();
process.exit(0);
