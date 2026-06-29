import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---- Config (from environment) ----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || ""; // shared secret; if set, required
const PORT = process.env.PORT || 8080;

if (!GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY env var is not set.");
  process.exit(1);
}

const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

// ---- Call Gemini, return array of {mimeType, base64} images ----
async function callGemini(parts) {
  const resp = await fetch(GEMINI_URL(MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const out = [];
  const cand = data?.candidates?.[0];
  for (const p of cand?.content?.parts ?? []) {
    if (p.inlineData?.data) {
      out.push({ mimeType: p.inlineData.mimeType || "image/png", base64: p.inlineData.data });
    }
  }
  if (out.length === 0) {
    const txt = (cand?.content?.parts ?? []).map((p) => p.text).filter(Boolean).join(" ");
    throw new Error("No image returned. " + (txt || JSON.stringify(data).slice(0, 500)));
  }
  return out;
}

async function fetchImageAsBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch image URL (${r.status})`);
  const mimeType = r.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await r.arrayBuffer());
  return { mimeType, base64: buf.toString("base64") };
}

function toImageContent(images) {
  return images.map((img) => ({ type: "image", data: img.base64, mimeType: img.mimeType }));
}

// ---- Build an MCP server instance with the tools ----
function buildServer() {
  const server = new McpServer({ name: "nano-banana-remote", version: "1.0.0" });

  server.registerTool(
    "generate_image",
    {
      title: "Generate image",
      description:
        "Generate a NEW image from a text prompt using Google's Gemini image model. Returns the image inline.",
      inputSchema: { prompt: z.string().describe("Detailed description of the image to create") },
    },
    async ({ prompt }) => {
      const images = await callGemini([{ text: prompt }]);
      return { content: toImageContent(images) };
    }
  );

  server.registerTool(
    "edit_image",
    {
      title: "Edit image",
      description:
        "Edit/transform an existing image given its public URL plus instructions (e.g. 'put on white background', 'change sky to sunset'). Returns the edited image inline.",
      inputSchema: {
        imageUrl: z.string().url().describe("Public URL of the source image to edit"),
        prompt: z.string().describe("What to change about the image"),
      },
    },
    async ({ imageUrl, prompt }) => {
      const src = await fetchImageAsBase64(imageUrl);
      const images = await callGemini([
        { text: prompt },
        { inline_data: { mime_type: src.mimeType, data: src.base64 } },
      ]);
      return { content: toImageContent(images) };
    }
  );

  return server;
}

// ---- HTTP layer (stateless Streamable HTTP) ----
const app = express();
app.use(express.json({ limit: "30mb" }));

// Shared-secret auth. If MCP_AUTH_TOKEN is set, the request must present the token via:
//   - URL path:  POST /mcp/<token>     (works in the claude.ai connector dialog), or
//   - query:     POST /mcp?t=<token>,  or
//   - header:    Authorization: Bearer <token>
function authorized(req) {
  if (!AUTH_TOKEN) return true;
  const fromHeader = (req.headers["authorization"] || "") === `Bearer ${AUTH_TOKEN}`;
  const fromPath = req.params.token === AUTH_TOKEN;
  const fromQuery = req.query.t === AUTH_TOKEN;
  return fromHeader || fromPath || fromQuery;
}

app.get("/", (_req, res) => res.send("nano-banana remote MCP is running. POST /mcp"));
app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));

app.post(["/mcp", "/mcp/:token"], async (req, res) => {
  if (!authorized(req)) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
  }
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: String(err?.message || err) },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`nano-banana remote MCP listening on :${PORT} (model: ${MODEL}, auth: ${AUTH_TOKEN ? "on" : "off"})`);
});
