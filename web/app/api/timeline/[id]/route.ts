import { NextResponse } from "next/server";
import { getCatalogEntry } from "@/lib/sources";
import { fetchTimeline } from "@/lib/sources/timeline";

// GET /api/timeline/:id — resolves a race topic to a Timeline (entities + annual
// frames) for the bar-chart-race player.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const entry = getCatalogEntry(params.id);
  if (!entry) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 404 });
  }
  if (entry.defaultChart !== "race") {
    return NextResponse.json({ error: "Topic is not a race" }, { status: 400 });
  }

  try {
    const timeline = await fetchTimeline(entry);
    return NextResponse.json({
      entry: { id: entry.id, title: entry.title },
      timeline,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load timeline";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
