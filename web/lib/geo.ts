import countries from "i18n-iso-countries";
import type { DataPoint, Series } from "./sources/types";

// Server-safe geo helpers (no echarts). Resolve a data point to an ISO3 code so
// it can be matched against the world map, and decide whether a series is worth
// offering a map view at all.

// Eurostat and a few others use non-ISO 2-letter codes; normalize them.
const ALPHA2_FIXUPS: Record<string, string> = {
  EL: "GRC", // Greece
  UK: "GBR", // United Kingdom
};

export function resolveIso3(point: DataPoint): string | null {
  const raw = point.id?.trim().toUpperCase();
  if (!raw) return null;
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  if (/^[A-Z]{2}$/.test(raw)) {
    return ALPHA2_FIXUPS[raw] ?? countries.alpha2ToAlpha3(raw) ?? null;
  }
  return null;
}

// A series is mappable when it ranks countries (not buildings, not a trend) and
// enough of its rows resolve to ISO3 codes.
export function mappable(series: Series): boolean {
  if (series.temporal) return false;
  if ((series.entityNoun ?? "countries") !== "countries") return false;
  const resolved = series.points.filter((p) => resolveIso3(p)).length;
  return resolved >= 3 && resolved / series.points.length >= 0.5;
}

// Build {name, value} rows keyed by ISO3 for the map series, dropping any row
// that can't be geolocated.
export function toMapData(
  series: Series,
): Array<{ name: string; value: number; display: string }> {
  const out: Array<{ name: string; value: number; display: string }> = [];
  for (const p of series.points) {
    const iso3 = resolveIso3(p);
    if (!iso3) continue;
    out.push({ name: iso3, value: p.value, display: p.label });
  }
  return out;
}
