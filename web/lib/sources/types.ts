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
  /**
   * Whether the metric is additive/extensive (money, people, counts) — i.e.
   * summing rows into a total is meaningful. Intensive metrics (rates, %,
   * per-capita, life expectancy) are not additive. Drives which story angles
   * apply. When omitted, the angle layer infers it from the unit.
   */
  additive?: boolean;
  /**
   * True when the series is one entity measured over time (a trend), rather
   * than many entities compared at one moment. Drives time-based story angles
   * and line rendering instead of country rankings.
   */
  temporal?: boolean;
  /**
   * Plural noun for the ranked entities, used in headlines. Defaults to
   * "countries"; set e.g. "buildings" or "cities" when a source ranks something
   * other than countries.
   */
  entityNoun?: string;
  /** True when served from bundled fixtures because live fetch was unavailable. */
  fromFixture?: boolean;
}

// ── Timeline (bar-chart-race) shape ────────────────────────────────────────
// A ranking that changes over time: a fixed set of entities, each with a value
// per year. Frames are annual and aligned to the `entities` order.

export interface TimelineEntity {
  label: string;
  id?: string;
}

export interface TimelineFrame {
  year: number;
  /** Values aligned to the Timeline.entities array (one per entity). */
  values: number[];
}

export interface Timeline {
  title: string;
  unit?: string;
  source: string;
  entities: TimelineEntity[];
  frames: TimelineFrame[];
  additive?: boolean;
  entityNoun?: string;
  fromFixture?: boolean;
}

export interface CatalogEntry {
  /** Stable slug used in the UI + API. */
  id: string;
  /** Marketing card title shown in the topic picker, e.g. "Biggest economies". */
  title: string;
  /** The real metric name used on the chart, e.g. "GDP (current US$)". */
  metric: string;
  /** One-line description of what it shows. */
  blurb: string;
  /** Broad topic used for grouping/filtering. */
  topic: Topic;
  /** Adapter that knows how to fetch this. */
  source: SourceId;
  /** Adapter-specific fetch config (e.g. World Bank indicator code). */
  params: Record<string, string>;
  /** Suggested default chart form. "race" topics use the timeline endpoint. */
  defaultChart: "rankedBar" | "line" | "race";
  /** Suggested unit for display. */
  unit?: string;
  /** Whether the metric is additive (see Series.additive). */
  additive?: boolean;
}

export type Topic =
  | "Economy"
  | "Population"
  | "Environment"
  | "Technology"
  | "Health"
  | "Energy"
  | "Geography"
  | "Society"
  | "Culture";

export type SourceId =
  | "worldbank"
  | "owid"
  | "oecd"
  | "fred"
  | "imf"
  | "restcountries"
  | "eurostat"
  | "wikidata"
  | "usgs";

export interface SourceAdapter {
  id: SourceId;
  label: string;
  /** Live-fetch a catalog entry into a normalized Series. */
  fetch(entry: CatalogEntry): Promise<Series>;
}
