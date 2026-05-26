/**
 * @demo/clock — module-owned UI (Lit 3)
 */

import { LitElement, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Clock, type ClockFormat } from "./clock.wmep";

import "./clock.scss";

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

@customElement("demo-clock-view")
export class ClockView extends LitElement {
  @property({ attribute: false }) format: ClockFormat =
    DEFAULT_CONFIG.clock.format;
  @property({ attribute: false }) tickIntervalMs: number =
    DEFAULT_CONFIG.clock.tickIntervalMs;

  @state() private ts = Date.now();
  @state() private activeFormat: ClockFormat = "24h";
  @state() private paused = false;

  private instance: WmepInstance<Clock> | null = null;
  private unsubs: Array<() => void> = [];

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.activeFormat = this.format;

    const instance = Clock(
      { logger: createLogger("@demo/clock") },
      { format: this.format, tickIntervalMs: this.tickIntervalMs },
    );
    this.instance = instance;

    this.unsubs.push(
      instance.on("clock:tick", (e) => {
        this.ts = e.ts;
      }),
      instance.on("clock:formatChanged", (e) => {
        this.activeFormat = e.format;
        this.ts = Date.now();
      }),
      instance.on("clock:paused", () => {
        this.paused = true;
      }),
      instance.on("clock:resumed", () => {
        this.paused = false;
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    const inst = this.instance;
    this.instance = null;
    if (inst) void inst.unmount("clock-view-disconnect");
  }

  private toggleFormat = (): void => {
    this.instance?.capabilities.setFormat({
      format: this.activeFormat === "24h" ? "12h" : "24h",
    });
  };

  private pause = (): void => {
    this.instance?.capabilities.pause();
  };

  private resume = (): void => {
    this.instance?.capabilities.resume();
  };

  protected override render(): TemplateResult {
    return html`
      <section class="module-panel clock-panel">
        <header class="module-panel-header">
          <span class="module-panel-title">Clock</span>
          <span class="module-panel-subtitle">@demo/clock</span>
        </header>

        <div class="clock-display">
          <div class="clock-time">${formatTime(this.ts, this.activeFormat)}</div>
          <div class="clock-meta">
            format: ${this.activeFormat} &middot;
            ${this.paused ? "paused" : "running"}
          </div>
        </div>

        <div class="clock-controls">
          <button class="btn btn-ghost" @click=${this.toggleFormat}>
            Toggle format
          </button>
          ${this.paused
            ? html`<button class="btn btn-green" @click=${this.resume}>
                Resume
              </button>`
            : html`<button class="btn btn-red" @click=${this.pause}>
                Pause
              </button>`}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "demo-clock-view": ClockView;
  }
}
