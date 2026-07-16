import type { CatalogEntry, Series, SourceAdapter, SourceId } from "./types";
import { worldBank } from "./worldbank";

// Registry of source adapters. Add new adapters (OWID, FRED, Eurostat…) here
// and reference them from catalog entries by id.
const ADAPTERS: Record<SourceId, SourceAdapter> = {
  worldbank: worldBank,
};

// The curated catalog — the "topics" a user browses. Each entry maps a
// human-friendly card to a concrete, fetchable indicator. Kept small and
// hand-picked so every option makes a genuinely interesting chart.
export const CATALOG: CatalogEntry[] = [
  {
    id: "gdp-total",
    title: "Biggest economies",
    blurb: "Total GDP by country — who really runs the global economy.",
    topic: "Economy",
    source: "worldbank",
    params: { indicator: "NY.GDP.MKTP.CD" },
    defaultChart: "rankedBar",
    unit: "US$",
  },
  {
    id: "population-total",
    title: "Most populous countries",
    blurb: "Where the world's 8 billion people actually live.",
    topic: "Population",
    source: "worldbank",
    params: { indicator: "SP.POP.TOTL" },
    defaultChart: "rankedBar",
    unit: "people",
  },
  {
    id: "co2-per-capita",
    title: "Biggest carbon footprints",
    blurb: "CO₂ emissions per person — the ranking that surprises people.",
    topic: "Environment",
    source: "worldbank",
    params: { indicator: "EN.ATM.CO2E.PC" },
    defaultChart: "rankedBar",
    unit: "t",
  },
  {
    id: "life-expectancy",
    title: "Where people live longest",
    blurb: "Life expectancy at birth, by country.",
    topic: "Health",
    source: "worldbank",
    params: { indicator: "SP.DYN.LE00.IN" },
    defaultChart: "rankedBar",
    unit: "years",
  },
  {
    id: "world-gdp-trend",
    title: "The world economy over time",
    blurb: "Global GDP since 2000 — the long climb.",
    topic: "Economy",
    source: "worldbank",
    // World aggregate handled as a time series; indicator kept for live upgrade.
    params: { indicator: "NY.GDP.MKTP.CD", scope: "world-trend" },
    defaultChart: "line",
    unit: "US$",
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
