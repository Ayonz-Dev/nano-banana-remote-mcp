import type { CatalogEntry, Series, SourceAdapter, SourceId } from "./types";
import { worldBank } from "./worldbank";
import { owid } from "./owid";
import { oecd } from "./oecd";
import { fred } from "./fred";

// Registry of source adapters. Add new adapters (Eurostat, IMF…) here and
// reference them from catalog entries by id.
const ADAPTERS: Record<SourceId, SourceAdapter> = {
  worldbank: worldBank,
  owid,
  oecd,
  fred,
};

// The curated catalog — the "topics" a user browses. Each entry maps a
// human-friendly card to a concrete, fetchable indicator. Kept hand-picked so
// every option makes a genuinely interesting chart.
export const CATALOG: CatalogEntry[] = [
  // ── World Bank ──────────────────────────────────────────────────────────
  {
    id: "gdp-total",
    title: "Biggest economies",
    metric: "GDP (current US$)",
    blurb: "Total GDP by country — who really runs the global economy.",
    topic: "Economy",
    source: "worldbank",
    params: { indicator: "NY.GDP.MKTP.CD" },
    defaultChart: "rankedBar",
    unit: "US$",
    additive: true,
  },
  {
    id: "population-total",
    title: "Most populous countries",
    metric: "Population, total",
    blurb: "Where the world's 8 billion people actually live.",
    topic: "Population",
    source: "worldbank",
    params: { indicator: "SP.POP.TOTL" },
    defaultChart: "rankedBar",
    unit: "people",
    additive: true,
  },
  {
    id: "co2-per-capita",
    title: "Biggest carbon footprints",
    metric: "CO₂ emissions (t per capita)",
    blurb: "CO₂ emissions per person — the ranking that surprises people.",
    topic: "Environment",
    source: "worldbank",
    params: { indicator: "EN.ATM.CO2E.PC" },
    defaultChart: "rankedBar",
    unit: "t",
    additive: false,
  },
  {
    id: "life-expectancy",
    title: "Where people live longest",
    metric: "Life expectancy at birth",
    blurb: "Life expectancy at birth, by country.",
    topic: "Health",
    source: "worldbank",
    params: { indicator: "SP.DYN.LE00.IN" },
    defaultChart: "rankedBar",
    unit: "years",
    additive: false,
  },
  {
    id: "world-gdp-trend",
    title: "The world economy over time",
    metric: "World GDP (current US$)",
    blurb: "Global GDP since 2000 — the long climb.",
    topic: "Economy",
    source: "worldbank",
    // World aggregate handled as a time series; indicator kept for live upgrade.
    params: { indicator: "NY.GDP.MKTP.CD", scope: "world-trend" },
    defaultChart: "line",
    unit: "US$",
    additive: false,
  },

  // ── Our World in Data ───────────────────────────────────────────────────
  {
    id: "owid-co2-total",
    title: "The world's biggest emitters",
    metric: "Annual CO₂ emissions",
    blurb: "Total CO₂ emitted per country — who actually moves the needle.",
    topic: "Environment",
    source: "owid",
    // Raw CSV is in tonnes; scale to gigatonnes for a readable axis.
    params: { slug: "annual-co2-emissions-per-country", scale: "1000000000" },
    defaultChart: "rankedBar",
    unit: "Gt CO₂",
    additive: true,
  },
  {
    id: "owid-wind-solar-share",
    title: "Powered by wind & sun",
    metric: "Share of electricity from wind & solar",
    blurb: "How much of each country's power comes from wind and solar.",
    topic: "Energy",
    source: "owid",
    params: { slug: "share-electricity-wind-solar" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },

  // ── OECD ────────────────────────────────────────────────────────────────
  // NOTE: OECD dataflow query URLs are long and version-specific. These are
  // best-effort SDMX-JSON queries — validate/adjust them against the OECD Data
  // Explorer (data-explorer.oecd.org). Until then, the studio serves the
  // bundled sample for these entries.
  {
    id: "oecd-unemployment",
    title: "Where jobs are scarce",
    metric: "Unemployment rate",
    blurb: "Harmonised unemployment rate across OECD economies.",
    topic: "Economy",
    source: "oecd",
    params: {
      url: "https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/..._Z.Y._T.Y_GE15..M?startPeriod=2023",
    },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },
  {
    id: "oecd-rnd",
    title: "Who bets on R&D",
    metric: "R&D spending (% of GDP)",
    blurb: "Gross domestic spending on research & development.",
    topic: "Technology",
    source: "oecd",
    params: {
      url: "https://sdmx.oecd.org/public/rest/data/OECD.STI.STP,DSD_MSTI@DF_MSTI,1.0/.G_XGDP.......?startPeriod=2020",
    },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },

  // ── FRED (US economic time series) ──────────────────────────────────────
  // Requires FRED_API_KEY (free). Without it, the bundled sample is served.
  {
    id: "fred-inflation",
    title: "US inflation, decoded",
    metric: "US inflation rate (CPI, YoY)",
    blurb: "Year-over-year change in US consumer prices since 2000.",
    topic: "Economy",
    source: "fred",
    // pc1 = percent change from a year ago → turns the CPI index into inflation.
    params: { series_id: "CPIAUCSL", units: "pc1" },
    defaultChart: "line",
    unit: "%",
    additive: false,
  },
  {
    id: "fred-unemployment",
    title: "US unemployment over time",
    metric: "US unemployment rate",
    blurb: "The US civilian unemployment rate, year by year.",
    topic: "Economy",
    source: "fred",
    params: { series_id: "UNRATE" },
    defaultChart: "line",
    unit: "%",
    additive: false,
  },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}

export async function fetchSeries(entry: CatalogEntry): Promise<Series> {
  const adapter = ADAPTERS[entry.source];
  if (!adapter) throw new Error(`No adapter registered for source ${entry.source}`);
  return adapter.fetch(entry);
}

export type { CatalogEntry, Series } from "./types";
