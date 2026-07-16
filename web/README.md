# DataForge Studio

Turn **public datasets** into **precise, branded, social-ready charts** and
captions — a Voronoi-style content engine you can run yourself.

Pick a topic → the app fetches live public data → it surfaces the interesting
"angle" → renders an on-brand chart → writes a platform-specific caption → you
export a ready-to-post PNG.

## Design principles

- **Numbers are rendered deterministically, never by an image model.** Charts
  come from real data through [ECharts](https://echarts.apache.org/); the AI
  only writes captions. This is what keeps the content credible.
- **One consistent brand.** All visual tokens live in `lib/brand.ts` — change
  them once and every export re-skins.
- **Pluggable data sources.** `lib/sources/` defines a small adapter interface.
  The first adapter is World Bank Open Data (free, no key, thousands of
  general-interest indicators). OWID, FRED, and Eurostat slot in the same way.
- **Works offline.** When a data source can't be reached (e.g. a locked-down
  sandbox), the app falls back to bundled sample snapshots and clearly labels
  the chart as a sample. Deployed with open egress, it pulls live figures.

## Architecture

```
Topic (catalog)  ─▶  fetch + normalize   ─▶  find angles     ─▶  branded chart  ─▶  caption   ─▶  PNG
lib/sources/index    lib/sources/*.ts        lib/angles.ts       lib/chart.ts       lib/caption   ECharts getDataURL
                     (live + fixtures)       (deterministic)     (ECharts option)   (Gemini/fallback)
```

- `app/api/series/[id]` — resolves a catalog topic to normalized data + angles.
- `app/api/caption` — generates a caption (Gemini when configured, else a solid
  built-in template).
- `components/Studio.tsx` — the studio UI (topic picker, angle picker, theme /
  format / row controls, caption, export).

## Run locally

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `GEMINI_API_KEY` | no | Enables AI captions. Without it, the built-in caption writer is used. |
| `GEMINI_TEXT_MODEL` | no | Defaults to `gemini-2.5-flash`. |

## Live data hosts

The app fetches from these hosts at runtime. In an unrestricted deploy
(Render/Vercel) they work out of the box. If you run inside a network-policied
sandbox and want live data during development, allowlist:

- `api.worldbank.org` — indicator data
- `generativelanguage.googleapis.com` — Gemini captions (only if using AI captions)

## Deploy

Any Node host works. On **Vercel**: point it at the `web/` directory, framework
auto-detected. On **Render**: a Web Service with root `web/`, build
`npm install && npm run build`, start `npm run start`, and set `GEMINI_API_KEY`
if you want AI captions.

## Extending

- **New topic:** add a `CatalogEntry` to `lib/sources/index.ts`.
- **New data source:** implement the `SourceAdapter` interface in
  `lib/sources/` and register it in the `ADAPTERS` map.
- **New chart form:** add a builder in `lib/chart.ts` (e.g. treemap, map, bump).
- **Re-brand:** edit `lib/brand.ts`.
