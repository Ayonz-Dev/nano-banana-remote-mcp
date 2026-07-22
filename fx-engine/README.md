# FX Hedging & Cash Analytics Engine

Data layer and shared libraries for the corporate FX hedging and cash analytics
dashboard. This directory is self-contained so it can grow into the Next.js app
without disturbing the Nano Banana MCP server that shares this repository root.

## Golden rules (do not break)

- **USD is the anchor.** Every pair is quoted with USD as the quote currency,
  so `AUD/USD` means USD per 1 AUD. Base units = `amount_usd / rate`.
- **scenario_id null means live data.** Non-null means a sandbox scenario. Joins
  on `scenario_id` use `is not distinct from`, because `null = null` is not true
  and a plain join silently drops every live row.
- Rates are `numeric(12,6)`, money is `numeric(18,2)`. Never float.
- Australian English in copy and comments. No em-dashes.

## What is here now

### Migrations (`supabase/migrations`, run in order)

| File | Purpose |
| --- | --- |
| `000_baseline.sql` | Pre-refactor baseline (`spot_history`, `bank_forecasts`, `forward_orders` and `usd_cash_balances` with the old `is_sandbox` flag). Lets the 001 to 004 chain run on a fresh database. |
| `001_exposures_and_scenarios.sql` | `currency_pairs`, `scenarios`, `usd_exposures`, `v_exposure_signed`. Pair FKs on the timelines. |
| `002_scenario_refactor.sql` | Adds `scenario_id`, `buy_sell`, generated `amount_local` to `forward_orders`; `scenario_id` and `as_of_date` to `usd_cash_balances`; migrates `is_sandbox` rows to a Legacy Sandbox scenario; live and per-scenario unique indexes on `order_number`. |
| `003_hedge_coverage_monthly.sql` | `v_hedge_coverage_monthly` (the single source the KPI cards read) and `v_cash_latest`. |
| `004_soft_delete_reconciliation.sql` | `status`, `source`, `import_batch_id`, `updated_at`, `retired_at` on `forward_orders`; `updated_at` trigger; refreshes the coverage view to ignore retired rows; n8n reconciliation DML as a commented template. |
| `005_rate_assumptions.sql` | `rate_assumptions` config table plus `v_rate_assumptions_latest`. The interest-rate differential source for the IRP line. |
| `006_spot_forecasts.sql` | `spot_forecasts` table (model forecast with an uncertainty band) plus `v_spot_forecast_latest`, the source for the model forecast line. |

### IRP predictive line (`lib/irp`)

Covered interest-rate parity, as a pure typed library, not inline in a Recharts
component:

```
F = S * (1 + r_quote * t) / (1 + r_base * t)
```

- `coveredForwardRate`, `forwardPoints`, `forwardBasis` for single points.
- `ratesForPair` resolves base and quote rates from a canonical pair string.
  This is the named seam where a flipped base/quote would silently invert the
  premium, so it is unit-tested.
- `forwardCurve` builds a sorted predictive line over a set of maturities.

The differential comes from the `rate_assumptions` table (decision recorded in
the brief). The library stays pure and receives resolved rates; wire the app so
it reads `v_rate_assumptions_latest` and passes the rates in.

### Model spot forecast (`lib/forecast`)

A native numeric forecast, so the chart has a forecast line without depending on
an external trading agent. A pure, unit-tested unit:

- `dampedHolt.ts`: damped-trend exponential smoothing. A random walk is hard to
  beat on FX and an undamped trend runs away, so the trend is damped and settles
  over the horizon. It emits a central point and an ~80 per cent uncertainty
  band that widens with the square root of the horizon.
- `fromSpot.ts`: adapts a dated spot series to dated monthly forecast points
  with the band, mapping calendar dates to fractional model steps.
- This is model opinion, not arbitrage-free maths. It is always drawn with its
  band and a distinct label so it never reads like the IRP line.

`scripts/generate-forecasts.ts` (run `npm run forecast`) reads `spot_history`,
fits the model per active pair, and upserts a run into `spot_forecasts`. Schedule
it daily (n8n, cron) after new spot data lands. The chart reads the latest run
from `v_spot_forecast_latest`.

### Dashboard (Next.js App Router)

- `app/page.tsx` is a server component. It reads the selected scenario from
  `?scenario=<id>` (absent means live), fetches coverage and cash, rolls them
  up, and renders KPI cards plus a per month, per pair coverage table.
- KPI cards wire to `v_hedge_coverage_monthly` (filtered by scenario) and
  `v_cash_latest`: payable coverage, unhedged payable, confidence-weighted net
  exposure, and the USD cash buffer with its coverage of the unhedged payable.
- `lib/coverage/rollup.ts` holds the aggregation as a pure, unit-tested unit.
  Ratios are computed from summed dollars, not by averaging per-row ratios.
- `lib/supabase/queries.ts` is the only place numerics are coerced from the
  strings supabase-js returns, and the only place the scenario filter is
  applied. Live data uses `IS NULL`, not an equality on null.
- Without Supabase env vars the page renders a configuration notice, so the
  build and dev server run with no database.

### Rate chart (Recharts)

- `components/RateChart.tsx` is a client component: the historical spot line,
  the three predictive lines, and forward-order dots on a shared numeric time
  axis, with a slider for the manual line.
- `lib/chart/series.ts` builds the model as a pure, unit-tested unit. Every
  predictive line is anchored on the last actual spot so they converge there.
- Four predictive lines carry different epistemic status and get distinct dash
  styles and legend labels so they do not read as equally authoritative: IRP
  (arbitrage-free, clean dash), bank forecast (opinion, sparse dot), manual
  (what-if, dash-dot), and the model forecast (damped Holt, fine dots) with a
  shaded uncertainty band.
- Manual slider behaviour: it shifts the endpoint rate at the far horizon and
  interpolates linearly back to the anchor spot, rather than a flat drift.
- IRP rates come from `rate_assumptions` via `ratesForPair`. The default pair is
  AUD/USD.
- `app/chart-preview` renders the chart from deterministic synthetic data, so it
  can be viewed and screenshotted without a database. It is not linked from the
  app.

## Verify

```bash
cd fx-engine
npm install
npm test        # IRP and coverage-rollup unit tests
npm run typecheck
npm run build   # production build, also type-checks the app
npm run dev     # local dashboard once .env is filled in
```

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_SUPABASE_URL` and a key to
point the dashboard at a Supabase project with the migrations applied.

The migration chain has been verified end to end against Postgres: all six
migrations apply, the live coverage bucket survives the `is not distinct from`
join, fork-on-edit is allowed while duplicate live order numbers are rejected,
the generated `amount_local` is correct, and retired forwards drop out of
coverage.

## Next increments (not built yet)

- Forward move UX: dragging or clicking a forward to change its maturity, which
  forks a live forward into a scenario before moving the copy. The chart plots
  forwards read-only for now; this adds the write path.
- Multi-pair chart selection (the chart defaults to AUD/USD).
- buy_sell backfill from MYOB so forwards count toward buy or sell coverage.
