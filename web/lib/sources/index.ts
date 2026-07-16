import type { CatalogEntry, Series, SourceAdapter, SourceId } from "./types";
import { worldBank } from "./worldbank";
import { owid } from "./owid";
import { oecd } from "./oecd";
import { fred } from "./fred";
import { imf } from "./imf";
import { restCountries } from "./restcountries";
import { eurostat } from "./eurostat";
import { wikidata } from "./wikidata";
import { usgs } from "./usgs";

// Registry of source adapters. Add a new adapter here and reference it from
// catalog entries by id.
const ADAPTERS: Record<SourceId, SourceAdapter> = {
  worldbank: worldBank,
  owid,
  oecd,
  fred,
  imf,
  restcountries: restCountries,
  eurostat,
  wikidata,
  usgs,
};

// The curated catalog — the "topics" a user browses. Each entry maps a
// human-friendly card to a concrete, fetchable indicator. Kept hand-picked so
// every option makes a genuinely interesting chart.
export const CATALOG: CatalogEntry[] = [
  // ── World Bank ──────────────────────────────────────────────────────────
  {
    id: "gdp-total",
    title: "Biggest economies",
    metric: "GDP (current US$)",
    blurb: "Total GDP by country — who really runs the global economy.",
    topic: "Economy",
    source: "worldbank",
    params: { indicator: "NY.GDP.MKTP.CD" },
    defaultChart: "rankedBar",
    unit: "US$",
    additive: true,
  },
  {
    id: "population-total",
    title: "Most populous countries",
    metric: "Population, total",
    blurb: "Where the world's 8 billion people actually live.",
    topic: "Population",
    source: "worldbank",
    params: { indicator: "SP.POP.TOTL" },
    defaultChart: "rankedBar",
    unit: "people",
    additive: true,
  },
  {
    id: "co2-per-capita",
    title: "Biggest carbon footprints",
    metric: "CO₂ emissions (t per capita)",
    blurb: "CO₂ emissions per person — the ranking that surprises people.",
    topic: "Environment",
    source: "worldbank",
    params: { indicator: "EN.ATM.CO2E.PC" },
    defaultChart: "rankedBar",
    unit: "t",
    additive: false,
  },
  {
    id: "life-expectancy",
    title: "Where people live longest",
    metric: "Life expectancy at birth",
    blurb: "Life expectancy at birth, by country.",
    topic: "Health",
    source: "worldbank",
    params: { indicator: "SP.DYN.LE00.IN" },
    defaultChart: "rankedBar",
    unit: "years",
    additive: false,
  },
  {
    id: "world-gdp-trend",
    title: "The world economy over time",
    metric: "World GDP (current US$)",
    blurb: "Global GDP since 2000 — the long climb.",
    topic: "Economy",
    source: "worldbank",
    // World aggregate handled as a time series; indicator kept for live upgrade.
    params: { indicator: "NY.GDP.MKTP.CD", scope: "world-trend" },
    defaultChart: "line",
    unit: "US$",
    additive: false,
  },

  // ── Our World in Data ───────────────────────────────────────────────────
  {
    id: "owid-co2-total",
    title: "The world's biggest emitters",
    metric: "Annual CO₂ emissions",
    blurb: "Total CO₂ emitted per country — who actually moves the needle.",
    topic: "Environment",
    source: "owid",
    // Raw CSV is in tonnes; scale to gigatonnes for a readable axis.
    params: { slug: "annual-co2-emissions-per-country", scale: "1000000000" },
    defaultChart: "rankedBar",
    unit: "Gt CO₂",
    additive: true,
  },
  {
    id: "owid-wind-solar-share",
    title: "Powered by wind & sun",
    metric: "Share of electricity from wind & solar",
    blurb: "How much of each country's power comes from wind and solar.",
    topic: "Energy",
    source: "owid",
    params: { slug: "share-electricity-wind-solar" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },

  // ── OECD ────────────────────────────────────────────────────────────────
  // NOTE: OECD dataflow query URLs are long and version-specific. These are
  // best-effort SDMX-JSON queries — validate/adjust them against the OECD Data
  // Explorer (data-explorer.oecd.org). Until then, the studio serves the
  // bundled sample for these entries.
  {
    id: "oecd-unemployment",
    title: "Where jobs are scarce",
    metric: "Unemployment rate",
    blurb: "Harmonised unemployment rate across OECD economies.",
    topic: "Economy",
    source: "oecd",
    params: {
      url: "https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/..._Z.Y._T.Y_GE15..M?startPeriod=2023",
    },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },
  {
    id: "oecd-rnd",
    title: "Who bets on R&D",
    metric: "R&D spending (% of GDP)",
    blurb: "Gross domestic spending on research & development.",
    topic: "Technology",
    source: "oecd",
    params: {
      url: "https://sdmx.oecd.org/public/rest/data/OECD.STI.STP,DSD_MSTI@DF_MSTI,1.0/.G_XGDP.......?startPeriod=2020",
    },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },

  // ── FRED (US economic time series) ──────────────────────────────────────
  // Requires FRED_API_KEY (free). Without it, the bundled sample is served.
  {
    id: "fred-inflation",
    title: "US inflation, decoded",
    metric: "US inflation rate (CPI, YoY)",
    blurb: "Year-over-year change in US consumer prices since 2000.",
    topic: "Economy",
    source: "fred",
    // pc1 = percent change from a year ago → turns the CPI index into inflation.
    params: { series_id: "CPIAUCSL", units: "pc1" },
    defaultChart: "line",
    unit: "%",
    additive: false,
  },
  {
    id: "fred-unemployment",
    title: "US unemployment over time",
    metric: "US unemployment rate",
    blurb: "The US civilian unemployment rate, year by year.",
    topic: "Economy",
    source: "fred",
    params: { series_id: "UNRATE" },
    defaultChart: "line",
    unit: "%",
    additive: false,
  },
  {
    id: "fred-fedfunds",
    title: "US interest rates",
    metric: "US federal funds rate",
    blurb: "The Fed's benchmark rate through the cycles.",
    topic: "Economy",
    source: "fred",
    params: { series_id: "FEDFUNDS" },
    defaultChart: "line",
    unit: "%",
    additive: false,
  },
  {
    id: "fred-sp500",
    title: "The S&P 500 over time",
    metric: "S&P 500 index",
    blurb: "The headline US stock index, year by year.",
    topic: "Economy",
    source: "fred",
    params: { series_id: "SP500" },
    defaultChart: "line",
    additive: false,
  },

  // ── World Bank (more topics) ────────────────────────────────────────────
  {
    id: "wb-military",
    title: "Biggest military budgets",
    metric: "Military expenditure (current US$)",
    blurb: "Total defence spending by country — where the money goes.",
    topic: "Society",
    source: "worldbank",
    params: { indicator: "MS.MIL.XPND.CD" },
    defaultChart: "rankedBar",
    unit: "US$",
    additive: true,
  },
  {
    id: "wb-health-pc",
    title: "Who spends most on health",
    metric: "Health spending per person (current US$)",
    blurb: "Health expenditure per capita — the rich-world gap.",
    topic: "Health",
    source: "worldbank",
    params: { indicator: "SH.XPD.CHEX.PC.CD" },
    defaultChart: "rankedBar",
    unit: "US$",
    additive: false,
  },

  // ── IMF (World Economic Outlook) ────────────────────────────────────────
  {
    id: "imf-gdp-per-capita",
    title: "Richest countries per person",
    metric: "GDP per capita (current US$)",
    blurb: "Output per person — a truer read on wealth than total GDP.",
    topic: "Economy",
    source: "imf",
    params: { indicator: "NGDPDPC" },
    defaultChart: "rankedBar",
    unit: "US$",
    additive: false,
  },
  {
    id: "imf-govt-debt",
    title: "Most indebted governments",
    metric: "Government debt (% of GDP)",
    blurb: "Gross public debt relative to the size of the economy.",
    topic: "Economy",
    source: "imf",
    params: { indicator: "GGXWDG_NGDP" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },

  // ── REST Countries (geography & demographics) ───────────────────────────
  {
    id: "rc-area",
    title: "Biggest countries by land",
    metric: "Land area",
    blurb: "The largest countries on Earth by area.",
    topic: "Geography",
    source: "restcountries",
    params: { metric: "area" },
    defaultChart: "rankedBar",
    unit: "km²",
    additive: true,
  },
  {
    id: "rc-density",
    title: "Most crowded countries",
    metric: "Population density",
    blurb: "People per square kilometre — where it's tightest.",
    topic: "Population",
    source: "restcountries",
    params: { metric: "density" },
    defaultChart: "rankedBar",
    unit: "people/km²",
    additive: false,
  },
  {
    id: "rc-borders",
    title: "Most neighbours",
    metric: "Number of bordering countries",
    blurb: "Which countries touch the most others.",
    topic: "Geography",
    source: "restcountries",
    params: { metric: "borders" },
    defaultChart: "rankedBar",
    unit: "neighbours",
    additive: false,
  },

  // ── Eurostat (EU-specific) ──────────────────────────────────────────────
  // NOTE: Eurostat dataset codes + query filters are specific; validate against
  // ec.europa.eu/eurostat/web/main/data/database. Until then the bundled sample
  // is served.
  {
    id: "eu-min-wage",
    title: "EU minimum wages",
    metric: "Statutory minimum wage",
    blurb: "Monthly minimum wage across EU member states.",
    topic: "Society",
    source: "eurostat",
    params: { dataset: "earn_mw_cur", query: "currency=EUR" },
    defaultChart: "rankedBar",
    unit: "€/mo",
    additive: false,
  },
  {
    id: "eu-elec-price",
    title: "Europe's power prices",
    metric: "Household electricity price",
    blurb: "What households pay per kWh across Europe.",
    topic: "Energy",
    source: "eurostat",
    params: { dataset: "nrg_pc_204", query: "unit=KWH&product=6000" },
    defaultChart: "rankedBar",
    unit: "€/kWh",
    additive: false,
  },

  // ── REST Countries (more metrics) ───────────────────────────────────────
  {
    id: "rc-timezones",
    title: "Spanning the most time zones",
    metric: "Number of time zones",
    blurb: "Countries whose territory stretches across the most clocks.",
    topic: "Geography",
    source: "restcountries",
    params: { metric: "timezones" },
    defaultChart: "rankedBar",
    unit: "time zones",
    additive: false,
  },
  {
    id: "rc-languages",
    title: "Most official languages",
    metric: "Official languages",
    blurb: "Where the most languages share official status.",
    topic: "Society",
    source: "restcountries",
    params: { metric: "languages" },
    defaultChart: "rankedBar",
    unit: "languages",
    additive: false,
  },

  // ── Wikidata (cultural rankings) ────────────────────────────────────────
  // NOTE: SPARQL queries are best-effort; validate at query.wikidata.org.
  {
    id: "wd-heritage",
    title: "Most World Heritage sites",
    metric: "UNESCO World Heritage sites",
    blurb: "Which countries hold the most UNESCO-listed treasures.",
    topic: "Culture",
    source: "wikidata",
    params: {
      labelVar: "countryLabel",
      valueVar: "count",
      query:
        'SELECT ?countryLabel (COUNT(?s) AS ?count) WHERE { ?s wdt:P1435 wd:Q9259 . ?s wdt:P17 ?country . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?countryLabel ORDER BY DESC(?count) LIMIT 25',
    },
    defaultChart: "rankedBar",
    unit: "sites",
    additive: true,
  },
  {
    id: "wd-nobel",
    title: "Most Nobel laureates",
    metric: "Nobel laureates by country",
    blurb: "Nobel Prize winners by country of citizenship.",
    topic: "Culture",
    source: "wikidata",
    params: {
      labelVar: "countryLabel",
      valueVar: "count",
      query:
        'SELECT ?countryLabel (COUNT(DISTINCT ?p) AS ?count) WHERE { ?p wdt:P166 ?a . ?a wdt:P31 wd:Q7191 . ?p wdt:P27 ?country . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?countryLabel ORDER BY DESC(?count) LIMIT 25',
    },
    defaultChart: "rankedBar",
    unit: "laureates",
    additive: true,
  },
  {
    id: "wd-buildings",
    title: "The world's tallest buildings",
    metric: "Building height",
    blurb: "The tallest completed skyscrapers on the planet.",
    topic: "Society",
    source: "wikidata",
    params: {
      labelVar: "itemLabel",
      valueVar: "height",
      entityNoun: "buildings",
      query:
        'SELECT ?itemLabel ?height WHERE { ?item wdt:P31/wdt:P279* wd:Q11303 . ?item wdt:P2048 ?height . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?height) LIMIT 20',
    },
    defaultChart: "rankedBar",
    unit: "m",
    additive: false,
  },

  // ── Our World in Data (more topics) ─────────────────────────────────────
  {
    id: "owid-meat",
    title: "Who eats the most meat",
    metric: "Meat supply per person",
    blurb: "Kilograms of meat per person per year.",
    topic: "Society",
    source: "owid",
    params: { slug: "meat-supply-per-person" },
    defaultChart: "rankedBar",
    unit: "kg/person/yr",
    additive: false,
  },
  {
    id: "owid-happiness",
    title: "The happiest countries",
    metric: "Self-reported life satisfaction",
    blurb: "Average happiness on the 0–10 Cantril ladder.",
    topic: "Society",
    source: "owid",
    params: { slug: "happiness-cantril-landings" },
    defaultChart: "rankedBar",
    unit: "score /10",
    additive: false,
  },
  {
    id: "owid-obesity",
    title: "Where obesity is highest",
    metric: "Adult obesity rate",
    blurb: "Share of adults classified as obese.",
    topic: "Health",
    source: "owid",
    params: { slug: "share-of-adults-defined-as-obese" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },

  // ── World Bank (more topics) ────────────────────────────────────────────
  {
    id: "wb-internet",
    title: "Who's online",
    metric: "Individuals using the internet (%)",
    blurb: "Share of the population using the internet.",
    topic: "Technology",
    source: "worldbank",
    params: { indicator: "IT.NET.USER.ZS" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },
  {
    id: "wb-forest",
    title: "The most forested countries",
    metric: "Forest area (% of land)",
    blurb: "Share of land covered by forest.",
    topic: "Environment",
    source: "worldbank",
    params: { indicator: "AG.LND.FRST.ZS" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },
  {
    id: "wb-urban",
    title: "The most urban countries",
    metric: "Urban population (%)",
    blurb: "Share of people living in cities and towns.",
    topic: "Population",
    source: "worldbank",
    params: { indicator: "SP.URB.TOTL.IN.ZS" },
    defaultChart: "rankedBar",
    unit: "%",
    additive: false,
  },
  {
    id: "wb-tourism",
    title: "The most visited countries",
    metric: "International tourist arrivals",
    blurb: "Where the world's travellers actually go.",
    topic: "Economy",
    source: "worldbank",
    params: { indicator: "ST.INT.ARVL" },
    defaultChart: "rankedBar",
    unit: "visitors",
    additive: true,
  },
  {
    id: "wb-mobile",
    title: "Phones outnumber people",
    metric: "Mobile subscriptions (per 100 people)",
    blurb: "Mobile subscriptions per 100 people — many top 100.",
    topic: "Technology",
    source: "worldbank",
    params: { indicator: "IT.CEL.SETS.P2" },
    defaultChart: "rankedBar",
    unit: "per 100",
    additive: false,
  },

  // ── Our World in Data (more) ────────────────────────────────────────────
  {
    id: "owid-alcohol",
    title: "Who drinks the most",
    metric: "Alcohol consumption per person",
    blurb: "Litres of pure alcohol per adult per year.",
    topic: "Society",
    source: "owid",
    params: { slug: "total-alcohol-consumption-per-capita-litres-of-pure-alcohol" },
    defaultChart: "rankedBar",
    unit: "L/yr",
    additive: false,
  },

  // ── REST Countries (inequality) ─────────────────────────────────────────
  {
    id: "rc-gini",
    title: "The most unequal countries",
    metric: "Income inequality (Gini)",
    blurb: "Gini index of income inequality — higher means more unequal.",
    topic: "Society",
    source: "restcountries",
    params: { metric: "gini" },
    defaultChart: "rankedBar",
    unit: "Gini",
    additive: false,
  },

  // ── Wikidata (non-country rankings) ─────────────────────────────────────
  {
    id: "wd-cities",
    title: "The world's biggest cities",
    metric: "City population (metro area)",
    blurb: "The most populous urban areas on Earth.",
    topic: "Population",
    source: "wikidata",
    params: {
      labelVar: "cityLabel",
      valueVar: "pop",
      entityNoun: "cities",
      query:
        'SELECT ?cityLabel ?pop WHERE { ?city wdt:P31/wdt:P279* wd:Q515 . ?city wdt:P1082 ?pop . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?pop) LIMIT 20',
    },
    defaultChart: "rankedBar",
    unit: "people",
    additive: false,
  },
  {
    id: "wd-rivers",
    title: "The world's longest rivers",
    metric: "River length",
    blurb: "The longest rivers on the planet.",
    topic: "Geography",
    source: "wikidata",
    params: {
      labelVar: "riverLabel",
      valueVar: "len",
      entityNoun: "rivers",
      query:
        'SELECT ?riverLabel ?len WHERE { ?river wdt:P31/wdt:P279* wd:Q4022 . ?river wdt:P2043 ?len . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?len) LIMIT 20',
    },
    defaultChart: "rankedBar",
    unit: "km",
    additive: false,
  },

  // ── USGS (earthquakes) ──────────────────────────────────────────────────
  {
    id: "usgs-quakes",
    title: "Biggest recent earthquakes",
    metric: "Earthquake magnitude",
    blurb: "The strongest quakes recorded in the past year.",
    topic: "Environment",
    source: "usgs",
    params: { minmagnitude: "6", days: "365", limit: "20" },
    defaultChart: "rankedBar",
    unit: "M",
    additive: false,
  },

  // ── Bar-chart races (rankings over time) ────────────────────────────────
  {
    id: "race-gdp",
    title: "Top economies over time 🏁",
    metric: "GDP (current US$)",
    blurb: "Watch China climb the GDP rankings from 1990 to today.",
    topic: "Economy",
    source: "worldbank",
    params: { indicator: "NY.GDP.MKTP.CD", raceTopN: "12" },
    defaultChart: "race",
    unit: "US$",
    additive: true,
  },
  {
    id: "race-population",
    title: "Most populous over time 🏁",
    metric: "Population, total",
    blurb: "India overtakes China — the population race since 1990.",
    topic: "Population",
    source: "worldbank",
    params: { indicator: "SP.POP.TOTL", raceTopN: "12" },
    defaultChart: "race",
    unit: "people",
    additive: true,
  },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}

export async function fetchSeries(entry: CatalogEntry): Promise<Series> {
  const adapter = ADAPTERS[entry.source];
  if (!adapter) throw new Error(`No adapter registered for source ${entry.source}`);
  return adapter.fetch(entry);
}

export type { CatalogEntry, Series } from "./types";
