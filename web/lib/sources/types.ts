// Shared shapes for the pluggable data-source layer. Every source adapter
// normalizes its raw API into these types so the chart + angle layers never
// need to know where the data came from.

export interface DataPoint {
  /** Entity label, e.g. a country or category name. */
  label: string;
  /** ISO code / stable id when available (used for maps, dedupe). */
  id?: string;
  /** Numeric value. */
  value: number;
  /** Year or period this value belongs to. */
  year?: number;
}

export interface Series {
  /** Human-readable indicator title, e.g. "CO₂ emissions per capita". */
  title: string;
  /** Unit label, e.g. "tonnes", "%", "US$". */
  unit?: string;
  /** Source attribution string shown in the footer. */
  source: string;
  /** Most recent year represented (for subtitle). */
  year?: number;
  /** The data rows. */
  points: DataPoint[];
  /** True when served from bundled fixtures because live fetch was unavailable. */
  fromFixture?: boolean;
}

export interface CatalogEntry {
  /** Stable slug used in the UI + API. */
  id: string;
  /** Display name. */
  title: string;
  /** One-line description of what it shows. */
  blurb: string;
  /** Broad topic used for grouping/filtering. */
  topic: Topic;
  /** Adapter that knows how to fetch this. */
  source: SourceId;
  /** Adapter-specific fetch config (e.g. World Bank indicator code). */
  params: Record<string, string>;
  /** Suggested default chart form. */
  defaultChart: "rankedBar" | "line";
  /** Suggested unit for display. */
  unit?: string;
}

export type Topic =
  | "Economy"
  | "Population"
  | "Environment"
  | "Technology"
  | "Health"
  | "Energy";

export type SourceId = "worldbank";

export interface SourceAdapter {
  id: SourceId;
  label: string;
  /** Live-fetch a catalog entry into a normalized Series. */
  fetch(entry: CatalogEntry): Promise<Series>;
}
