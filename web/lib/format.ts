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
      const digits = Math.abs(scaled) >= 100 ? 0 : 1;
      return `${+scaled.toFixed(digits)}${suffix}`;
    }
  }
  // Whole numbers (border counts, densities) print without a spurious ".0".
  if (Number.isInteger(value)) return String(value);
  if (abs >= 100) return String(Math.round(value));
  return String(+value.toFixed(2));
}

// Trim a trailing ".0" so "61.0%" reads as "61%" but "3.6%" stays "3.6%".
const trim = (n: number, digits = 1) => `${+n.toFixed(digits)}`;

export function formatValue(value: number, unit?: string): string {
  if (unit === "US$" || unit === "$") return `$${compact(value)}`;
  if (unit === "%") return `${trim(value)}%`;
  if (unit === "people") return compact(value);
  // Euro units like "€/mo" or "€/kWh" read best with the symbol up front.
  if (unit && unit.startsWith("€")) return `€${compact(value)}${unit.slice(1)}`;
  const compacted = compact(value);
  return unit ? `${compacted} ${unit}` : compacted;
}

// Axis labels want just the scaled number (unit lives in the title).
export function formatAxis(value: number, unit?: string): string {
  if (unit === "US$" || unit === "$") return `$${compact(value)}`;
  if (unit === "%") return `${trim(value)}%`;
  if (unit && unit.startsWith("€")) return `€${compact(value)}`;
  return compact(value);
}

export function subtitleFor(series: Series): string {
  const parts: string[] = [];
  if (series.year) parts.push(String(series.year));
  const label = unitLabel(series.unit);
  if (label) parts.push(label);
  return parts.join(" · ");
}

// Human descriptor for a unit, used in the chart subtitle. Returns "" for units
// that already read clearly on the axis (%, plain counts) to avoid noise.
function unitLabel(unit?: string): string {
  switch (unit) {
    case "US$":
      return "current US$";
    case "t":
      return "tonnes per capita";
    case "Gt CO₂":
      return "gigatonnes CO₂/year";
    case "years":
      return "years";
    default:
      return "";
  }
}
