import type { EChartsOption } from "echarts";
import type { Timeline } from "./sources/types";
import { brand, type Theme } from "./brand";
import { formatAxis, formatValue } from "./format";
import { paletteFor } from "./chart";

// Pure builders for the bar-chart-race (no echarts import). RacePlayer holds the
// echarts instance and drives frame updates; these helpers produce the option
// and per-frame data.

export interface RaceSpec {
  timeline: Timeline;
  theme: Theme;
  topN: number;
  title: string;
  /** ms per year-step; also the animation duration between frames. */
  stepMs: number;
}

export function raceNames(timeline: Timeline): string[] {
  return timeline.entities.map((e) => e.label);
}

// A stable colour per entity so a country keeps its colour through the race.
export function raceColors(timeline: Timeline): string[] {
  const pal = brand.colors.series;
  return timeline.entities.map((_, i) => pal[i % pal.length]);
}

interface BarDatum {
  value: number;
  itemStyle: { color: string; borderRadius: number[] };
}

export function raceFrameData(
  timeline: Timeline,
  frameIndex: number,
  colors: string[],
): BarDatum[] {
  const frame = timeline.frames[frameIndex] ?? timeline.frames[0];
  return frame.values.map((v, i) => ({
    value: v,
    itemStyle: { color: colors[i], borderRadius: [0, 6, 6, 0] },
  }));
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function buildRaceOption(spec: RaceSpec, colors: string[]): EChartsOption {
  const { timeline, topN, stepMs } = spec;
  const p = paletteFor(spec.theme);
  const unit = timeline.unit;
  const names = raceNames(timeline);
  const frame0 = timeline.frames[0];

  return {
    backgroundColor: p.paper,
    // Title/footer/accent chrome.
    title: {
      text: spec.title,
      subtext: timeline.source,
      left: 40,
      top: 34,
      textStyle: {
        color: p.ink,
        fontFamily: brand.fonts.display,
        fontWeight: 800 as const,
        fontSize: 34,
      },
      subtextStyle: { color: p.subInk, fontFamily: brand.fonts.body, fontSize: 18 },
    },
    grid: { left: 40, right: 150, top: 150, bottom: 70, containLabel: true },
    xAxis: {
      type: "value",
      max: "dataMax",
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
      data: names,
      inverse: true,
      max: topN - 1,
      axisLabel: {
        color: p.ink,
        fontFamily: brand.fonts.body,
        fontSize: 17,
        fontWeight: 600,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      animationDuration: 200,
      animationDurationUpdate: 200,
    },
    series: [
      {
        id: "bars",
        type: "bar",
        realtimeSort: true,
        barWidth: "62%",
        data: raceFrameData(timeline, 0, colors),
        label: {
          show: true,
          position: "right",
          valueAnimation: true,
          color: p.ink,
          fontFamily: brand.fonts.display,
          fontSize: 16,
          fontWeight: 700,
          formatter: (d: { value: unknown }) => formatValue(Number(d.value), unit),
        },
      },
    ],
    // Linear easing gives the steady "race" feel; the first frame is instant.
    animationDuration: 0,
    animationDurationUpdate: stepMs,
    animationEasing: "linear",
    animationEasingUpdate: "linear",
    graphic: [
      {
        type: "text",
        left: 40,
        bottom: 26,
        style: {
          text: brand.credit.replace("{source}", timeline.source),
          fill: p.subInk,
          fontFamily: brand.fonts.body,
          fontSize: 15,
          fontWeight: 600 as const,
        },
      },
      {
        type: "rect",
        left: 40,
        top: 24,
        shape: { width: 44, height: 6, r: 3 },
        style: { fill: p.accent },
      },
      {
        // Big year counter, bottom-right, faint behind the bars.
        type: "text",
        id: "year",
        right: 60,
        bottom: 60,
        style: {
          text: String(frame0.year),
          fill: hexWithAlpha(p.subInk, 0.55),
          fontFamily: brand.fonts.display,
          fontSize: 92,
          fontWeight: 800 as const,
        },
        z: 100,
      },
    ],
  };
}
