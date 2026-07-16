import type { Series } from "./sources/types";

// Compact, human-readable number formatting tuned for chart labels and
// captions. Currency indicators (unit "US$") get a leading $ and T/B/M suffix;
// large counts get T/B/M; small ratios keep one or two decimals.

const ABS_UNITS: Array<[number, string]> = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

export function compact(value: number): string {
  const abs = Math.abs(value);
  for (const [scale, suffix] of ABS_UNITS) {
    if (abs >= scale) {
      const scaled = value / scale;
      const digits = scaled >= 100 ? 0 : 1;
      return `${scaled.toFixed(digits)}${suffix}`;
    }
  }
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatValue(value: number, unit?: string): string {
  if (unit === "US$" || unit === "$") return `$${compact(value)}`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "people") return compact(value);
  const compacted = compact(value);
  return unit ? `${compacted} ${unit}` : compacted;
}

// Axis labels want just the scaled number (unit lives in the title).
export function formatAxis(value: number, unit?: string): string {
  if (unit === "US$" || unit === "$") return `$${compact(value)}`;
  return compact(value);
}

export function subtitleFor(series: Series): string {
  const parts: string[] = [];
  if (series.year) parts.push(String(series.year));
  if (series.unit && series.unit !== "people") parts.push(unitLabel(series.unit));
  return parts.join(" · ");
}

function unitLabel(unit: string): string {
  switch (unit) {
    case "US$":
      return "current US$";
    case "t":
      return "tonnes per capita";
    case "years":
      return "years";
    default:
      return unit;
  }
}
