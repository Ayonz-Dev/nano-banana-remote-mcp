import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---- Config (from environment) ----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || ""; // shared secret; if set, required
const PORT = process.env.PORT || 8080;

// ---- Dropbox config (optional). If all three are set, images are uploaded. ----
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY || "";
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET || "";
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN || "";
const DROPBOX_DEST_PATH = (process.env.DROPBOX_DEST_PATH || "/Pictures/Nano Banana").replace(/\/+$/, "");
const DROPBOX_ENABLED = !!(DROPBOX_APP_KEY && DROPBOX_APP_SECRET && DROPBOX_REFRESH_TOKEN);

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

// ---------------- Dropbox ----------------
let dropboxRootNamespace = null; // cached path-root for personal/team accounts

async function dropboxAccessToken() {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: DROPBOX_REFRESH_TOKEN,
    client_id: DROPBOX_APP_KEY,
    client_secret: DROPBOX_APP_SECRET,
  });
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Dropbox token refresh failed (${r.status}): ${await r.text()}`);
  return (await r.json()).access_token;
}

async function dropboxRootHeader(accessToken) {
  if (dropboxRootNamespace) return dropboxRootNamespace;
  const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (r.ok) {
    const acct = await r.json();
    const ns = acct?.root_info?.root_namespace_id;
    if (ns) dropboxRootNamespace = JSON.stringify({ ".tag": "root", root: ns });
  }
  return dropboxRootNamespace;
}

// Upload bytes and return { path, link } (link is a direct-download URL). Best-effort.
async function uploadToDropbox(buffer, filename) {
  const token = await dropboxAccessToken();
  const pathRoot = await dropboxRootHeader(token);
  const dest = `${DROPBOX_DEST_PATH}/${filename}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
    "Dropbox-API-Arg": JSON.stringify({ path: dest, mode: "add", autorename: true, mute: true }),
  };
  if (pathRoot) headers["Dropbox-API-Path-Root"] = pathRoot;

  const up = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers,
    body: buffer,
  });
  if (!up.ok) throw new Error(`Dropbox upload failed (${up.status}): ${await up.text()}`);
  const meta = await up.json();
  const finalPath = meta.path_display || dest;

  // Create a direct-download shared link (best-effort).
  let link = null;
  try {
    const linkHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (pathRoot) linkHeaders["Dropbox-API-Path-Root"] = pathRoot;
    const lr = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
      method: "POST",
      headers: linkHeaders,
      body: JSON.stringify({ path: finalPath }),
    });
    if (lr.ok) {
      link = (await lr.json()).url;
    } else {
      // If a link already exists, fetch it.
      const ex = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
        method: "POST",
        headers: linkHeaders,
        body: JSON.stringify({ path: finalPath, direct_only: true }),
      });
      if (ex.ok) link = (await ex.json())?.links?.[0]?.url || null;
    }
    if (link) link = link.replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1");
  } catch {
    /* link is optional */
  }
  return { path: finalPath, link };
}

function tsName(prefix, mimeType) {
  const ext = (mimeType && mimeType.split("/")[1]) || "png";
  // No Date.now in some sandboxes here, but plain Node is fine on the server.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${rand}.${ext}`;
}

// Build MCP content: image blocks + a text note with Dropbox locations.
async function buildContent(images, prefix) {
  const content = images.map((img) => ({ type: "image", data: img.base64, mimeType: img.mimeType }));
  if (!DROPBOX_ENABLED) return content;

  const notes = [];
  for (const img of images) {
    try {
      const buf = Buffer.from(img.base64, "base64");
      const { path, link } = await uploadToDropbox(buf, tsName(prefix, img.mimeType));
      notes.push(`Saved to Dropbox: ${path}${link ? `\nDownload: ${link}` : ""}`);
    } catch (e) {
      notes.push(`(Dropbox upload failed: ${String(e.message).slice(0, 200)})`);
    }
  }
  content.push({ type: "text", text: notes.join("\n\n") });
  return content;
}

// ---- Build an MCP server instance with the tools ----
function buildServer() {
  const server = new McpServer({ name: "nano-banana-remote", version: "1.1.0" });

  server.registerTool(
    "generate_image",
    {
      title: "Generate image",
      description:
        "Generate a NEW image from a text prompt using Google's Gemini image model. Returns the image inline" +
        (DROPBOX_ENABLED ? " and saves a copy to Dropbox (path + download link in the result)." : "."),
      inputSchema: { prompt: z.string().describe("Detailed description of the image to create") },
    },
    async ({ prompt }) => {
      const images = await callGemini([{ text: prompt }]);
      return { content: await buildContent(images, "generated") };
    }
  );

  server.registerTool(
    "edit_image",
    {
      title: "Edit image",
      description:
        "Edit/transform an existing image given its public URL plus instructions (e.g. 'put on white background'). Returns the edited image inline" +
        (DROPBOX_ENABLED ? " and saves a copy to Dropbox." : "."),
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
      return { content: await buildContent(images, "edited") };
    }
  );

  return server;
}

// ---- HTTP layer (stateless Streamable HTTP) ----
const app = express();
app.use(express.json({ limit: "30mb" }));

function authorized(req) {
  if (!AUTH_TOKEN) return true;
  const fromHeader = (req.headers["authorization"] || "") === `Bearer ${AUTH_TOKEN}`;
  const fromPath = req.params.token === AUTH_TOKEN;
  const fromQuery = req.query.t === AUTH_TOKEN;
  return fromHeader || fromPath || fromQuery;
}

app.get("/", (_req, res) => res.send("nano-banana remote MCP is running. POST /mcp"));
app.get("/health", (_req, res) =>
  res.json({ ok: true, model: MODEL, build: "dropbox-v1", dropbox: DROPBOX_ENABLED })
);

app.post(["/mcp", "/mcp/:token"], async (req, res) => {
  if (!authorized(req)) {
    return res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
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
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: String(err?.message || err) }, id: null });
    }
  }
});

app.listen(PORT, () => {
  console.log(
    `nano-banana remote MCP on :${PORT} (model: ${MODEL}, auth: ${AUTH_TOKEN ? "on" : "off"}, dropbox: ${DROPBOX_ENABLED ? "on -> " + DROPBOX_DEST_PATH : "off"})`
  );
});
