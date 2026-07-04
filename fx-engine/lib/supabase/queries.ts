import 'server-only';
import { getServerClient } from './server';
import type { CashRow, CoverageRow, Scenario } from '../coverage/types';
import type { ForecastPoint, ForwardPoint, SpotPoint } from '../chart/series';

// Data access for the dashboard. All numeric columns come back from supabase-js
// as strings to preserve precision, so every fetch coerces them to numbers here,
// once, before the rest of the app sees them.

function num(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : null;
}

/**
 * Apply the scenario filter. Live data is scenario_id null, so it needs an IS
 * NULL filter, not an equality one. A plain eq on null would match nothing and
 * silently return an empty dashboard.
 */
function scopeToScenario<T extends { is: Function; eq: Function }>(
  query: T,
  scenarioId: number | null,
): T {
  return (scenarioId === null
    ? query.is('scenario_id', null)
    : query.eq('scenario_id', scenarioId)) as T;
}

export async function fetchScenarios(): Promise<Scenario[]> {
  const client = getServerClient();
  if (!client) return [];
  const { data, error } = await client
    .from('scenarios')
    .select('id, name')
    .order('id', { ascending: true });
  if (error) throw new Error(`fetchScenarios: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id as number, name: row.name as string }));
}

export async function fetchCoverage(scenarioId: number | null): Promise<CoverageRow[]> {
  const client = getServerClient();
  if (!client) return [];
  const { data, error } = await scopeToScenario(
    client.from('v_hedge_coverage_monthly').select('*'),
    scenarioId,
  ).order('bucket_month', { ascending: true });
  if (error) throw new Error(`fetchCoverage: ${error.message}`);
  return (data ?? []).map((row) => ({
    bucket_month: row.bucket_month as string,
    scenario_id: (row.scenario_id as number | null) ?? null,
    pair: row.pair as string,
    gross_payable_usd: num(row.gross_payable_usd),
    gross_receivable_usd: num(row.gross_receivable_usd),
    net_exposure_usd: num(row.net_exposure_usd),
    net_exposure_weighted_usd: num(row.net_exposure_weighted_usd),
    hedged_buy_usd: num(row.hedged_buy_usd),
    hedged_sell_usd: num(row.hedged_sell_usd),
    hedged_total_usd: num(row.hedged_total_usd),
    blended_forward_rate: numOrNull(row.blended_forward_rate),
    payable_coverage_ratio: numOrNull(row.payable_coverage_ratio),
    unhedged_payable_usd: num(row.unhedged_payable_usd),
  }));
}

export async function fetchCash(scenarioId: number | null): Promise<CashRow[]> {
  const client = getServerClient();
  if (!client) return [];
  const { data, error } = await scopeToScenario(
    client.from('v_cash_latest').select('*'),
    scenarioId,
  ).order('account_name', { ascending: true });
  if (error) throw new Error(`fetchCash: ${error.message}`);
  return (data ?? []).map((row) => ({
    account_name: row.account_name as string,
    institution: (row.institution as string | null) ?? null,
    balance_amount_usd: num(row.balance_amount_usd),
    local_currency: row.local_currency as string,
    as_of_date: row.as_of_date as string,
    scenario_id: (row.scenario_id as number | null) ?? null,
  }));
}

export async function fetchSpotHistory(pair: string): Promise<SpotPoint[]> {
  const client = getServerClient();
  if (!client) return [];
  const { data, error } = await client
    .from('spot_history')
    .select('date, rate')
    .eq('pair', pair)
    .order('date', { ascending: true });
  if (error) throw new Error(`fetchSpotHistory: ${error.message}`);
  return (data ?? []).map((row) => ({ date: row.date as string, rate: num(row.rate) }));
}

export async function fetchBankForecasts(pair: string): Promise<ForecastPoint[]> {
  const client = getServerClient();
  if (!client) return [];
  const { data, error } = await client
    .from('bank_forecasts')
    .select('target_date, rate')
    .eq('pair', pair)
    .order('target_date', { ascending: true });
  if (error) throw new Error(`fetchBankForecasts: ${error.message}`);
  return (data ?? []).map((row) => ({ date: row.target_date as string, rate: num(row.rate) }));
}

/** Live or scenario forwards for a pair, retired rows excluded, as scatter points. */
export async function fetchForwards(
  scenarioId: number | null,
  pair: string,
): Promise<ForwardPoint[]> {
  const client = getServerClient();
  if (!client) return [];
  const { data, error } = await scopeToScenario(
    client
      .from('forward_orders')
      .select('order_number, contract_rate, maturity_date, pair, retired_at')
      .eq('pair', pair)
      .is('retired_at', null),
    scenarioId,
  ).order('maturity_date', { ascending: true });
  if (error) throw new Error(`fetchForwards: ${error.message}`);
  return (data ?? []).map((row) => ({
    date: row.maturity_date as string,
    rate: num(row.contract_rate),
    orderNumber: row.order_number as string,
  }));
}

/** Latest annualised rate per currency, as a lookup for the IRP line. */
export async function fetchRateAssumptions(): Promise<Record<string, number>> {
  const client = getServerClient();
  if (!client) return {};
  const { data, error } = await client
    .from('v_rate_assumptions_latest')
    .select('currency, annual_rate');
  if (error) throw new Error(`fetchRateAssumptions: ${error.message}`);
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[row.currency as string] = num(row.annual_rate);
  }
  return map;
}
