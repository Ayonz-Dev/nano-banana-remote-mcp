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
  Eight adapters ship today — World Bank, Our World in Data, OECD, FRED, IMF,
  REST Countries, Eurostat, and Wikidata — across ~33 curated topics spanning
  economy, environment, health, geography, and culture. New sources slot in the
  same way.
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

## Data sources

| Source | Adapter | Shape | Key? | Notes |
|--------|---------|-------|------|-------|
| **World Bank Open Data** | `worldbank.ts` | Country ranking | no | Thousands of indicators; latest year per country. |
| **Our World in Data** | `owid.ts` | Country ranking | no | Any grapher slug via its CSV export; optional value scaling. |
| **OECD** | `oecd.ts` | Country ranking | no | Generic SDMX-JSON parser. Dataflow query URLs are long/version-specific — validate each against [data-explorer.oecd.org](https://data-explorer.oecd.org). |
| **FRED** (St. Louis Fed) | `fred.ts` | Time series (line) | yes | US economic series (inflation, unemployment, rates). Needs `FRED_API_KEY`. |
| **IMF** (World Economic Outlook) | `imf.ts` | Country ranking | no | DataMapper API — clean JSON, works live out of the box (GDP/capita, govt debt). |
| **REST Countries** | `restcountries.ts` | Country ranking | no | Geography/demographics quirks (land area, density, borders) from one keyless fetch. |
| **Eurostat** | `eurostat.ts` | Country ranking (EU) | no | JSON-stat parser. Dataset codes + query filters are specific — validate against the [Eurostat database](https://ec.europa.eu/eurostat/web/main/data/database). |
| **Wikidata** | `wikidata.ts` | Ranking (any entity) | no | SPARQL queries for cultural rankings (heritage sites, Nobel laureates, tallest buildings). Ranks non-country entities too via `entityNoun`. Validate queries at [query.wikidata.org](https://query.wikidata.org). |

Every adapter live-fetches first and falls back to a bundled sample snapshot
(flagged in the UI) when the upstream is unreachable or a key is missing — so
the studio always renders.

Two data *shapes* exist: **rankings** (many entities at one moment → ranked bar,
with top-N / dominance / concentration / extreme angles) and **time series**
(one entity over time → line, with now / change / peak angles). Adapters set
`temporal: true` for the latter.

## Chart forms

- **Ranked bar** — the default for rankings.
- **Line** — for time series (`temporal`).
- **World map (choropleth)** — offered whenever a ranking geolocates to
  countries. `lib/geo.ts` resolves each row to an ISO3 code (handling 2-letter
  and Eurostat's `EL`/`UK` quirks) and `lib/worldmap.ts` registers a bundled
  Natural Earth boundary set (via `world-atlas`, no runtime fetch) keyed by
  ISO3 so regions match exactly. Non-country rankings (e.g. tallest buildings)
  don't offer the map.

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
| `FRED_API_KEY` | no | Enables live FRED series. Free from the St. Louis Fed. Without it, FRED topics serve the bundled sample. |

## Live data hosts

The app fetches from these hosts at runtime. In an unrestricted deploy
(Render/Vercel) they work out of the box. If you run inside a network-policied
sandbox and want live data during development, allowlist:

- `api.worldbank.org` — World Bank indicator data
- `ourworldindata.org` — OWID grapher CSVs
- `sdmx.oecd.org` — OECD SDMX-JSON
- `www.imf.org` — IMF DataMapper
- `restcountries.com` — REST Countries
- `ec.europa.eu` — Eurostat JSON-stat
- `query.wikidata.org` — Wikidata SPARQL
- `api.stlouisfed.org` — FRED series (only if using FRED)
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
