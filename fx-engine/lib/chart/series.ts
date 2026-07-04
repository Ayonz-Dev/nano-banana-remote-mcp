import { coveredForwardRate } from '../irp/irp';

// Builds the combined chart model: the historical spot line plus the three
// predictive lines (IRP, bank forecast, manual what-if) on a shared date axis,
// and the forward-order points for the scatter overlay.
//
// The three predictive lines have different epistemic status. IRP is
// arbitrage-free maths, the bank forecast is opinion, the manual line is a
// guess. This module only shapes the data; the component gives each a distinct
// dash style and legend label so they do not read as equally authoritative.
//
// The manual line shifts the endpoint rate and interpolates linearly back to
// the anchor spot, rather than applying a flat drift.

export interface SpotPoint {
  date: string;
  rate: number;
}

export interface ForecastPoint {
  date: string;
  rate: number;
}

export interface ForwardPoint {
  date: string;
  rate: number;
  orderNumber?: string;
}

export interface ChartRow {
  date: string;
  /** Epoch milliseconds for the shared numeric time axis. */
  t: number;
  spot: number | null;
  irp: number | null;
  bank: number | null;
  manual: number | null;
}

export interface BuildChartParams {
  spotHistory: SpotPoint[];
  bankForecasts: ForecastPoint[];
  forwards?: ForwardPoint[];
  /** Annualised rate of the base currency, decimal. */
  rateBase: number;
  /** Annualised rate of the quote currency (USD), decimal. */
  rateQuote: number;
  /** The manual line's target rate at the far horizon. */
  manualEndpointRate: number;
  /** Months of predictive horizon past the last spot. Defaults to 12. */
  horizonMonths?: number;
  /** Day-count basis for the IRP year fraction. Defaults to 365. */
  dayCount?: number;
}

export interface ChartModel {
  rows: ChartRow[];
  forwards: ForwardPoint[];
  /** Last actual spot date, where the predictive lines are anchored. */
  anchorDate: string | null;
  anchorRate: number | null;
}

const MS_PER_DAY = 86_400_000;

function parseIso(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function addMonthsIso(date: string, months: number): string {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

export function buildChartModel(params: BuildChartParams): ChartModel {
  const forwards = params.forwards ?? [];
  const spot = [...params.spotHistory].sort((a, b) => parseIso(a.date) - parseIso(b.date));

  if (spot.length === 0) {
    return { rows: [], forwards, anchorDate: null, anchorRate: null };
  }

  const anchor = spot[spot.length - 1]!;
  const anchorMs = parseIso(anchor.date);
  const dayCount = params.dayCount ?? 365;
  const horizonMonths = params.horizonMonths ?? 12;

  // Future date grid: a monthly spine plus any forecast and forward dates that
  // fall past the anchor, so the predictive lines pass through those points.
  const futureDates = new Set<string>();
  for (let m = 1; m <= horizonMonths; m += 1) {
    futureDates.add(addMonthsIso(anchor.date, m));
  }
  for (const b of params.bankForecasts) {
    if (parseIso(b.date) > anchorMs) futureDates.add(b.date);
  }
  for (const f of forwards) {
    if (parseIso(f.date) > anchorMs) futureDates.add(f.date);
  }

  const horizonMs = [...futureDates].reduce((max, d) => Math.max(max, parseIso(d)), anchorMs);
  const span = horizonMs - anchorMs || 1;
  const bankMap = new Map(params.bankForecasts.map((b) => [b.date, b.rate]));

  const rows: ChartRow[] = [];

  // Past actuals: spot only.
  for (const s of spot) {
    if (s.date === anchor.date) continue;
    rows.push({ date: s.date, t: parseIso(s.date), spot: s.rate, irp: null, bank: null, manual: null });
  }

  // Anchor row: every predictive line converges on the last actual spot.
  rows.push({
    date: anchor.date,
    t: anchorMs,
    spot: anchor.rate,
    irp: anchor.rate,
    bank: anchor.rate,
    manual: anchor.rate,
  });

  // Future rows: predictive lines only.
  for (const date of futureDates) {
    const dMs = parseIso(date);
    const years = (dMs - anchorMs) / MS_PER_DAY / dayCount;
    const irp = coveredForwardRate({
      spot: anchor.rate,
      rateBase: params.rateBase,
      rateQuote: params.rateQuote,
      years,
    });
    const fraction = (dMs - anchorMs) / span;
    const manual = anchor.rate + (params.manualEndpointRate - anchor.rate) * fraction;
    const bank = bankMap.has(date) ? bankMap.get(date)! : null;
    rows.push({ date, t: dMs, spot: null, irp, bank, manual });
  }

  rows.sort((a, b) => a.t - b.t);

  return { rows, forwards, anchorDate: anchor.date, anchorRate: anchor.rate };
}
