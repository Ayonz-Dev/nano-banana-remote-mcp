import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson } from "./util";

// USGS serves earthquake events as GeoJSON, keyless. We rank the biggest recent
// quakes by magnitude. These are point events (not countries), so the map form
// doesn't apply — entityNoun marks them as "earthquakes".
//
// params:
//   minmagnitude – floor magnitude (default "6")
//   days         – look-back window in days (default "365")
//   limit        – max events (default "20")

interface UsgsFeature {
  id?: string;
  properties?: { mag?: number; place?: string; time?: number };
}
interface UsgsResponse {
  features?: UsgsFeature[];
}

function normalize(json: UsgsResponse, entry: CatalogEntry): Series {
  const feats = json.features ?? [];
  const points: DataPoint[] = [];
  let maxYear = 0;

  for (const f of feats) {
    const mag = f.properties?.mag;
    const place = f.properties?.place;
    if (mag == null || !Number.isFinite(mag) || !place) continue;
    const year = f.properties?.time
      ? new Date(f.properties.time).getUTCFullYear()
      : undefined;
    points.push({ label: place, id: f.id, value: mag, year });
    if (year && year > maxYear) maxYear = year;
  }

  if (points.length === 0) throw new Error("USGS returned no events");
  points.sort((a, b) => b.value - a.value);
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "USGS Earthquake Catalog",
    year: maxYear || undefined,
    points,
    additive: false,
    entityNoun: "earthquakes",
  };
}

export const usgs: SourceAdapter = {
  id: "usgs",
  label: "USGS Earthquake Catalog",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const minmag = entry.params.minmagnitude || "6";
    const days = Number(entry.params.days) || 365;
    const limit = entry.params.limit || "20";
    try {
      const start = new Date(Date.now() - days * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const url =
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
        `&minmagnitude=${minmag}&orderby=magnitude&limit=${limit}&starttime=${start}`;
      const json = await fetchJson<UsgsResponse>(url);
      return normalize(json, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
