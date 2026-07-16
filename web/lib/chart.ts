import type { EChartsOption } from "echarts";
import type { Series } from "./sources/types";
import { brand, type Theme } from "./brand";
import { formatAxis, formatValue, subtitleFor } from "./format";
import { shortTitle } from "./angles";

export interface ChartSpec {
  series: Series;
  theme: Theme;
  /** Number of rows to show. */
  topN: number;
  /** Chart form. */
  form: "rankedBar" | "line";
  /** Big headline (usually from the selected angle). */
  title: string;
  /** Optional override subtitle; defaults to "year · unit". */
  subtitle?: string;
}

interface Palette {
  ink: string;
  subInk: string;
  paper: string;
  paperAlt: string;
  grid: string;
  accent: string;
  series: readonly string[];
}

export function paletteFor(theme: Theme): Palette {
  const c = brand.colors;
  return theme === "dark"
    ? {
        ink: c.darkInk,
        subInk: c.darkSubInk,
        paper: c.darkPaper,
        paperAlt: c.darkPaperAlt,
        grid: c.darkGrid,
        accent: c.accent,
        series: c.series,
      }
    : {
        ink: c.ink,
        subInk: c.subInk,
        paper: c.paper,
        paperAlt: c.paperAlt,
        grid: c.grid,
        accent: c.accent,
        series: c.series,
      };
}

function footerText(series: Series): string {
  return brand.credit.replace("{source}", series.source);
}

// Common title/footer chrome shared by every chart form.
function chrome(spec: ChartSpec, p: Palette) {
  const { series } = spec;
  const subtitle = spec.subtitle ?? subtitleFor(series);
  return {
    title: {
      text: spec.title,
      subtext: subtitle,
      left: 40,
      top: 34,
      textStyle: {
        color: p.ink,
        fontFamily: brand.fonts.display,
        fontWeight: 800 as const,
        fontSize: 34,
        lineHeight: 40,
        width: 900,
        overflow: "break" as const,
      },
      subtextStyle: {
        color: p.subInk,
        fontFamily: brand.fonts.body,
        fontSize: 18,
        fontWeight: 500 as const,
      },
    },
    graphic: [
      {
        type: "text" as const,
        left: 40,
        bottom: 26,
        style: {
          text: footerText(series),
          fill: p.subInk,
          fontFamily: brand.fonts.body,
          fontSize: 15,
          fontWeight: 600 as const,
        },
      },
      // Accent bar in the top-left as a simple, recognizable brand mark.
      {
        type: "rect" as const,
        left: 40,
        top: 24,
        shape: { width: 44, height: 6, r: 3 },
        style: { fill: p.accent },
        z: 10,
      },
    ],
  };
}

function rankedBarOption(spec: ChartSpec, p: Palette): EChartsOption {
  const { series, topN } = spec;
  const rows = [...series.points].sort((a, b) => b.value - a.value).slice(0, topN);
  // ECharts category axis renders bottom-to-top, so reverse to put #1 on top.
  const cats = rows.map((r) => r.label).reverse();
  const vals = rows.map((r) => r.value).reverse();
  const unit = series.unit;

  return {
    backgroundColor: p.paper,
    animation: false,
    ...chrome(spec, p),
    grid: { left: 40, right: 120, top: 150, bottom: 70, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: {
        color: p.subInk,
        fontFamily: brand.fonts.body,
        fontSize: 14,
        formatter: (v: number) => formatAxis(v, unit),
      },
      splitLine: { lineStyle: { color: p.grid } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: cats,
      axisLabel: {
        color: p.ink,
        fontFamily: brand.fonts.body,
        fontSize: 17,
        fontWeight: 600,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: vals,
        barWidth: "62%",
        itemStyle: {
          color: p.accent,
          borderRadius: [0, 6, 6, 0],
        },
        label: {
          show: true,
          position: "right",
          color: p.ink,
          fontFamily: brand.fonts.display,
          fontSize: 16,
          fontWeight: 700,
          // echarts passes a rich params object; we only need the numeric value.
          formatter: (d: { value: unknown }) => formatValue(Number(d.value), unit),
        },
      },
    ],
  };
}

function lineOption(spec: ChartSpec, p: Palette): EChartsOption {
  const { series } = spec;
  const rows = [...series.points].sort(
    (a, b) => (a.year ?? 0) - (b.year ?? 0),
  );
  const unit = series.unit;

  return {
    backgroundColor: p.paper,
    animation: false,
    ...chrome(spec, p),
    grid: { left: 40, right: 60, top: 150, bottom: 70, containLabel: true },
    xAxis: {
      type: "category",
      data: rows.map((r) => r.label),
      boundaryGap: false,
      axisLabel: {
        color: p.subInk,
        fontFamily: brand.fonts.body,
        fontSize: 15,
        fontWeight: 600,
      },
      axisLine: { lineStyle: { color: p.grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: p.subInk,
        fontFamily: brand.fonts.body,
        fontSize: 14,
        formatter: (v: number) => formatAxis(v, unit),
      },
      splitLine: { lineStyle: { color: p.grid } },
    },
    series: [
      {
        type: "line",
        data: rows.map((r) => r.value),
        smooth: true,
        symbol: "circle",
        symbolSize: 9,
        lineStyle: { color: p.accent, width: 4 },
        itemStyle: { color: p.accent },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexWithAlpha(p.accent, 0.28) },
              { offset: 1, color: hexWithAlpha(p.accent, 0.0) },
            ],
          },
        },
      },
    ],
  };
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function buildChartOption(spec: ChartSpec): EChartsOption {
  const p = paletteFor(spec.theme);
  return spec.form === "line" ? lineOption(spec, p) : rankedBarOption(spec, p);
}

export { shortTitle };
