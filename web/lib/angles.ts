import type { Series } from "./sources/types";
import { formatValue } from "./format";

// "Find the story." Deterministic analysis that surfaces the framings that make
// a dataset post-worthy — the same instincts behind a good Voronoi chart. These
// are computed from the numbers (never invented), then optionally polished into
// caption copy by the language model.

export interface Angle {
  id: string;
  /** Short label shown in the UI picker. */
  label: string;
  /** Punchy, ready-to-post headline derived from the data. */
  headline: string;
  /** A supporting sentence with the key numbers. */
  detail: string;
  /** How many top rows to show for this framing. */
  topN: number;
}

const clampTop = (n: number, len: number) => Math.max(2, Math.min(n, len));

// "Additive" (extensive) metrics can be summed into a meaningful total — money,
// people, counts. "Intensive" metrics (per-capita rates, percentages, years of
// life expectancy) cannot, so share-of-total framings don't apply to them.
function isAdditive(unit?: string): boolean {
  return unit === "US$" || unit === "$" || unit === "people";
}

export function findAngles(series: Series): Angle[] {
  const pts = [...series.points].sort((a, b) => b.value - a.value);
  if (pts.length < 2) return [];

  const angles: Angle[] = [];
  const leader = pts[0];
  const runner = pts[1];
  const unit = series.unit;

  // 1) The straightforward ranking.
  angles.push({
    id: "top10",
    label: "Top 10 ranking",
    headline: `The top ${clampTop(10, pts.length)} countries by ${shortTitle(series)}`,
    detail: `${leader.label} leads with ${formatValue(leader.value, unit)}.`,
    topN: clampTop(10, pts.length),
  });

  // 2) Leader dominance — how far ahead is #1?
  const lead = runner.value !== 0 ? leader.value / runner.value : Infinity;
  if (Number.isFinite(lead) && lead >= 1.15) {
    angles.push({
      id: "dominance",
      label: "#1 vs the rest",
      headline: `${leader.label} dwarfs everyone on ${shortTitle(series)}`,
      detail: `At ${formatValue(leader.value, unit)}, ${leader.label} is ${lead.toFixed(
        1,
      )}× ${runner.label} (${formatValue(runner.value, unit)}).`,
      topN: clampTop(8, pts.length),
    });
  }

  // 3) Top-N share of the visible total — concentration. Only meaningful for
  // additive metrics (you can't sum per-capita rates or life-expectancy years).
  const topN = clampTop(5, pts.length);
  const topSum = pts.slice(0, topN).reduce((s, p) => s + p.value, 0);
  const total = pts.reduce((s, p) => s + p.value, 0);
  if (isAdditive(unit) && total > 0) {
    const share = Math.round((topSum / total) * 100);
    if (share >= 40) {
      angles.push({
        id: "concentration",
        label: "How concentrated?",
        headline: `Just ${topN} countries hold ${share}% of ${shortTitle(series)}`,
        detail: `The top ${topN} account for ${share}% of the total across the ${pts.length} shown.`,
        topN: clampTop(10, pts.length),
      });
    }
  }

  // 4) The surprise — highest per-capita / extreme value framing.
  angles.push({
    id: "extreme",
    label: "The extreme",
    headline: `${leader.label}: the world's highest ${shortTitle(series)}`,
    detail: `${leader.label} tops the list at ${formatValue(leader.value, unit)} — ${(
      leader.value / (total / pts.length)
    ).toFixed(1)}× the average of the group.`,
    topN: clampTop(12, pts.length),
  });

  return angles;
}

// A compact noun phrase for the metric, derived from the series title.
export function shortTitle(series: Series): string {
  const t = series.title.toLowerCase();
  if (t.includes("gdp")) return "GDP";
  if (t.includes("population")) return "population";
  if (t.includes("co₂") || t.includes("co2")) return "CO₂ per person";
  if (t.includes("life expectancy")) return "life expectancy";
  return series.title;
}
