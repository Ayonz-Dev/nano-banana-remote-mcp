// Helpers shared across data-source adapters.

// Stable World Bank / OWID aggregate + region codes we exclude from
// country-level rankings so like is compared with like.
export const AGGREGATE_CODES = new Set([
  "WLD", "EAS", "ECS", "LCN", "MEA", "MNA", "NAC", "SAS", "SSF", "SSA",
  "ARB", "CEB", "CSS", "EAP", "EAR", "ECA", "EMU", "EUU", "FCS", "HIC",
  "HPC", "IBD", "IBT", "IDA", "IDB", "IDX", "INX", "LAC", "LCR", "LDC",
  "LIC", "LMC", "LMY", "LTE", "MIC", "OED", "OSS", "PRE", "PSS", "PST",
  "SST", "TEA", "TEC", "TLA", "TMN", "TSA", "TSS", "UMC", "WBG", "AFE",
  "AFW", "AFR", "AFF", "OWID",
]);

// True for real, single-country ISO3 codes. Filters out aggregates (WLD),
// OWID region pseudo-codes (OWID_WRL — fails the 3-letter test), and blanks.
export function isRealCountryCode(code?: string | null): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return false;
  return !AGGREGATE_CODES.has(c);
}

const FETCH_TIMEOUT_MS = 12_000;

// fetch() with an abort timeout so a hung upstream can't stall a request.
export async function fetchText(url: string, accept = "text/csv"): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, accept = "application/json"): Promise<T> {
  const text = await fetchText(url, accept);
  return JSON.parse(text) as T;
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes ("") and CRLF/LF line endings. Good enough for the well-formed
// CSVs these public sources emit.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Close the row on LF; swallow a following LF after CR.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}
