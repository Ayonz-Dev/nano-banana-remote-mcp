"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import type { ECharts } from "echarts";

// echarts touches the DOM/canvas, so it must never render on the server.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
  option: EChartsOption;
  /** True (export) pixel dimensions of the chart. */
  width: number;
  height: number;
  /** CSS pixels the preview is scaled to fit within (keeps proportions). */
  displayWidth: number;
  /** Receives the echarts instance so the parent can export a PNG. */
  onReady: (instance: ECharts) => void;
}

// Renders the chart at true export dimensions, then visually scales the whole
// thing down with a CSS transform so the on-screen preview and the exported PNG
// are pixel-for-pixel identical in layout.
export default function ChartCanvas({
  option,
  width,
  height,
  displayWidth,
  onReady,
}: Props) {
  const scale = displayWidth / width;
  const instanceRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.setOption(option, true);
    }
  }, [option]);

  return (
    <div
      className="preview-stage"
      style={{ width: displayWidth, height: height * scale }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <ReactECharts
          option={option}
          style={{ width, height }}
          notMerge
          opts={{ renderer: "canvas" }}
          onChartReady={(inst: ECharts) => {
            instanceRef.current = inst;
            onReady(inst);
          }}
        />
      </div>
    </div>
  );
}
