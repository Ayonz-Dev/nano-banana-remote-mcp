import type { Timeline } from "./types";

// Bundled timeline (bar-chart-race) snapshots for offline/dev. Values are
// approximate historical figures at 5-year marks; the loader interpolates them
// to annual frames. The UI flags fixture-backed charts as samples.

const T = 1e12; // trillions (USD)
const Mp = 1e6; // millions (people)
const YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];

// Build frames from a per-entity array of values-at-YEARS.
function frames(rowsByYearIndex: number[][]) {
  return YEARS.map((year, yi) => ({
    year,
    values: rowsByYearIndex.map((row) => row[yi]),
  }));
}

const TIMELINES: Record<string, Timeline> = {
  "race-gdp": {
    title: "GDP (current US$)",
    unit: "US$",
    source: "World Bank Open Data",
    additive: true,
    entities: [
      { label: "United States", id: "USA" },
      { label: "China", id: "CHN" },
      { label: "Japan", id: "JPN" },
      { label: "Germany", id: "DEU" },
      { label: "United Kingdom", id: "GBR" },
      { label: "France", id: "FRA" },
      { label: "India", id: "IND" },
      { label: "Italy", id: "ITA" },
      { label: "Brazil", id: "BRA" },
      { label: "Canada", id: "CAN" },
      { label: "Russia", id: "RUS" },
      { label: "South Korea", id: "KOR" },
    ],
    frames: frames([
      // 1990  1995   2000   2005   2010   2015   2020   2024   (US$ trillions)
      [5.96, 7.64, 10.25, 13.04, 15.05, 18.21, 21.06, 27.36].map((v) => v * T),
      [0.36, 0.73, 1.21, 2.29, 6.09, 11.06, 14.69, 17.79].map((v) => v * T),
      [3.13, 5.45, 4.97, 4.83, 5.76, 4.44, 5.06, 4.21].map((v) => v * T),
      [1.6, 2.59, 1.95, 2.85, 3.4, 3.36, 3.89, 4.46].map((v) => v * T),
      [1.09, 1.34, 1.66, 2.54, 2.49, 2.93, 2.7, 3.34].map((v) => v * T),
      [1.27, 1.61, 1.36, 2.2, 2.65, 2.44, 2.63, 3.03].map((v) => v * T),
      [0.32, 0.36, 0.47, 0.82, 1.68, 2.1, 2.67, 3.55].map((v) => v * T),
      [1.18, 1.17, 1.14, 1.86, 2.13, 1.83, 1.89, 2.25].map((v) => v * T),
      [0.46, 0.77, 0.65, 0.89, 2.21, 1.8, 1.48, 2.17].map((v) => v * T),
      [0.59, 0.6, 0.74, 1.17, 1.62, 1.56, 1.65, 2.14].map((v) => v * T),
      [0.57, 0.4, 0.26, 0.76, 1.52, 1.36, 1.49, 2.02].map((v) => v * T),
      [0.28, 0.56, 0.58, 0.93, 1.14, 1.47, 1.64, 1.71].map((v) => v * T),
    ]),
  },

  "race-population": {
    title: "Population, total",
    unit: "people",
    source: "World Bank Open Data",
    additive: true,
    entities: [
      { label: "China", id: "CHN" },
      { label: "India", id: "IND" },
      { label: "United States", id: "USA" },
      { label: "Indonesia", id: "IDN" },
      { label: "Pakistan", id: "PAK" },
      { label: "Brazil", id: "BRA" },
      { label: "Nigeria", id: "NGA" },
      { label: "Bangladesh", id: "BGD" },
      { label: "Russia", id: "RUS" },
      { label: "Japan", id: "JPN" },
      { label: "Mexico", id: "MEX" },
      { label: "Ethiopia", id: "ETH" },
    ],
    frames: frames([
      // 1990 1995 2000 2005 2010 2015 2020 2024  (millions)
      [1176, 1240, 1290, 1330, 1368, 1397, 1411, 1410].map((v) => v * Mp),
      [870, 964, 1059, 1147, 1234, 1310, 1396, 1441].map((v) => v * Mp),
      [250, 266, 282, 296, 309, 321, 335, 341].map((v) => v * Mp),
      [181, 196, 211, 226, 242, 258, 271, 279].map((v) => v * Mp),
      [115, 131, 154, 174, 194, 210, 227, 245].map((v) => v * Mp),
      [150, 162, 175, 186, 196, 205, 213, 217].map((v) => v * Mp),
      [95, 108, 122, 139, 160, 183, 209, 229].map((v) => v * Mp),
      [107, 118, 129, 140, 149, 157, 168, 174].map((v) => v * Mp),
      [148, 148, 146, 143, 143, 144, 145, 144].map((v) => v * Mp),
      [123, 125, 126, 127, 128, 127, 125, 124].map((v) => v * Mp),
      [84, 92, 99, 107, 114, 121, 126, 130].map((v) => v * Mp),
      [48, 57, 66, 76, 87, 100, 115, 129].map((v) => v * Mp),
    ]),
  },
};

export function getTimelineFixture(id: string): Timeline | undefined {
  const t = TIMELINES[id];
  if (!t) return undefined;
  return {
    ...t,
    entities: t.entities.map((e) => ({ ...e })),
    frames: t.frames.map((f) => ({ year: f.year, values: [...f.values] })),
  };
}
