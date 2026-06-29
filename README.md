# Nano Banana — Remote MCP Server

A small remote MCP server that exposes Gemini image generation/editing as a
**custom connector** you can add to Claude on **web, mobile, and desktop** — so
it works in *every* chat, not just on one PC.

Tools:
- `generate_image(prompt)` — returns a new image inline in the chat.
- `edit_image(imageUrl, prompt)` — edits an image from a public URL, returns it inline.

## How it differs from the local setup
The local `nano-banana` server runs `node` on your PC and only works in Claude
Desktop / Claude Code on that machine. This remote version runs on an always-on
host at a public URL, which is what claude.ai (web + mobile) requires.

## Environment variables
| Var | Required | Purpose |
|-----|----------|---------|
| `GEMINI_API_KEY` | yes | Your Google Gemini API key (kept server-side) |
| `MCP_AUTH_TOKEN` | recommended | Shared secret. If set, requests must include it (see below) |
| `GEMINI_IMAGE_MODEL` | no | Defaults to `gemini-2.5-flash-image` |
| `PORT` | no | Host sets this automatically |

## How auth works
If `MCP_AUTH_TOKEN` is set, the token must be supplied one of three ways. For
the claude.ai connector dialog (URL only), put it in the **path**:

```
https://YOUR-APP-URL/mcp/YOUR_TOKEN
```

(Also accepted: `?t=YOUR_TOKEN`, or header `Authorization: Bearer YOUR_TOKEN`.)

---

## Deploy — Render (free, recommended for simplicity)

1. Put this `remote-server/` folder in a GitHub repo.
2. Go to https://render.com → **New → Web Service** → connect the repo.
3. Render auto-detects `render.yaml`. Settings if asked: Runtime **Node**,
   Build `npm install`, Start `npm start`.
4. Under **Environment**, add secrets:
   - `GEMINI_API_KEY` = your key
   - `MCP_AUTH_TOKEN` = a long random string (your choice)
5. Deploy. You get a URL like `https://nano-banana-remote-mcp.onrender.com`.
6. Your connector URL is: `https://nano-banana-remote-mcp.onrender.com/mcp/YOUR_TOKEN`

> Render's **free** tier sleeps after ~15 min idle, so the first call after a
> nap takes ~30–50s (it may need a retry). The **$7/mo** Starter tier stays
> always-on. Fly.io and Railway are alternatives if you prefer.

## Verify it's live
Open `https://YOUR-APP-URL/health` in a browser — you should see
`{"ok":true,"model":"gemini-2.5-flash-image"}`.

---

## Add it to Claude (works everywhere after this)

1. Go to **claude.ai → Settings → Connectors** (Pro/Max/Team/Enterprise plan
   required for custom connectors).
2. **Add custom connector**.
3. Name: `Nano Banana`. URL: `https://YOUR-APP-URL/mcp/YOUR_TOKEN`.
4. Save and enable it. It now syncs to web, mobile, and desktop.
5. In any chat: *"generate an image of a banana on a surfboard"*.

## Local test
```bash
cp .env.example .env   # fill in GEMINI_API_KEY, MCP_AUTH_TOKEN
npm install
npm start
node test-client.mjs   # exercises the MCP protocol against localhost
```
