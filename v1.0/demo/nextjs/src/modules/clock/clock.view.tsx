/**
 * @demo/clock — module-owned UI
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Clock, type ClockFormat } from "./clock.wmep";

import "./clock.scss";

export interface ClockViewProps {
  format?: ClockFormat;
  tickIntervalMs?: number;
}

function formatTime(ts: number, format: ClockFormat): string {
  const d = new Date(ts);
  const hours24 = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  if (format === "24h") {
    const h = hours24.toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const h12 = ((hours24 + 11) % 12) + 1;
  return `${h12.toString().padStart(2, "0")}:${m}:${s} ${ampm}`;
}

export function ClockView({
  format = DEFAULT_CONFIG.clock.format,
  tickIntervalMs = DEFAULT_CONFIG.clock.tickIntervalMs,
}: ClockViewProps): React.ReactElement {
  const [ts, setTs] = useState<number>(() => Date.now());
  const [activeFormat, setActiveFormat] = useState<ClockFormat>(format);
  const [paused, setPaused] = useState<boolean>(false);
  const instanceRef = useRef<ReturnType<typeof Clock> | null>(null);

  useEffect(() => {
    const clock = Clock(
      { logger: createLogger("@demo/clock") },
      { format, tickIntervalMs },
    );
    instanceRef.current = clock;

    const off = [
      clock.on("clock:tick", (e) => setTs(e.ts)),
      clock.on("clock:formatChanged", (e) => setActiveFormat(e.format)),
      clock.on("clock:paused", () => setPaused(true)),
      clock.on("clock:resumed", () => setPaused(false)),
    ];

    return () => {
      off.forEach((fn) => fn());
      void clock.unmount("clock-view-unmount");
    };
  }, [format, tickIntervalMs]);

  return (
    <section className="module-panel clock-panel">
      <header className="module-panel-header">
        <span className="module-panel-title">Clock</span>
        <span className="module-panel-subtitle">@demo/clock</span>
      </header>

      <div className="clock-display">
        <div className="clock-time">{formatTime(ts, activeFormat)}</div>
        <div className="clock-meta">
          format: {activeFormat} &middot; {paused ? "paused" : "running"}
        </div>
      </div>

      <div className="clock-controls">
        <button
          className="btn btn-ghost"
          onClick={() =>
            instanceRef.current?.capabilities.setFormat({
              format: activeFormat === "24h" ? "12h" : "24h",
            })
          }
        >
          Toggle format
        </button>
        {paused ? (
          <button
            className="btn btn-green"
            onClick={() => instanceRef.current?.capabilities.resume()}
          >
            Resume
          </button>
        ) : (
          <button
            className="btn btn-red"
            onClick={() => instanceRef.current?.capabilities.pause()}
          >
            Pause
          </button>
        )}
      </div>
    </section>
  );
}
