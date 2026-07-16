import { NextResponse } from "next/server";
import { generateCaption, type CaptionInput, type Platform } from "@/lib/caption";

const PLATFORMS: Platform[] = ["instagram", "x", "linkedin"];

// POST /api/caption — { title, detail, source, platform } → generated caption.
export async function POST(req: Request) {
  let body: Partial<CaptionInput>;
  try {
    body = (await req.json()) as Partial<CaptionInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = (body.platform ?? "instagram") as Platform;
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }
  if (!body.title || !body.detail) {
    return NextResponse.json(
      { error: "title and detail are required" },
      { status: 400 },
    );
  }

  const result = await generateCaption({
    title: body.title,
    detail: body.detail,
    source: body.source ?? "Public data",
    platform,
    fromFixture: body.fromFixture,
  });
  return NextResponse.json(result);
}
