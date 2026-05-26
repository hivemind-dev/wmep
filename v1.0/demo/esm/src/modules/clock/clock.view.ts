/**
 * @demo/clock — module-owned UI (vanilla DOM)
 */

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";
import { h, replaceChildren, t } from "../../lib/dom";

import { Clock, type ClockFormat } from "./clock.wmep";

import "./clock.scss";

export interface ClockViewProps {
  format?: ClockFormat;
  tickIntervalMs?: number;
}

export interface ClockViewHandle {
  el: HTMLElement;
  instance: WmepInstance<Clock>;
  destroy(): Promise<void>;
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

export function createClockView(
  props: ClockViewProps = {},
): ClockViewHandle {
  const initialFormat = props.format ?? DEFAULT_CONFIG.clock.format;
  const tickIntervalMs =
    props.tickIntervalMs ?? DEFAULT_CONFIG.clock.tickIntervalMs;

  const instance = Clock(
    { logger: createLogger("@demo/clock") },
    { format: initialFormat, tickIntervalMs },
  );

  let activeFormat: ClockFormat = initialFormat;
  let paused = false;

  const timeEl = h(
    "div",
    { className: "clock-time" },
    formatTime(Date.now(), activeFormat),
  );
  const metaEl = h(
    "div",
    { className: "clock-meta" },
    `format: ${activeFormat} · running`,
  );

  const toggleFormatBtn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () =>
        instance.capabilities.setFormat({
          format: activeFormat === "24h" ? "12h" : "24h",
        }),
    },
    "Toggle format",
  );

  const controlContainer = h("div", { className: "clock-controls" });

  const renderControls = (): void => {
    if (paused) {
      const resumeBtn = h(
        "button",
        {
          className: "btn btn-green",
          onClick: () => instance.capabilities.resume(),
        },
        "Resume",
      );
      replaceChildren(controlContainer, toggleFormatBtn, resumeBtn);
    } else {
      const pauseBtn = h(
        "button",
        {
          className: "btn btn-red",
          onClick: () => instance.capabilities.pause(),
        },
        "Pause",
      );
      replaceChildren(controlContainer, toggleFormatBtn, pauseBtn);
    }
  };

  renderControls();

  const root = h(
    "section",
    { className: "module-panel clock-panel" },
    h(
      "header",
      { className: "module-panel-header" },
      h("span", { className: "module-panel-title" }, "Clock"),
      h("span", { className: "module-panel-subtitle" }, t("@demo/clock")),
    ),
    h("div", { className: "clock-display" }, timeEl, metaEl),
    controlContainer,
  );

  const refreshMeta = (): void => {
    metaEl.textContent = `format: ${activeFormat} · ${paused ? "paused" : "running"}`;
  };

  const off = [
    instance.on("clock:tick", (e) => {
      timeEl.textContent = formatTime(e.ts, activeFormat);
    }),
    instance.on("clock:formatChanged", (e) => {
      activeFormat = e.format;
      timeEl.textContent = formatTime(Date.now(), activeFormat);
      refreshMeta();
    }),
    instance.on("clock:paused", () => {
      paused = true;
      refreshMeta();
      renderControls();
    }),
    instance.on("clock:resumed", () => {
      paused = false;
      refreshMeta();
      renderControls();
    }),
  ];

  return {
    el: root,
    instance,
    destroy: async () => {
      off.forEach((fn) => fn());
      await instance.unmount("clock-view-unmount");
    },
  };
}
