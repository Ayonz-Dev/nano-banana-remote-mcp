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

// Upload bytes and return { path, link } (link is a direct-download URL). Best-effort.
// Note: we intentionally do NOT set Dropbox-API-Path-Root, so writes go to the
// member's default (home) namespace — the correct, writable location on Business accounts.
async function uploadToDropbox(buffer, filename) {
  const token = await dropboxAccessToken();
  const dest = `${DROPBOX_DEST_PATH}/${filename}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
    "Dropbox-API-Arg": JSON.stringify({ path: dest, mode: "add", autorename: true, mute: true }),
  };

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

// ---------------- In-memory image hosting (for ChatGPT Action image URLs) ----------------
const imageStore = new Map(); // id -> { buf, mimeType, at }
const IMAGE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const IMAGE_MAX = 200;

function hostImage(buf, mimeType) {
  const id = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
  imageStore.set(id, { buf, mimeType: mimeType || "image/png", at: Date.now() });
  // Evict oldest / expired.
  for (const [k, v] of imageStore) {
    if (Date.now() - v.at > IMAGE_TTL_MS) imageStore.delete(k);
  }
  while (imageStore.size > IMAGE_MAX) {
    const oldest = [...imageStore.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (!oldest) break;
    imageStore.delete(oldest[0]);
  }
  return id;
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
app.set("trust proxy", true); // so req.protocol reflects https behind Render's proxy
app.use(express.json({ limit: "30mb" }));

function authorized(req) {
  if (!AUTH_TOKEN) return true;
  const fromHeader = (req.headers["authorization"] || "") === `Bearer ${AUTH_TOKEN}`;
  const fromApiKey = (req.headers["x-api-key"] || "") === AUTH_TOKEN;
  const fromPath = req.params.token === AUTH_TOKEN;
  const fromQuery = req.query.t === AUTH_TOKEN;
  return fromHeader || fromApiKey || fromPath || fromQuery;
}

function publicBaseUrl(req) {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

// Serve a hosted image by id (public; ids are unguessable).
app.get("/images/:id", (req, res) => {
  const key = req.params.id.replace(/\.[a-z0-9]+$/i, ""); // tolerate a .png/.jpg suffix
  const item = imageStore.get(key);
  if (!item) return res.status(404).send("Not found");
  res.set("Content-Type", item.mimeType);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(item.buf);
});

// ---- REST API for ChatGPT Custom GPT Actions ----
async function restImageResponse(req, res, images, prefix) {
  const first = images[0];
  const buf = Buffer.from(first.base64, "base64");
  const id = hostImage(buf, first.mimeType);
  const ext = (first.mimeType && first.mimeType.split("/")[1]) || "png";
  const out = { image_url: `${publicBaseUrl(req)}/images/${id}.${ext}` };
  if (DROPBOX_ENABLED) {
    try {
      const { path, link } = await uploadToDropbox(buf, tsName(prefix, first.mimeType));
      out.dropbox_path = path;
      if (link) out.dropbox_link = link;
    } catch (e) {
      out.dropbox_error = String(e.message).slice(0, 200);
    }
  }
  res.json(out);
}

app.post("/api/generate", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const prompt = req.body?.prompt;
    if (!prompt) return res.status(400).json({ error: "Missing 'prompt'" });
    const images = await callGemini([{ text: prompt }]);
    await restImageResponse(req, res, images, "generated");
  } catch (e) {
    res.status(500).json({ error: String(e.message).slice(0, 400) });
  }
});

app.post("/api/edit", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { imageUrl, prompt } = req.body || {};
    if (!imageUrl || !prompt) return res.status(400).json({ error: "Missing 'imageUrl' or 'prompt'" });
    const src = await fetchImageAsBase64(imageUrl);
    const images = await callGemini([
      { text: prompt },
      { inline_data: { mime_type: src.mimeType, data: src.base64 } },
    ]);
    await restImageResponse(req, res, images, "edited");
  } catch (e) {
    res.status(500).json({ error: String(e.message).slice(0, 400) });
  }
});

// Self-describing OpenAPI spec for the Custom GPT builder.
app.get("/openapi.json", (req, res) => {
  const base = publicBaseUrl(req);
  res.json({
    openapi: "3.1.0",
    info: { title: "Nano Banana Image Generator", version: "1.0.0", description: "Generate and edit images with Gemini." },
    servers: [{ url: base }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/generate": {
        post: {
          operationId: "generateImage",
          summary: "Generate a new image from a text prompt. Returns image_url.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["prompt"], properties: { prompt: { type: "string", description: "Detailed description of the image" } } } } },
          },
          responses: { "200": { description: "Generated image", content: { "application/json": { schema: { type: "object", properties: { image_url: { type: "string" }, dropbox_path: { type: "string" }, dropbox_link: { type: "string" } } } } } } },
        },
      },
      "/api/edit": {
        post: {
          operationId: "editImage",
          summary: "Edit an existing image (given a public URL) with instructions. Returns image_url.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["imageUrl", "prompt"], properties: { imageUrl: { type: "string", description: "Public URL of the source image" }, prompt: { type: "string", description: "What to change" } } } } },
          },
          responses: { "200": { description: "Edited image", content: { "application/json": { schema: { type: "object", properties: { image_url: { type: "string" }, dropbox_path: { type: "string" }, dropbox_link: { type: "string" } } } } } } },
        },
      },
    },
  });
});

app.get("/", (_req, res) => res.send("nano-banana remote MCP is running. POST /mcp"));
app.get("/health", (_req, res) =>
  res.json({ ok: true, model: MODEL, build: "dropbox-v2", dropbox: DROPBOX_ENABLED })
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
