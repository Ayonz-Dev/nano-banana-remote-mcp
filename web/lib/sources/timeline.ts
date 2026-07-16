import type { CatalogEntry, Timeline, TimelineFrame } from "./types";
import { getTimelineFixture } from "./fixtures-timeline";
import { fetchJson, isRealCountryCode } from "./util";

// Timeline (bar-chart-race) fetching. World Bank returns every year for every
// country in one call, which is exactly what a race needs. We keep the entities
// that ever reach the top and build one frame per year.

const WB_BASE = "https://api.worldbank.org/v2";

interface WbRow {
  countryiso3code: string;
  country: { value: string };
  date: string;
  value: number | null;
}

// Fill annual gaps between authored/sparse frames by linear interpolation, so
// the year counter and motion are smooth even when source data is sparse.
export function interpolateFrames(frames: TimelineFrame[]): TimelineFrame[] {
  const sorted = [...frames].sort((a, b) => a.year - b.year);
  if (sorted.length < 2) return sorted;
  const out: TimelineFrame[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = b.year - a.year;
    for (let y = 0; y < gap; y++) {
      const t = y / gap;
      out.push({
        year: a.year + y,
        values: a.values.map((v, idx) => v + (b.values[idx] - v) * t),
      });
    }
  }
  out.push(sorted[sorted.length - 1]);
  return out;
}

function buildWorldBankTimeline(
  rows: WbRow[],
  entry: CatalogEntry,
  topN: number,
): Timeline {
  // Collect value[iso3][year] and the display label per country.
  const byCountry = new Map<string, { label: string; years: Map<number, number> }>();
  const years = new Set<number>();

  for (const row of rows) {
    const iso3 = row.countryiso3code;
    if (!isRealCountryCode(iso3)) continue;
    if (row.value == null || !Number.isFinite(row.value)) continue;
    const year = Number(row.date);
    years.add(year);
    let rec = byCountry.get(iso3);
    if (!rec) {
      rec = { label: row.country.value, years: new Map() };
      byCountry.set(iso3, rec);
    }
    rec.years.set(year, row.value);
  }

  const sortedYears = [...years].sort((a, b) => a - b);
  if (sortedYears.length === 0) throw new Error("World Bank timeline: no years");

  // Entities that ever reach the top-N in any year — the interesting racers.
  const everTop = new Set<string>();
  for (const year of sortedYears) {
    const ranked = [...byCountry.entries()]
      .filter(([, r]) => r.years.has(year))
      .sort((a, b) => (b[1].years.get(year) ?? 0) - (a[1].years.get(year) ?? 0))
      .slice(0, topN);
    for (const [iso3] of ranked) everTop.add(iso3);
  }

  const entities = [...everTop].map((iso3) => ({
    id: iso3,
    label: byCountry.get(iso3)!.label,
  }));

  // One frame per year; carry forward the last known value to avoid gaps.
  const lastVal = new Array(entities.length).fill(0);
  const frames: TimelineFrame[] = sortedYears.map((year) => {
    const values = entities.map((e, i) => {
      const v = byCountry.get(e.id!)!.years.get(year);
      if (v != null) lastVal[i] = v;
      return lastVal[i];
    });
    return { year, values };
  });

  return {
    title: entry.metric,
    unit: entry.unit,
    source: "World Bank Open Data",
    entities,
    frames,
    additive: entry.additive,
  };
}

export async function fetchTimeline(entry: CatalogEntry): Promise<Timeline> {
  const indicator = entry.params.indicator;
  const topN = Number(entry.params.raceTopN) || 12;
  try {
    if (entry.source !== "worldbank" || !indicator) {
      throw new Error("Timeline only supported for World Bank topics");
    }
    const params = new URLSearchParams({
      format: "json",
      date: "1970:2024",
      per_page: "20000",
    });
    const json = await fetchJson<[unknown, WbRow[] | null]>(
      `${WB_BASE}/country/all/indicator/${indicator}?${params.toString()}`,
    );
    const rows = json?.[1];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("World Bank returned no rows");
    }
    return buildWorldBankTimeline(rows, entry, topN);
  } catch (err) {
    const fixture = getTimelineFixture(entry.id);
    if (fixture) {
      return { ...fixture, frames: interpolateFrames(fixture.frames), fromFixture: true };
    }
    throw err;
  }
}
