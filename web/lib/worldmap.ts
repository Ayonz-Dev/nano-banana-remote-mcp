import * as echarts from "echarts";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
// world-atlas ships Natural Earth boundaries as compact TopoJSON on npm, so the
// map is fully bundled — no runtime fetch, works offline.
import worldTopo from "world-atlas/countries-110m.json";

// echarts.registerMap is a global registration, so we only need to do it once
// per client session.
let registered = false;

// Convert the TopoJSON to GeoJSON and rename every feature to its ISO3 code so
// map regions match the ISO3-keyed data we pass in (exact, no fuzzy name maps).
export function ensureWorldMap(): void {
  if (registered) return;

  const topo = worldTopo as unknown as Topology<{
    countries: GeometryCollection<GeoJsonProperties>;
  }>;
  const geo = feature(topo, topo.objects.countries) as FeatureCollection<
    Geometry,
    GeoJsonProperties
  >;

  for (const f of geo.features) {
    const numeric = typeof f.id === "string" ? f.id : String(f.id ?? "");
    const iso3 = countries.numericToAlpha3(numeric);
    // Keep the human name available for tooltips; use ISO3 as the match key.
    const name = (f.properties?.name as string) ?? iso3 ?? numeric;
    f.properties = { ...(f.properties ?? {}), name: iso3 ?? name, display: name };
  }

  echarts.registerMap("world", geo as never);
  registered = true;
}
