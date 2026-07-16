import type { CatalogEntry, DataPoint, Series, SourceAdapter } from "./types";
import { getFixture } from "./fixtures";
import { fetchJson } from "./util";

// Wikidata's SPARQL endpoint turns the world's structured knowledge into
// rankings you won't find in the economic sources — heritage sites, Nobel
// laureates, tallest buildings, and much more. We run a curated query and read
// its bindings generically.
//
// params:
//   query    – a SPARQL query returning a label column and a numeric column
//   labelVar – binding name for the entity label (e.g. "countryLabel")
//   valueVar – binding name for the numeric value (e.g. "count")
//   idVar    – (optional) binding name for a stable id/URI

interface SparqlBinding {
  [key: string]: { value: string } | undefined;
}
interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

const ENDPOINT = "https://query.wikidata.org/sparql";
// Wikidata's usage policy requires a descriptive User-Agent.
const USER_AGENT = "DataForgeStudio/1.0 (public-data visualization)";

function normalize(json: SparqlResponse, entry: CatalogEntry): Series {
  const bindings = json.results?.bindings ?? [];
  const labelVar = entry.params.labelVar || "itemLabel";
  const valueVar = entry.params.valueVar || "count";
  const idVar = entry.params.idVar;

  const points: DataPoint[] = [];
  for (const b of bindings) {
    const label = b[labelVar]?.value;
    const raw = b[valueVar]?.value;
    if (!label || raw == null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    points.push({ label, id: idVar ? b[idVar]?.value : undefined, value });
  }

  if (points.length === 0) throw new Error("Wikidata returned no rows");
  points.sort((a, b) => b.value - a.value);
  return {
    title: entry.metric,
    unit: entry.unit,
    source: "Wikidata",
    points,
    additive: entry.additive,
    entityNoun: entry.params.entityNoun,
  };
}

export const wikidata: SourceAdapter = {
  id: "wikidata",
  label: "Wikidata",
  async fetch(entry: CatalogEntry): Promise<Series> {
    const query = entry.params.query;
    if (!query) throw new Error(`Catalog entry ${entry.id} missing query`);
    try {
      const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
      const json = await fetchJson<SparqlResponse>(
        url,
        "application/sparql-results+json",
        { "user-agent": USER_AGENT },
      );
      return normalize(json, entry);
    } catch (err) {
      const fixture = getFixture(entry.id);
      if (fixture) return { ...fixture, fromFixture: true };
      throw err;
    }
  },
};
