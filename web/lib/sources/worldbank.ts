import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson, isRealCountryCode } from "./util";

const WB_BASE = "https://api.worldbank.org/v2";

// Pull the most recent non-null value per country over a recent window.
function buildUrl(indicator: string): string {
  const params = new URLSearchParams({
    format: "json",
    date: "2010:2024",
    per_page: "20000",
  });
  return `${WB_BASE}/country/all/indicator/${indicator}?${params.toString()}`;
}

interface WbRow {
  countryiso3code: string;
  country: { id: string; value: string };
  date: string;
  value: number | null;
}

function normalize(rows: WbRow[], entry: CatalogEntry): Series {
  // Keep the latest year with a value for each country.
  const latest = new Map<string, DataPoint>();
  let maxYear = 0;

  for (const row of rows) {
    const iso3 = row.countryiso3code;
    if (!isRealCountryCode(iso3)) continue;
    if (row.value == null || !Number.isFinite(row.value)) continue;
    const year = Number(row.date);
    const existing = latest.get(iso3);
    if (!existing || (existing.year ?? 0) < year) {
      latest.set(iso3, {
        label: row.country.value,
        id: iso3,
        value: row.value,
        year,
      });
    }
    if (year > maxYear) maxYear = year;
  }

  const points = [...latest.values()].sort((a, b) => b.value - a.value);
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "World Bank Open Data",
    year: maxYear || undefined,
    points,
    additive: entry.additive,
  };
}

export const worldBank: SourceAdapter = {
  id: "worldbank",
  label: "World Bank Open Data",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const indicator = entry.params.indicator;
    if (!indicator) throw new Error(`Catalog entry ${entry.id} missing indicator`);

    try {
      const json = await fetchJson<[unknown, WbRow[] | null]>(buildUrl(indicator));
      const rows = json?.[1];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("World Bank returned no data rows");
      }
      return normalize(rows, entry);
    } catch (err) {
      // Network is often unavailable in restricted dev sandboxes. Fall back to
      // a bundled snapshot so the studio still renders. The banner in the UI
      // flags that the data is a cached sample, not live.
      const fixture = getFixture(entry.id);
      if (fixture) {
        return { ...fixture, fromFixture: true };
      }
      throw err;
    }
  },
};
