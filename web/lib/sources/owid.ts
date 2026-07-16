import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchText, isRealCountryCode, parseCsv } from "./util";

// Our World in Data exposes every grapher chart as a CSV at a stable URL. The
// full CSV has columns: Entity, Code, Year, <one or more value columns>.
// We take the latest year available per country and rank.
//
// params:
//   slug     – grapher slug, e.g. "annual-co2-emissions-per-country"
//   column   – (optional) value column short-name; defaults to the last column
//   scale    – (optional) divide raw values by this (e.g. 1e9 tonnes → Gt)
function buildUrl(slug: string): string {
  return `https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=true`;
}

function normalize(csv: string, entry: CatalogEntry): Series {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("OWID CSV had no data rows");

  const header = rows[0];
  const codeIdx = header.findIndex((h) => h.trim().toLowerCase() === "code");
  const yearIdx = header.findIndex((h) => h.trim().toLowerCase() === "year");
  const entityIdx = header.findIndex((h) => h.trim().toLowerCase() === "entity");
  const wanted = entry.params.column;
  const valueIdx = wanted
    ? header.indexOf(wanted)
    : header.length - 1; // last column is the metric when unspecified
  if (codeIdx < 0 || yearIdx < 0 || valueIdx < 0) {
    throw new Error("OWID CSV missing expected columns");
  }

  const scale = Number(entry.params.scale) || 1;
  const latest = new Map<string, DataPoint>();
  let maxYear = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const code = row[codeIdx];
    if (!isRealCountryCode(code)) continue;
    const value = Number(row[valueIdx]) / scale;
    if (!Number.isFinite(value)) continue;
    const year = Number(row[yearIdx]);
    const existing = latest.get(code);
    if (!existing || (existing.year ?? 0) < year) {
      latest.set(code, {
        label: entityIdx >= 0 ? row[entityIdx] : code,
        id: code,
        value,
        year,
      });
    }
    if (year > maxYear) maxYear = year;
  }

  const points = [...latest.values()].sort((a, b) => b.value - a.value);
  if (points.length === 0) throw new Error("OWID CSV yielded no country rows");
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "Our World in Data",
    year: maxYear || undefined,
    points,
    additive: entry.additive,
  };
}

export const owid: SourceAdapter = {
  id: "owid",
  label: "Our World in Data",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const slug = entry.params.slug;
    if (!slug) throw new Error(`Catalog entry ${entry.id} missing slug`);
    try {
      const csv = await fetchText(buildUrl(slug), "text/csv");
      return normalize(csv, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
