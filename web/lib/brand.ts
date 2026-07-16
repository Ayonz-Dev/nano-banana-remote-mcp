// Central brand system. Everything visual references these tokens so every
// exported chart reads as a single, consistent publisher — the core of the
// Voronoi-style "it's all one brand" look. Swap these values to re-skin the
// entire output.

export const brand = {
  name: "DataForge",
  tagline: "Public data, made shareable",
  // Footer credit shown on every export.
  credit: "DataForge · Source: {source}",

  fonts: {
    // System stack keeps exports dependency-free and pixel-consistent.
    display:
      "'Inter', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
    body: "'Inter', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
  },

  // Sequential-friendly categorical palette. First color is the "hero"/accent.
  colors: {
    ink: "#0B1220", // near-black text on light
    subInk: "#5B6472", // secondary text
    paper: "#FFFFFF", // light canvas
    paperAlt: "#F4F6FA", // panel / gridline background
    grid: "#E4E8F0",
    accent: "#2563EB", // hero blue
    series: [
      "#2563EB",
      "#F59E0B",
      "#10B981",
      "#EF4444",
      "#8B5CF6",
      "#06B6D4",
      "#EC4899",
      "#84CC16",
    ],
    // Dark theme variant for "night" exports.
    darkPaper: "#0B1220",
    darkPaperAlt: "#131C2E",
    darkInk: "#F4F6FA",
    darkSubInk: "#9AA4B2",
    darkGrid: "#26314A",
  },
} as const;

// Social export presets (pixel dimensions). ECharts renders at these sizes so
// the PNG needs no downstream resizing.
export const formats = {
  igPortrait: { key: "igPortrait", label: "Instagram / TikTok (4:5)", w: 1080, h: 1350 },
  square: { key: "square", label: "Square (1:1)", w: 1080, h: 1080 },
  story: { key: "story", label: "Story / Reel (9:16)", w: 1080, h: 1920 },
  landscape: { key: "landscape", label: "X / LinkedIn (16:9)", w: 1200, h: 675 },
} as const;

export type FormatKey = keyof typeof formats;
export type Theme = "light" | "dark";
