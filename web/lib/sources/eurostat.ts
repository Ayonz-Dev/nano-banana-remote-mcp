import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson } from "./util";

// Eurostat serves JSON-stat 2.0 from its dissemination API:
//   https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}?format=JSON&...
// JSON-stat packs all cells into a flat `value` map keyed by a single linear
// index; you reconstruct each cell from the per-dimension category positions and
// the row-major strides. We pull the geo × time slice and take the latest year
// with a value per country.
//
// Geo codes are 2-letter (AT, DE, FR…) with EU aggregates (EU27_2020, EA20).
// We keep 2-letter country codes and drop the aggregates.
//
// params:
//   dataset – Eurostat dataset code, e.g. "earn_mw_cur"
//   query   – extra query string pinning the other dimensions (unit, currency…)

interface JsonStat {
  id?: string[];
  size?: number[];
  dimension?: Record<
    string,
    { category?: { index?: Record<string, number>; label?: Record<string, string> } }
  >;
  value?: Record<string, number | null> | Array<number | null>;
}

const EU_AGGREGATES = new Set([
  "EU", "EU27_2020", "EU28", "EU27_2007", "EA", "EA12", "EA19", "EA20",
  "EEA", "EEA30_2007", "EFTA", "EU15",
]);

function isEuCountry(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && !EU_AGGREGATES.has(code);
}

// Row-major strides so linearIndex = Σ position_d * stride_d.
function strides(size: number[]): number[] {
  const s = new Array(size.length).fill(1);
  for (let i = size.length - 2; i >= 0; i--) s[i] = s[i + 1] * size[i + 1];
  return s;
}

function readValue(
  value: JsonStat["value"],
  index: number,
): number | null {
  if (!value) return null;
  const v = Array.isArray(value) ? value[index] : value[String(index)];
  return v == null || !Number.isFinite(v) ? null : v;
}

function normalize(json: JsonStat, entry: CatalogEntry): Series {
  const dims = json.id ?? [];
  const size = json.size ?? [];
  if (dims.length === 0 || size.length !== dims.length) {
    throw new Error("Eurostat JSON-stat missing id/size");
  }
  const geoPos = dims.indexOf("geo");
  const timePos = dims.indexOf("time");
  if (geoPos < 0 || timePos < 0) throw new Error("Eurostat missing geo/time dims");

  const stride = strides(size);
  const geoCat = json.dimension?.geo?.category;
  const timeCat = json.dimension?.time?.category;
  const geoIndex = geoCat?.index ?? {};
  const geoLabel = geoCat?.label ?? {};
  const timeIndex = timeCat?.index ?? {};

  // time code sorted by position → last is most recent.
  const timesByPos = Object.entries(timeIndex).sort((a, b) => a[1] - b[1]);

  // Non-geo/time dimensions are assumed pinned to size 1 by the query; use
  // position 0 for each.
  const basePos = new Array(dims.length).fill(0);

  const points: DataPoint[] = [];
  let maxYear = 0;

  for (const [code, gPos] of Object.entries(geoIndex)) {
    if (!isEuCountry(code)) continue;
    // Walk time from newest to oldest, take the first cell that has a value.
    for (let t = timesByPos.length - 1; t >= 0; t--) {
      const [timeCode, tPos] = timesByPos[t];
      const pos = [...basePos];
      pos[geoPos] = gPos;
      pos[timePos] = tPos;
      const linear = pos.reduce((acc, p, d) => acc + p * stride[d], 0);
      const v = readValue(json.value, linear);
      if (v == null) continue;
      const year = Number(timeCode.slice(0, 4));
      points.push({ label: geoLabel[code] ?? code, id: code, value: v, year });
      if (year > maxYear) maxYear = year;
      break;
    }
  }

  if (points.length === 0) throw new Error("Eurostat yielded no country rows");
  points.sort((a, b) => b.value - a.value);
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "Eurostat",
    year: maxYear || undefined,
    points,
    additive: entry.additive,
  };
}

export const eurostat: SourceAdapter = {
  id: "eurostat",
  label: "Eurostat",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const dataset = entry.params.dataset;
    if (!dataset) throw new Error(`Catalog entry ${entry.id} missing dataset`);
    try {
      const base =
        "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
      const query = entry.params.query ? `&${entry.params.query}` : "";
      const url = `${base}/${dataset}?format=JSON&lang=EN${query}`;
      const json = await fetchJson<JsonStat>(url);
      return normalize(json, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
