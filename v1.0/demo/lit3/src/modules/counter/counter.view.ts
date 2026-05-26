/**
 * @demo/counter — module-owned UI (Lit 3)
 */

import { LitElement, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Counter } from "./counter.wmep";

import "./counter.scss";

@customElement("demo-counter-view")
export class CounterView extends LitElement {
  @property({ attribute: false }) initial: number =
    DEFAULT_CONFIG.counter.initial;
  @property({ attribute: false }) step: number = DEFAULT_CONFIG.counter.step;

  @state() private value = 0;
  @state() private lastSource = "(initial)";

  private instance: WmepInstance<Counter> | null = null;
  private unsubs: Array<() => void> = [];

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.value = this.initial;

    const instance = Counter(
      { logger: createLogger("@demo/counter") },
      { initial: this.initial, step: this.step },
    );
    this.instance = instance;

    this.unsubs.push(
      instance.on("counter:changed", (e) => {
        this.value = e.value;
        this.lastSource = e.source;
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    const inst = this.instance;
    this.instance = null;
    if (inst) void inst.unmount("counter-view-disconnect");
  }

  private bump = (amount?: number): void => {
    this.instance?.capabilities.bump(amount !== undefined ? { amount } : undefined);
  };
  private decrement = (): void => {
    this.instance?.capabilities.decrement();
  };
  private reset = (): void => {
    this.instance?.capabilities.reset();
  };
  private requestReset = (): void => {
    this.instance?.notify("counter:reset-request", undefined);
  };

  protected override render(): TemplateResult {
    return html`
      <section class="module-panel counter-panel">
        <header class="module-panel-header">
          <span class="module-panel-title">Counter</span>
          <span class="module-panel-subtitle">@demo/counter</span>
        </header>

        <div class="counter-display">
          <div class="counter-value">${this.value}</div>
          <div class="counter-source">last source: ${this.lastSource}</div>
        </div>

        <div class="counter-buttons">
          <button class="btn btn-red" @click=${this.decrement}>
            - ${this.step}
          </button>
          <button class="btn btn-gray" @click=${this.reset}>Reset</button>
          <button class="btn btn-green" @click=${() => this.bump()}>
            + ${this.step}
          </button>
        </div>

        <div class="counter-extra-buttons">
          <button class="btn btn-ghost" @click=${() => this.bump(5)}>+5</button>
          <button class="btn btn-ghost" @click=${() => this.bump(10)}>
            +10
          </button>
          <button class="btn btn-ghost" @click=${this.requestReset}>
            notify reset-request
          </button>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "demo-counter-view": CounterView;
  }
}
