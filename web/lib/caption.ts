// Caption generation. The chart carries the accurate numbers; this layer only
// writes words. It calls Gemini when a key is configured and reachable, and
// otherwise composes a solid deterministic caption from the angle so the app is
// fully functional with zero external dependencies.

export type Platform = "instagram" | "x" | "linkedin";

export interface CaptionInput {
  title: string;
  detail: string;
  source: string;
  platform: Platform;
  fromFixture?: boolean;
}

export interface CaptionResult {
  caption: string;
  hashtags: string[];
  generatedBy: "gemini" | "fallback";
}

const PLATFORM_HINTS: Record<Platform, string> = {
  instagram:
    "Instagram caption: 2-3 short punchy lines, a hook first, one relevant emoji max, then a question to drive comments.",
  x: "X/Twitter post: under 260 characters, one sharp hook line, no fluff.",
  linkedin:
    "LinkedIn post: 3-4 lines, an insight-led hook, professional but not stiff, ends with a takeaway.",
};

const BASE_TAGS: Record<Platform, string[]> = {
  instagram: ["dataviz", "infographic", "datavisualization", "facts"],
  x: ["data", "charts"],
  linkedin: ["data", "analytics", "economics"],
};

export function fallbackCaption(input: CaptionInput): CaptionResult {
  const { title, detail, source, platform } = input;
  const lead =
    platform === "linkedin"
      ? `${title}.`
      : platform === "x"
        ? title
        : `${title} 📊`;
  const parts = [lead, detail];
  if (platform !== "x") parts.push(`Source: ${source}.`);
  if (platform === "instagram") parts.push("Which number surprised you?");
  return {
    caption: parts.join("\n\n"),
    hashtags: BASE_TAGS[platform],
    generatedBy: "fallback",
  };
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}

export async function generateCaption(input: CaptionInput): Promise<CaptionResult> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  if (!key) return fallbackCaption(input);

  const prompt = [
    "You write captions for a data-visualization social account.",
    "You are given a chart's headline and the key facts. Write ONE caption.",
    "Rules: never invent or change numbers; use only the facts given.",
    PLATFORM_HINTS[input.platform],
    "",
    `Chart headline: ${input.title}`,
    `Key facts: ${input.detail}`,
    `Data source: ${input.source}`,
    "",
    "Return strict JSON: {\"caption\": string, \"hashtags\": string[] (3-6, no # sign)}.",
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
    const json = (await res.json()) as { candidates?: GeminiCandidate[] };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text");

    const parsed = JSON.parse(text) as { caption?: string; hashtags?: string[] };
    if (!parsed.caption) throw new Error("Gemini JSON missing caption");
    return {
      caption: parsed.caption.trim(),
      hashtags: (parsed.hashtags ?? BASE_TAGS[input.platform])
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean)
        .slice(0, 6),
      generatedBy: "gemini",
    };
  } catch {
    // Any failure (no network, bad key, malformed JSON) → deterministic caption.
    return fallbackCaption(input);
  }
}
