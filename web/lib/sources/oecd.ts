import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson, isRealCountryCode } from "./util";

// OECD's Data Explorer serves SDMX-JSON. The shape:
//   data.structures[0].dimensions.series[]      – the keyed dimensions
//   data.structures[0].dimensions.observation[] – usually TIME_PERIOD
//   data.dataSets[0].series["i:j:k"].observations["t"] = [value, ...]
// Each series key is a colon-joined list of indices into the series dimensions'
// `values` arrays. We locate the reference-area (country) dimension, then for
// each series take the most recent observation and rank across countries.
//
// params:
//   url – a full SDMX-JSON query URL from the OECD Data Explorer. Because OECD
//         dataflow IDs are long and version-specific, keep the exact query in
//         the catalog and validate it against data-explorer.oecd.org.
//   scale – (optional) divide raw values.

interface SdmxValue {
  id: string;
  name?: string;
}
interface SdmxDim {
  id: string;
  name?: string;
  values: SdmxValue[];
}
interface SdmxSeries {
  observations: Record<string, Array<number | null>>;
}
interface SdmxJson {
  data?: {
    structures?: Array<{
      dimensions?: { series?: SdmxDim[]; observation?: SdmxDim[] };
    }>;
    dataSets?: Array<{ series?: Record<string, SdmxSeries> }>;
  };
}

const AREA_DIM = /(ref[_ ]?area|country|location|nation)/i;

function findAreaDimIndex(dims: SdmxDim[]): number {
  const byId = dims.findIndex((d) => AREA_DIM.test(d.id));
  if (byId >= 0) return byId;
  return dims.findIndex((d) => AREA_DIM.test(d.name ?? ""));
}

function normalize(json: SdmxJson, entry: CatalogEntry): Series {
  const structure = json.data?.structures?.[0];
  const seriesDims = structure?.dimensions?.series ?? [];
  const obsDim = structure?.dimensions?.observation?.[0];
  const dataSeries = json.data?.dataSets?.[0]?.series ?? {};
  if (seriesDims.length === 0 || !obsDim) {
    throw new Error("OECD SDMX-JSON missing dimensions");
  }

  const areaPos = findAreaDimIndex(seriesDims);
  if (areaPos < 0) throw new Error("OECD SDMX-JSON has no reference-area dimension");
  const areaValues = seriesDims[areaPos].values;
  const periods = obsDim.values;
  const scale = Number(entry.params.scale) || 1;

  const latest = new Map<string, DataPoint>();
  let maxYear = 0;

  for (const [key, series] of Object.entries(dataSeries)) {
    const idx = key.split(":").map((n) => Number(n));
    const area = areaValues[idx[areaPos]];
    if (!area) continue;
    if (!isRealCountryCode(area.id)) continue;

    // Most recent observation for this series = highest period index present.
    let bestObs = -1;
    for (const t of Object.keys(series.observations)) {
      const ti = Number(t);
      if (ti > bestObs) bestObs = ti;
    }
    if (bestObs < 0) continue;
    const raw = series.observations[String(bestObs)]?.[0];
    if (raw == null || !Number.isFinite(raw)) continue;

    const year = Number(periods[bestObs]?.id) || 0;
    latest.set(area.id, {
      label: area.name ?? area.id,
      id: area.id,
      value: raw / scale,
      year,
    });
    if (year > maxYear) maxYear = year;
  }

  const points = [...latest.values()].sort((a, b) => b.value - a.value);
  if (points.length === 0) throw new Error("OECD SDMX-JSON yielded no country rows");
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "OECD",
    year: maxYear || undefined,
    points,
    additive: entry.additive,
  };
}

export const oecd: SourceAdapter = {
  id: "oecd",
  label: "OECD",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const url = entry.params.url;
    if (!url) throw new Error(`Catalog entry ${entry.id} missing url`);
    try {
      // Ask for SDMX-JSON explicitly.
      const withFormat = url.includes("format=")
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}format=jsondata`;
      const json = await fetchJson<SdmxJson>(
        withFormat,
        "application/vnd.sdmx.data+json,application/json",
      );
      return normalize(json, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
