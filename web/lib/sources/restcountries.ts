import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson } from "./util";

// REST Countries is a free, keyless snapshot of country attributes — great for
// the quirky geography/demographics rankings that do well on social. One fetch
// powers several metrics computed client-side.
//
// params:
//   metric – "area" | "density" | "borders"

interface RcCountry {
  name?: { common?: string };
  cca3?: string;
  area?: number;
  population?: number;
  borders?: string[];
  timezones?: string[];
  languages?: Record<string, string>;
}

const METRICS = {
  area: { unit: "km²", additive: true },
  density: { unit: "people/km²", additive: false },
  borders: { unit: "neighbours", additive: false },
  timezones: { unit: "time zones", additive: false },
  languages: { unit: "languages", additive: false },
} as const;

type MetricKey = keyof typeof METRICS;

// REST Countries fields to request — kept in sync with the metrics above.
const FIELDS = "name,cca3,area,population,borders,timezones,languages";

function valueFor(c: RcCountry, metric: MetricKey): number | null {
  switch (metric) {
    case "area":
      return c.area && c.area > 0 ? c.area : null;
    case "density":
      return c.area && c.area > 0 && c.population
        ? c.population / c.area
        : null;
    case "borders":
      return c.borders ? c.borders.length : 0;
    case "timezones":
      return c.timezones ? c.timezones.length : 0;
    case "languages":
      return c.languages ? Object.keys(c.languages).length : 0;
  }
}

function normalize(rows: RcCountry[], entry: CatalogEntry): Series {
  const metric = (entry.params.metric as MetricKey) || "area";
  const cfg = METRICS[metric];
  const points: DataPoint[] = [];

  for (const c of rows) {
    const label = c.name?.common;
    if (!label) continue;
    const value = valueFor(c, metric);
    if (value == null || !Number.isFinite(value)) continue;
    // Skip zero-count rows (e.g. island nations have no land borders).
    if ((metric === "borders" || metric === "languages") && value === 0) continue;
    points.push({ label, id: c.cca3, value, year: undefined });
  }

  if (points.length === 0) throw new Error("REST Countries returned no rows");
  points.sort((a, b) => b.value - a.value);
  return {
    title: entry.metric,
    unit: cfg.unit,
    source: "REST Countries",
    points,
    additive: cfg.additive,
  };
}

export const restCountries: SourceAdapter = {
  id: "restcountries",
  label: "REST Countries",
  async fetch(entry: CatalogEntry): Promise<Series> {
    try {
      // The /all endpoint requires an explicit field list.
      const rows = await fetchJson<RcCountry[]>(
        `https://restcountries.com/v3.1/all?fields=${FIELDS}`,
      );
      if (!Array.isArray(rows)) throw new Error("REST Countries: unexpected shape");
      return normalize(rows, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
