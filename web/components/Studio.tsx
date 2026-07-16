"use client";

import { useEffect, useMemo, useState } from "react";
import type { ECharts } from "echarts";
import ChartCanvas from "./ChartCanvas";
import { buildChartOption, paletteFor } from "@/lib/chart";
import { formats, type FormatKey, type Theme } from "@/lib/brand";
import { subtitleFor } from "@/lib/format";
import type { Series } from "@/lib/sources/types";
import type { Angle } from "@/lib/angles";
import type { Platform } from "@/lib/caption";

export interface CatalogCard {
  id: string;
  title: string;
  blurb: string;
  topic: string;
}

interface SeriesPayload {
  entry: { id: string; title: string; defaultChart: "rankedBar" | "line" };
  series: Series;
  angles: Angle[];
}

interface CaptionResult {
  caption: string;
  hashtags: string[];
  generatedBy: "gemini" | "fallback";
}

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "X" },
  { key: "linkedin", label: "LinkedIn" },
];

export default function Studio({ catalog }: { catalog: CatalogCard[] }) {
  const [selectedId, setSelectedId] = useState<string>(catalog[0]?.id ?? "");
  const [payload, setPayload] = useState<SeriesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [angleIdx, setAngleIdx] = useState(0);
  const [form, setForm] = useState<"rankedBar" | "line">("rankedBar");
  const [theme, setTheme] = useState<Theme>("light");
  const [formatKey, setFormatKey] = useState<FormatKey>("igPortrait");
  const [topN, setTopN] = useState(10);

  const [platform, setPlatform] = useState<Platform>("instagram");
  const [caption, setCaption] = useState<CaptionResult | null>(null);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [chart, setChart] = useState<ECharts | null>(null);

  // Load a topic whenever the selection changes.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCaption(null);
    fetch(`/api/series/${selectedId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load");
        return r.json() as Promise<SeriesPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setAngleIdx(0);
        setForm(data.entry.defaultChart);
        const firstTop = data.angles[0]?.topN ?? 10;
        setTopN(Math.min(firstTop, data.series.points.length));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const angle: Angle | undefined = payload?.angles[angleIdx];
  const format = formats[formatKey];

  // When a different angle is picked, adopt its suggested row count.
  useEffect(() => {
    if (angle && payload) {
      setTopN(Math.min(angle.topN, payload.series.points.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angleIdx]);

  const option = useMemo(() => {
    if (!payload || !angle) return null;
    return buildChartOption({
      series: payload.series,
      theme,
      topN,
      form,
      title: angle.headline,
      subtitle: subtitleFor(payload.series),
    });
  }, [payload, angle, theme, topN, form]);

  // Fit the export-size chart into a reasonable on-screen preview box.
  const display = useMemo(() => {
    const maxW = 560;
    const maxH = 640;
    const scale = Math.min(maxW / format.w, maxH / format.h, 1);
    return { width: Math.round(format.w * scale) };
  }, [format]);

  async function handleCaption() {
    if (!payload || !angle) return;
    setCaptionLoading(true);
    setCopied(false);
    try {
      const res = await fetch("/api/caption", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: angle.headline,
          detail: angle.detail,
          source: payload.series.source,
          platform,
          fromFixture: payload.series.fromFixture,
        }),
      });
      setCaption((await res.json()) as CaptionResult);
    } catch {
      setError("Caption generation failed");
    } finally {
      setCaptionLoading(false);
    }
  }

  function handleDownload() {
    if (!chart || !payload || !angle) return;
    const url = chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: paletteFor(theme).paper,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedId}-${angle.id}-${formatKey}.png`;
    a.click();
  }

  function copyCaption() {
    if (!caption) return;
    const tags = caption.hashtags.map((h) => `#${h}`).join(" ");
    navigator.clipboard.writeText(`${caption.caption}\n\n${tags}`);
    setCopied(true);
  }

  return (
    <div className="layout">
      {/* Left rail: topic catalog */}
      <aside>
        <div className="panel">
          <h2>Topics</h2>
          <div className="topic-list">
            {catalog.map((c) => (
              <button
                key={c.id}
                className={`topic ${c.id === selectedId ? "selected" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="t-title">{c.title}</div>
                <div className="t-blurb">{c.blurb}</div>
                <span className="t-topic">{c.topic}</span>
              </button>
            ))}
          </div>
        </div>

        {payload && payload.angles.length > 0 && (
          <div className="panel">
            <h2>Story angle</h2>
            {payload.angles.map((a, i) => (
              <button
                key={a.id}
                className={`angle ${i === angleIdx ? "selected" : ""}`}
                onClick={() => setAngleIdx(i)}
              >
                <div className="a-label">{a.label}</div>
                <div className="a-head">{a.headline}</div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Right: preview + controls */}
      <main>
        {payload?.series.fromFixture && (
          <div className="banner">
            Showing a bundled sample snapshot — live network to the data source
            isn&apos;t available here. Deployed, this pulls live figures.
          </div>
        )}
        {error && <div className="error">{error}</div>}

        <div className="controls">
          <div className="seg">
            {(["light", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                className={theme === t ? "on" : ""}
                onClick={() => setTheme(t)}
              >
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>

          <div className="seg">
            {(Object.keys(formats) as FormatKey[]).map((k) => (
              <button
                key={k}
                className={formatKey === k ? "on" : ""}
                onClick={() => setFormatKey(k)}
                title={formats[k].label}
              >
                {formats[k].label.split(" ")[0]}
              </button>
            ))}
          </div>

          {form === "rankedBar" && payload && (
            <div className="slider-row">
              <span className="field-label">Rows: {topN}</span>
              <input
                type="range"
                min={3}
                max={Math.min(20, payload.series.points.length)}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="preview-wrap">
          {loading && <div className="muted">Loading data…</div>}
          {!loading && option && (
            <ChartCanvas
              option={option}
              width={format.w}
              height={format.h}
              displayWidth={display.width}
              onReady={setChart}
            />
          )}
          {!loading && !option && !error && (
            <div className="muted">Pick a topic to start.</div>
          )}
        </div>

        <div className="actions">
          <button className="btn" onClick={handleDownload} disabled={!chart}>
            Download PNG
          </button>
          <div className="seg">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                className={platform === p.key ? "on" : ""}
                onClick={() => setPlatform(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            className="btn secondary"
            onClick={handleCaption}
            disabled={!angle || captionLoading}
          >
            {captionLoading ? "Writing…" : "Generate caption"}
          </button>
        </div>

        {caption && (
          <div className="panel" style={{ marginTop: 18 }}>
            <h2>
              Caption
              <span className="pill">
                {caption.generatedBy === "gemini" ? "Gemini" : "built-in"}
              </span>
            </h2>
            <div className="caption-box">{caption.caption}</div>
            {caption.hashtags.length > 0 && (
              <div className="hashtags">
                {caption.hashtags.map((h) => `#${h}`).join(" ")}
              </div>
            )}
            <div className="actions">
              <button className="btn secondary" onClick={copyCaption}>
                {copied ? "Copied ✓" : "Copy caption"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
