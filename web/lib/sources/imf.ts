import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { countryName, fetchJson, isRealCountryCode } from "./util";

// The IMF DataMapper API is refreshingly simple JSON and needs no key:
//   https://www.imf.org/external/datamapper/api/v1/{indicator}
// returns:
//   { "values": { "<indicator>": { "USA": {"1980": x, …, "2029": y}, … } } }
// Country keys are ISO3; regional aggregates (WEOWORLD, ADVEC…) fail the
// real-country test and are dropped. We take the latest year with a value.
//
// params:
//   indicator – e.g. "NGDPDPC" (GDP per capita), "GGXWDG_NGDP" (govt debt %GDP)
//   scale     – (optional) divide raw values

interface ImfResponse {
  values?: Record<string, Record<string, Record<string, number | null>>>;
}

// IMF publishes some future years as projections. Cap at the current data year
// window; we simply take the highest year that actually carries a value.
function normalize(json: ImfResponse, entry: CatalogEntry): Series {
  const indicator = entry.params.indicator;
  const block =
    json.values?.[indicator] ?? Object.values(json.values ?? {})[0] ?? {};
  const scale = Number(entry.params.scale) || 1;

  const points: DataPoint[] = [];
  let maxYear = 0;

  for (const [code, byYear] of Object.entries(block)) {
    if (!isRealCountryCode(code)) continue;
    let bestYear = 0;
    let bestValue: number | null = null;
    for (const [y, v] of Object.entries(byYear)) {
      const year = Number(y);
      if (v == null || !Number.isFinite(v)) continue;
      if (year > bestYear) {
        bestYear = year;
        bestValue = v;
      }
    }
    if (bestValue == null) continue;
    points.push({
      label: countryName(code),
      id: code,
      value: bestValue / scale,
      year: bestYear,
    });
    if (bestYear > maxYear) maxYear = bestYear;
  }

  if (points.length === 0) throw new Error("IMF returned no country rows");
  points.sort((a, b) => b.value - a.value);
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "IMF (World Economic Outlook)",
    year: maxYear || undefined,
    points,
    additive: entry.additive,
  };
}

export const imf: SourceAdapter = {
  id: "imf",
  label: "IMF (World Economic Outlook)",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const indicator = entry.params.indicator;
    if (!indicator) throw new Error(`Catalog entry ${entry.id} missing indicator`);
    try {
      const json = await fetchJson<ImfResponse>(
        `https://www.imf.org/external/datamapper/api/v1/${indicator}`,
      );
      return normalize(json, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
