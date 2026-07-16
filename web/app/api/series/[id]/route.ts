import { NextResponse } from "next/server";
import { fetchSeries, getCatalogEntry } from "@/lib/sources";
import { findAngles } from "@/lib/angles";

// GET /api/series/:id — resolves a catalog entry to a normalized series plus
// the computed "angles" (story framings). Used by the studio when a topic is
// selected.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const entry = getCatalogEntry(params.id);
  if (!entry) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 404 });
  }

  try {
    const series = await fetchSeries(entry);
    const angles = findAngles(series);
    return NextResponse.json({
      entry: { id: entry.id, title: entry.title, defaultChart: entry.defaultChart },
      series,
      angles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
