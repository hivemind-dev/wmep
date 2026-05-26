/**
 * @demo/configuration — module-owned UI (Lit 3)
 *
 * The Configuration module renders its own settings panel as a
 * Lit custom element. The element constructs a wMEP instance
 * internally on connectedCallback, wires it to the host's
 * logger, and exposes the configuration values as editable
 * inputs. Renders into the Light DOM so the shared cascaded
 * SCSS (.btn, .module-panel, .config-row, ...) still applies.
 *
 * Internal to the `configuration/` directory.
 */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";

import type { WmepInstance } from "@aurorah/wmep";

import { createLogger } from "../../lib/host";

import {
  Configuration,
  DEFAULT_CONFIG,
  type ConfigurationShape,
} from "./configuration.wmep";

import "./configuration.scss";

export type ConfigurationInstanceCallback = (
  instance: WmepInstance<Configuration>,
) => void;

@customElement("demo-configuration-view")
export class ConfigurationView extends LitElement {
  // Function property (not attribute) — set imperatively by the host
  // to receive the constructed wMEP instance for cross-module wiring.
  onInstance: ConfigurationInstanceCallback | null = null;

  @state() private snapshot: ConfigurationShape = structuredClonePoly(
    DEFAULT_CONFIG,
  );

  private instance: WmepInstance<Configuration> | null = null;
  private unsubs: Array<() => void> = [];

  private appTitleRef: Ref<HTMLInputElement> = createRef();
  private leftWidthRef: Ref<HTMLInputElement> = createRef();
  private leftMinRef: Ref<HTMLInputElement> = createRef();
  private rightWidthRef: Ref<HTMLInputElement> = createRef();
  private rightMinRef: Ref<HTMLInputElement> = createRef();
  private counterInitialRef: Ref<HTMLInputElement> = createRef();
  private counterStepRef: Ref<HTMLInputElement> = createRef();
  private notesMaxRef: Ref<HTMLInputElement> = createRef();
  private clockTickRef: Ref<HTMLInputElement> = createRef();

