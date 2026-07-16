import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson } from "./util";

// FRED (Federal Reserve Bank of St. Louis) serves single economic time series —
// US GDP, inflation, unemployment, rates. These are best shown as a line chart.
// Requires a free API key in FRED_API_KEY; without one we fall back to fixtures.
//
// params:
//   series_id – FRED series, e.g. "CPIAUCSL", "UNRATE", "FEDFUNDS"
//   units     – (optional) FRED transform, e.g. "pc1" for percent-change-from-
//               year-ago (turns a price index into an inflation rate)
//   start     – (optional) observation_start, defaults to 2000-01-01

interface FredObservation {
  date: string;
  value: string;
}
interface FredResponse {
  observations?: FredObservation[];
}

function buildUrl(entry: CatalogEntry, key: string): string {
  const params = new URLSearchParams({
    series_id: entry.params.series_id,
    api_key: key,
    file_type: "json",
    // Aggregate to annual so the line reads cleanly at social sizes.
    frequency: "a",
    aggregation_method: "avg",
    observation_start: entry.params.start || "2000-01-01",
  });
  if (entry.params.units) params.set("units", entry.params.units);
  return `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`;
}

function normalize(res: FredResponse, entry: CatalogEntry): Series {
  const obs = res.observations ?? [];
  const points: DataPoint[] = [];
  let maxYear = 0;

  for (const o of obs) {
    if (o.value === "." || o.value == null) continue; // FRED marks gaps with "."
    const value = Number(o.value);
    if (!Number.isFinite(value)) continue;
    const year = Number(o.date.slice(0, 4));
    points.push({ label: String(year), value, year });
    if (year > maxYear) maxYear = year;
  }

  if (points.length === 0) throw new Error("FRED returned no usable observations");
  points.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "FRED (Federal Reserve Bank of St. Louis)",
    year: maxYear || undefined,
    points,
    additive: false, // a single series over time is never a share-of-total
    temporal: true,
  };
}

export const fred: SourceAdapter = {
  id: "fred",
  label: "FRED (Federal Reserve, St. Louis)",
  async fetch(entry: CatalogEntry): Promise<Series> {
    if (!entry.params.series_id) {
      throw new Error(`Catalog entry ${entry.id} missing series_id`);
    }
    const key = process.env.FRED_API_KEY;
    try {
      if (!key) throw new Error("FRED_API_KEY not set");
      const res = await fetchJson<FredResponse>(buildUrl(entry, key));
      return normalize(res, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
