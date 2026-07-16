"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts } from "echarts";
import type { Timeline } from "@/lib/sources/types";
import type { Theme } from "@/lib/brand";
import { buildRaceOption, raceColors, raceFrameData } from "@/lib/race";
import { paletteFor } from "@/lib/chart";

interface Props {
  timeline: Timeline;
  theme: Theme;
  topN: number;
  title: string;
  width: number;
  height: number;
  displayWidth: number;
  stepMs?: number;
  onReady?: (instance: ECharts) => void;
}

// Animated bar-chart-race. Uses echarts imperatively (not echarts-for-react) so
// we can drive frames on a timer and record the canvas to WebM. Renders at true
// export dimensions and CSS-scales the preview, like ChartCanvas.
export default function RacePlayer({
  timeline,
  theme,
  topN,
  title,
  width,
  height,
  displayWidth,
  stepMs = 320,
  onReady,
}: Props) {
  const scale = displayWidth / width;
  const colors = useMemo(() => raceColors(timeline), [timeline]);
  const option = useMemo(
    () => buildRaceOption({ timeline, theme, topN, title, stepMs }, colors),
    [timeline, theme, topN, title, stepMs, colors],
  );

  const hostRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<ECharts | null>(null);
  const frameRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  const totalFrames = timeline.frames.length;

  // Init once (client-only; echarts touches the canvas).
  useEffect(() => {
    let disposed = false;
    import("echarts").then((echarts) => {
      if (disposed || !hostRef.current) return;
      const inst = echarts.init(hostRef.current, null, {
        renderer: "canvas",
        width,
        height,
      });
      instRef.current = inst;
      inst.setOption(option);
      onReady?.(inst);
      setReady(true);
    });
    return () => {
      disposed = true;
      instRef.current?.dispose();
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    instRef.current?.resize({ width, height });
  }, [width, height]);

  // Rebuild + restart when the option changes (theme/topN/timeline/title).
  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    inst.setOption(option, true);
    frameRef.current = 0;
    setAtEnd(false);
    setPlaying(true);
  }, [option]);

  function applyFrame(i: number) {
    const inst = instRef.current;
    if (!inst) return;
    inst.setOption({
      series: [{ id: "bars", data: raceFrameData(timeline, i, colors) }],
      graphic: [{ id: "year", style: { text: String(timeline.frames[i].year) } }],
    });
    frameRef.current = i;
  }

  // Playback timer.
  useEffect(() => {
    if (!ready || !playing || exporting) return;
    const id = setInterval(() => {
      const next = frameRef.current + 1;
      if (next >= totalFrames) {
        setPlaying(false);
        setAtEnd(true);
        return;
      }
      applyFrame(next);
    }, stepMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, playing, exporting, stepMs, timeline]);

  function restart() {
    const inst = instRef.current;
    if (!inst) return;
    inst.setOption(option, true);
    frameRef.current = 0;
    setAtEnd(false);
    setPlaying(true);
  }

  function toggle() {
    if (atEnd) {
      restart();
      return;
    }
    setPlaying((p) => !p);
  }

  const canVideo =
    typeof window !== "undefined" && typeof MediaRecorder !== "undefined";

  // Record one full pass of the race to a WebM file by capturing the canvas.
  async function exportVideo() {
    const inst = instRef.current;
    if (!inst) return;
    const canvas = inst.getDom().querySelector("canvas") as
      | (HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
      | null;
    if (!canvas || !canvas.captureStream || !canVideo) return;

    const mime =
      ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      ) ?? "video/webm";

    setExporting(true);
    setPlaying(false);
    inst.setOption(option, true);
    frameRef.current = 0;
    setAtEnd(false);
    await sleep(250); // settle the first frame

    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.start();

    for (let i = 1; i < totalFrames; i++) {
      applyFrame(i);
      await sleep(stepMs);
    }
    await sleep(1500); // hold the final frame

    rec.stop();
    await stopped;
    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bar-chart-race.webm";
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setAtEnd(true);
  }

  const paper = paletteFor(theme).paper;

  return (
    <div style={{ width: "100%" }}>
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
          <div ref={hostRef} style={{ width, height, background: paper }} />
        </div>
      </div>

      <div className="actions">
        <button className="btn secondary" onClick={toggle} disabled={exporting}>
          {atEnd ? "Replay" : playing ? "Pause" : "Play"}
        </button>
        <button className="btn secondary" onClick={restart} disabled={exporting}>
          Restart
        </button>
        {canVideo && (
          <button className="btn" onClick={exportVideo} disabled={exporting}>
            {exporting ? "Recording…" : "Export video (WebM)"}
          </button>
        )}
      </div>
    </div>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