  // Light DOM so cascaded SCSS applies.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const instance = Configuration(
      { logger: createLogger("@demo/configuration") },
      { overrides: undefined },
    );
    this.instance = instance;

    this.unsubs.push(
      instance.on("config:changed", () => {
        this.snapshot = instance.capabilities.getAll();
      }),
      instance.on("config:reset", ({ snapshot }) => {
        this.snapshot = snapshot;
      }),
      instance.on("wmep:mounted", () => {
        this.snapshot = instance.capabilities.getAll();
        this.onInstance?.(instance);
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    const inst = this.instance;
    this.instance = null;
    if (inst) void inst.unmount("configuration-view-disconnect");
  }

  // Mirror snapshot into inputs imperatively, but only for inputs
  // that don't currently hold the user's focus. This lets the
  // commit-on-blur pattern co-exist with external state updates
  // (e.g. layout drag mirroring the panel width back into config).
  protected override updated(): void {
    syncInput(this.appTitleRef.value, this.snapshot.appTitle);
    syncInput(
      this.leftWidthRef.value,
      String(this.snapshot.layout.leftPanel.defaultWidth),
    );
    syncInput(
      this.leftMinRef.value,
      String(this.snapshot.layout.leftPanel.minWidth),
    );
    syncInput(
      this.rightWidthRef.value,
      String(this.snapshot.layout.rightPanel.defaultWidth),
    );
    syncInput(
      this.rightMinRef.value,
      String(this.snapshot.layout.rightPanel.minWidth),
    );
    syncInput(
      this.counterInitialRef.value,
      String(this.snapshot.counter.initial),
    );
    syncInput(this.counterStepRef.value, String(this.snapshot.counter.step));
    syncInput(this.notesMaxRef.value, String(this.snapshot.notes.maxNotes));
    syncInput(
      this.clockTickRef.value,
      String(this.snapshot.clock.tickIntervalMs),
    );
  }

  private setPath = (
    path: Parameters<Configuration["capabilities"]["set"]>[0],
    value: unknown,
  ): void => {
    this.instance?.capabilities.set(path, value);
  };

  private commitText = (
    path: Parameters<Configuration["capabilities"]["set"]>[0],
    current: string,
  ) =>
    (e: FocusEvent): void => {
      const input = e.currentTarget as HTMLInputElement;
      const next = input.value;
      if (next !== current) this.setPath(path, next);
    };

  private commitNumber = (
    path: Parameters<Configuration["capabilities"]["set"]>[0],
    current: number,
    min?: number,
  ) =>
    (e: FocusEvent): void => {
      const input = e.currentTarget as HTMLInputElement;
      const n = Number(input.value);
      if (!Number.isFinite(n)) {
        input.value = String(current);
        return;
      }
      const integer = Math.trunc(n);
      const clamped = min !== undefined ? Math.max(min, integer) : integer;
      input.value = String(clamped);
      if (clamped !== current) this.setPath(path, clamped);
    };

  private onTextKeyDown = (current: string) =>
    (e: KeyboardEvent): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        (e.currentTarget as HTMLInputElement).value = current;
        (e.currentTarget as HTMLInputElement).blur();
      }
    };

  private onNumberKeyDown = (current: number) =>
    (e: KeyboardEvent): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.currentTarget as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        (e.currentTarget as HTMLInputElement).value = String(current);
        (e.currentTarget as HTMLInputElement).blur();
      }
    };

  protected override render(): TemplateResult {
    const snap = this.snapshot;
    return html`
      <section class="module-panel configuration-panel">
        <header class="module-panel-header">
          <span class="module-panel-title">Configuration</span>
          <span class="module-panel-subtitle">@demo/configuration</span>
        </header>

        <div class="config-row">
          <label class="config-label">App title</label>
          <input
            ${ref(this.appTitleRef)}
            type="text"
            class="config-input"
            .value=${snap.appTitle}
            @keydown=${this.onTextKeyDown(snap.appTitle)}
            @blur=${this.commitText("appTitle", snap.appTitle)}
          />
        </div>

        <div class="config-row">
          <label class="config-label">Theme</label>
          <button
            class="btn btn-ghost"
            @click=${() => this.instance?.capabilities.toggleTheme()}
          >
            ${snap.theme}
          </button>
        </div>

        <div class="config-section-title">Layout</div>

        <div class="config-row">
          <label class="config-label">Left panel width (px)</label>
          <input
            ${ref(this.leftWidthRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.layout.leftPanel.defaultWidth)}
            @keydown=${this.onNumberKeyDown(snap.layout.leftPanel.defaultWidth)}
            @blur=${this.commitNumber(
              "layout.leftPanel.defaultWidth",
              snap.layout.leftPanel.defaultWidth,
              snap.layout.leftPanel.minWidth,
            )}
          />
        </div>

        <div class="config-row">
          <label class="config-label">Left panel min width (px)</label>
          <input
            ${ref(this.leftMinRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.layout.leftPanel.minWidth)}
            @keydown=${this.onNumberKeyDown(snap.layout.leftPanel.minWidth)}
            @blur=${this.commitNumber(
              "layout.leftPanel.minWidth",
              snap.layout.leftPanel.minWidth,
              200,
            )}
          />
        </div>

        <div class="config-row">
          <label class="config-label">Right panel width (px)</label>
          <input
            ${ref(this.rightWidthRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.layout.rightPanel.defaultWidth)}
            @keydown=${this.onNumberKeyDown(
              snap.layout.rightPanel.defaultWidth,
            )}
            @blur=${this.commitNumber(
              "layout.rightPanel.defaultWidth",
              snap.layout.rightPanel.defaultWidth,
              snap.layout.rightPanel.minWidth,
            )}
          />
        </div>

        <div class="config-row">
          <label class="config-label">Right panel min width (px)</label>
          <input
            ${ref(this.rightMinRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.layout.rightPanel.minWidth)}
            @keydown=${this.onNumberKeyDown(snap.layout.rightPanel.minWidth)}
            @blur=${this.commitNumber(
              "layout.rightPanel.minWidth",
              snap.layout.rightPanel.minWidth,
              200,
            )}
          />
        </div>

        <div class="config-section-title">Counter</div>

        <div class="config-row">
          <label class="config-label">Initial value</label>
          <input
            ${ref(this.counterInitialRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.counter.initial)}
            @keydown=${this.onNumberKeyDown(snap.counter.initial)}
            @blur=${this.commitNumber("counter.initial", snap.counter.initial)}
          />
        </div>

        <div class="config-row">
          <label class="config-label">Step</label>
          <input
            ${ref(this.counterStepRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.counter.step)}
            @keydown=${this.onNumberKeyDown(snap.counter.step)}
            @blur=${this.commitNumber("counter.step", snap.counter.step, 1)}
          />
        </div>

        <div class="config-section-title">Notes</div>

        <div class="config-row">
          <label class="config-label">Max notes</label>
          <input
            ${ref(this.notesMaxRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.notes.maxNotes)}
            @keydown=${this.onNumberKeyDown(snap.notes.maxNotes)}
            @blur=${this.commitNumber("notes.maxNotes", snap.notes.maxNotes, 1)}
          />
        </div>

        <div class="config-section-title">Clock</div>

        <div class="config-row">
          <label class="config-label">Format</label>
          <button
            class="btn btn-ghost"
            @click=${() =>
              this.setPath(
                "clock.format",
                snap.clock.format === "24h" ? "12h" : "24h",
              )}
          >
            ${snap.clock.format}
          </button>
        </div>

        <div class="config-row">
          <label class="config-label">Tick interval (ms)</label>
          <input
            ${ref(this.clockTickRef)}
            type="text"
            inputmode="numeric"
            class="config-input"
            .value=${String(snap.clock.tickIntervalMs)}
            @keydown=${this.onNumberKeyDown(snap.clock.tickIntervalMs)}
            @blur=${this.commitNumber(
              "clock.tickIntervalMs",
              snap.clock.tickIntervalMs,
              100,
            )}
          />
        </div>

        <div class="config-actions">
          <button
            class="btn btn-ghost"
            @click=${() => this.instance?.capabilities.reset()}
          >
            Reset to defaults
          </button>
        </div>
        ${nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "demo-configuration-view": ConfigurationView;
  }
}

// =================================================================
// Helpers
// =================================================================

function syncInput(
  input: HTMLInputElement | undefined,
  value: string,
): void {
  if (!input) return;
  if (document.activeElement === input) return;
  if (input.value !== value) input.value = value;
}

function structuredClonePoly<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
