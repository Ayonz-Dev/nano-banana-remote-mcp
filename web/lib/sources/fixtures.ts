import type { Series } from "./types";

// Bundled snapshots used only when live fetch is unavailable (e.g. a sandbox
// with no outbound network). Values are approximate recent figures rounded for
// display; the UI labels any fixture-backed chart as a cached sample so nothing
// is passed off as live. Keyed by catalog entry id.

const M = 1_000_000;

const FIXTURES: Record<string, Series> = {
  "gdp-total": {
    title: "Gross domestic product (current US$)",
    unit: "US$",
    source: "World Bank Open Data",
    year: 2023,
    points: [
      { label: "United States", id: "USA", value: 27.36e12, year: 2023 },
      { label: "China", id: "CHN", value: 17.79e12, year: 2023 },
      { label: "Germany", id: "DEU", value: 4.46e12, year: 2023 },
      { label: "Japan", id: "JPN", value: 4.21e12, year: 2023 },
      { label: "India", id: "IND", value: 3.55e12, year: 2023 },
      { label: "United Kingdom", id: "GBR", value: 3.34e12, year: 2023 },
      { label: "France", id: "FRA", value: 3.03e12, year: 2023 },
      { label: "Italy", id: "ITA", value: 2.25e12, year: 2023 },
      { label: "Brazil", id: "BRA", value: 2.17e12, year: 2023 },
      { label: "Canada", id: "CAN", value: 2.14e12, year: 2023 },
      { label: "Russia", id: "RUS", value: 2.02e12, year: 2023 },
      { label: "Mexico", id: "MEX", value: 1.79e12, year: 2023 },
      { label: "Australia", id: "AUS", value: 1.72e12, year: 2023 },
      { label: "South Korea", id: "KOR", value: 1.71e12, year: 2023 },
      { label: "Spain", id: "ESP", value: 1.58e12, year: 2023 },
      { label: "Indonesia", id: "IDN", value: 1.37e12, year: 2023 },
      { label: "Netherlands", id: "NLD", value: 1.12e12, year: 2023 },
      { label: "Turkey", id: "TUR", value: 1.11e12, year: 2023 },
      { label: "Saudi Arabia", id: "SAU", value: 1.07e12, year: 2023 },
      { label: "Switzerland", id: "CHE", value: 0.88e12, year: 2023 },
    ],
  },

  "population-total": {
    title: "Population, total",
    unit: "people",
    source: "World Bank Open Data",
    year: 2023,
    points: [
      { label: "India", id: "IND", value: 1428.6 * M, year: 2023 },
      { label: "China", id: "CHN", value: 1410.7 * M, year: 2023 },
      { label: "United States", id: "USA", value: 334.9 * M, year: 2023 },
      { label: "Indonesia", id: "IDN", value: 277.5 * M, year: 2023 },
      { label: "Pakistan", id: "PAK", value: 240.5 * M, year: 2023 },
      { label: "Nigeria", id: "NGA", value: 223.8 * M, year: 2023 },
      { label: "Brazil", id: "BRA", value: 216.4 * M, year: 2023 },
      { label: "Bangladesh", id: "BGD", value: 172.9 * M, year: 2023 },
      { label: "Russia", id: "RUS", value: 143.8 * M, year: 2023 },
      { label: "Mexico", id: "MEX", value: 128.5 * M, year: 2023 },
      { label: "Ethiopia", id: "ETH", value: 126.5 * M, year: 2023 },
      { label: "Japan", id: "JPN", value: 124.5 * M, year: 2023 },
      { label: "Philippines", id: "PHL", value: 117.3 * M, year: 2023 },
      { label: "Egypt", id: "EGY", value: 112.7 * M, year: 2023 },
      { label: "DR Congo", id: "COD", value: 102.3 * M, year: 2023 },
      { label: "Vietnam", id: "VNM", value: 98.9 * M, year: 2023 },
      { label: "Iran", id: "IRN", value: 89.2 * M, year: 2023 },
      { label: "Turkey", id: "TUR", value: 85.3 * M, year: 2023 },
      { label: "Germany", id: "DEU", value: 84.5 * M, year: 2023 },
      { label: "Thailand", id: "THA", value: 71.8 * M, year: 2023 },
    ],
  },

  "co2-per-capita": {
    title: "CO₂ emissions (metric tons per capita)",
    unit: "t",
    source: "World Bank Open Data",
    year: 2022,
    points: [
      { label: "Qatar", id: "QAT", value: 35.6, year: 2022 },
      { label: "Bahrain", id: "BHR", value: 26.7, year: 2022 },
      { label: "Kuwait", id: "KWT", value: 25.0, year: 2022 },
      { label: "Brunei", id: "BRN", value: 23.2, year: 2022 },
      { label: "Trinidad & Tobago", id: "TTO", value: 22.4, year: 2022 },
      { label: "United Arab Emirates", id: "ARE", value: 21.8, year: 2022 },
      { label: "Saudi Arabia", id: "SAU", value: 18.7, year: 2022 },
      { label: "Oman", id: "OMN", value: 17.5, year: 2022 },
      { label: "Australia", id: "AUS", value: 15.0, year: 2022 },
      { label: "United States", id: "USA", value: 14.9, year: 2022 },
      { label: "Canada", id: "CAN", value: 14.2, year: 2022 },
      { label: "Kazakhstan", id: "KAZ", value: 13.0, year: 2022 },
      { label: "Luxembourg", id: "LUX", value: 12.9, year: 2022 },
      { label: "South Korea", id: "KOR", value: 11.9, year: 2022 },
      { label: "Russia", id: "RUS", value: 11.4, year: 2022 },
      { label: "Germany", id: "DEU", value: 8.1, year: 2022 },
      { label: "China", id: "CHN", value: 8.0, year: 2022 },
      { label: "Japan", id: "JPN", value: 8.5, year: 2022 },
      { label: "United Kingdom", id: "GBR", value: 5.0, year: 2022 },
      { label: "India", id: "IND", value: 2.0, year: 2022 },
    ],
  },

  "life-expectancy": {
    title: "Life expectancy at birth (years)",
    unit: "years",
    source: "World Bank Open Data",
    year: 2022,
    points: [
      { label: "Japan", id: "JPN", value: 84.0, year: 2022 },
      { label: "Switzerland", id: "CHE", value: 84.0, year: 2022 },
      { label: "Singapore", id: "SGP", value: 83.7, year: 2022 },
      { label: "South Korea", id: "KOR", value: 83.5, year: 2022 },
      { label: "Australia", id: "AUS", value: 83.3, year: 2022 },
      { label: "Spain", id: "ESP", value: 83.2, year: 2022 },
      { label: "Norway", id: "NOR", value: 83.2, year: 2022 },
      { label: "Iceland", id: "ISL", value: 83.0, year: 2022 },
      { label: "Italy", id: "ITA", value: 83.0, year: 2022 },
      { label: "Sweden", id: "SWE", value: 83.0, year: 2022 },
      { label: "France", id: "FRA", value: 82.5, year: 2022 },
      { label: "Canada", id: "CAN", value: 82.0, year: 2022 },
      { label: "New Zealand", id: "NZL", value: 82.0, year: 2022 },
      { label: "Netherlands", id: "NLD", value: 81.7, year: 2022 },
      { label: "United Kingdom", id: "GBR", value: 80.7, year: 2022 },
      { label: "Germany", id: "DEU", value: 80.6, year: 2022 },
      { label: "United States", id: "USA", value: 77.4, year: 2022 },
      { label: "China", id: "CHN", value: 78.2, year: 2022 },
      { label: "Brazil", id: "BRA", value: 72.8, year: 2022 },
      { label: "India", id: "IND", value: 67.7, year: 2022 },
    ],
  },

  // A time-series fixture for the line-chart form: world GDP over two decades.
  "world-gdp-trend": {
    title: "World GDP (current US$)",
    unit: "US$",
    source: "World Bank Open Data",
    year: 2023,
    points: [
      { label: "2000", value: 33.8e12, year: 2000 },
      { label: "2004", value: 43.8e12, year: 2004 },
      { label: "2008", value: 63.6e12, year: 2008 },
      { label: "2012", value: 75.1e12, year: 2012 },
      { label: "2016", value: 76.3e12, year: 2016 },
      { label: "2020", value: 85.0e12, year: 2020 },
      { label: "2021", value: 97.0e12, year: 2021 },
      { label: "2022", value: 101.0e12, year: 2022 },
      { label: "2023", value: 105.4e12, year: 2023 },
    ],
  },
};

export function getFixture(id: string): Series | undefined {
  const f = FIXTURES[id];
  if (!f) return undefined;
  // Return a deep-ish copy so callers can annotate without mutating the source.
  return { ...f, points: f.points.map((p) => ({ ...p })) };
}
