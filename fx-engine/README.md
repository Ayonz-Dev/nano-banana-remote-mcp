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

- Recharts chart: spot history, the three predictive lines (IRP, bank forecast,
  manual slider) with distinct dash styles and a clear legend, and forward-order
  dots at maturity.
- Manual slider behaviour and the forward move UX are still open decisions in
  the brief.
