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

// ISO3 → display name for sources that label rows by code (e.g. IMF). Covers
// the countries that show up in general-interest rankings; unknown codes fall
// back to the code itself.
const ISO3_NAMES: Record<string, string> = {
  USA: "United States", CHN: "China", JPN: "Japan", DEU: "Germany",
  IND: "India", GBR: "United Kingdom", FRA: "France", ITA: "Italy",
  BRA: "Brazil", CAN: "Canada", RUS: "Russia", KOR: "South Korea",
  AUS: "Australia", ESP: "Spain", MEX: "Mexico", IDN: "Indonesia",
  NLD: "Netherlands", SAU: "Saudi Arabia", TUR: "Turkey", CHE: "Switzerland",
  POL: "Poland", SWE: "Sweden", BEL: "Belgium", ARG: "Argentina",
  NOR: "Norway", AUT: "Austria", ARE: "United Arab Emirates", ISR: "Israel",
  IRL: "Ireland", NGA: "Nigeria", ZAF: "South Africa", EGY: "Egypt",
  DNK: "Denmark", SGP: "Singapore", MYS: "Malaysia", PHL: "Philippines",
  PAK: "Pakistan", BGD: "Bangladesh", VNM: "Vietnam", THA: "Thailand",
  IRN: "Iran", COL: "Colombia", CHL: "Chile", FIN: "Finland",
  PRT: "Portugal", GRC: "Greece", CZE: "Czechia", ROU: "Romania",
  NZL: "New Zealand", PER: "Peru", KAZ: "Kazakhstan", QAT: "Qatar",
  KWT: "Kuwait", HUN: "Hungary", UKR: "Ukraine", MAR: "Morocco",
  ETH: "Ethiopia", KEN: "Kenya", DZA: "Algeria", IRQ: "Iraq",
  LUX: "Luxembourg", ISL: "Iceland", SVK: "Slovakia", SVN: "Slovenia",
  LTU: "Lithuania", LVA: "Latvia", EST: "Estonia", HRV: "Croatia",
  BGR: "Bulgaria", SRB: "Serbia", BHR: "Bahrain", OMN: "Oman",
  BRN: "Brunei", TTO: "Trinidad & Tobago", URY: "Uruguay", PRY: "Paraguay",
  COD: "DR Congo", TZA: "Tanzania", UGA: "Uganda", ZMB: "Zambia",
  NER: "Niger", MLI: "Mali", SDN: "Sudan", TCD: "Chad",
  LBY: "Libya", MNG: "Mongolia", NPL: "Nepal", LKA: "Sri Lanka",
  MMR: "Myanmar", KHM: "Cambodia", UZB: "Uzbekistan", AZE: "Azerbaijan",
  BLR: "Belarus", GEO: "Georgia", TUN: "Tunisia", JOR: "Jordan",
  LBN: "Lebanon", CRI: "Costa Rica", PAN: "Panama", ECU: "Ecuador",
  BOL: "Bolivia", VEN: "Venezuela", CYP: "Cyprus", MLT: "Malta",
  MCO: "Monaco", MDV: "Maldives", BRB: "Barbados", MUS: "Mauritius",
  RWA: "Rwanda", NAM: "Namibia", BWA: "Botswana", GHA: "Ghana",
};

export function countryName(code?: string | null): string {
  if (!code) return "";
  const c = code.trim().toUpperCase();
  return ISO3_NAMES[c] ?? c;
}

const FETCH_TIMEOUT_MS = 12_000;

// fetch() with an abort timeout so a hung upstream can't stall a request.
export async function fetchText(
  url: string,
  accept = "text/csv",
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept, ...extraHeaders },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  accept = "application/json",
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const text = await fetchText(url, accept, extraHeaders);
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
