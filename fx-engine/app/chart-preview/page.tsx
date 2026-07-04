import { RateChart } from '../../components/RateChart';
import type { ForecastPoint, ForwardPoint, SpotPoint } from '../../lib/chart/series';

// Deterministic synthetic data so the chart renders and can be verified without
// a database. Not linked from the app; it is a development and screenshot aid.

export const dynamic = 'force-static';

const AUD = 0.0435;
const USD = 0.041;

function syntheticSpot(): SpotPoint[] {
  const rows: SpotPoint[] = [];
  const start = Date.parse('2026-01-05T00:00:00Z');
  for (let week = 0; week < 26; week += 1) {
    const ms = start + week * 7 * 86_400_000;
    const date = new Date(ms).toISOString().slice(0, 10);
    // A gentle wave around 0.66, no randomness so screenshots are stable.
    const rate = 0.66 + 0.012 * Math.sin(week / 3) - 0.0006 * week;
    rows.push({ date, rate: Number(rate.toFixed(6)) });
  }
  return rows;
}

const bankForecasts: ForecastPoint[] = [
  { date: '2026-09-04', rate: 0.652 },
  { date: '2026-12-04', rate: 0.648 },
];

const forwards: ForwardPoint[] = [
  { date: '2026-08-15', rate: 0.657, orderNumber: 'FWD-1001' },
  { date: '2026-10-30', rate: 0.651, orderNumber: 'FWD-1002' },
  { date: '2027-01-20', rate: 0.646, orderNumber: 'FWD-1003' },
];

export default function ChartPreviewPage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>Rate chart preview</h1>
        <span className="anchor">Synthetic AUD/USD</span>
      </header>
      <RateChart
        pair="AUD/USD"
        spotHistory={syntheticSpot()}
        bankForecasts={bankForecasts}
        forwards={forwards}
        rateBase={AUD}
        rateQuote={USD}
      />
    </main>
  );
}
