/**
 * Main demo entry (Lit 3 + Vite)
 *
 * Composes the wMEP modules like Lego pieces:
 *
 *   <demo-layout-view>
 *     leftPanelContent  = <demo-configuration-view />    // @demo/configuration UI
 *     rightPanelContent = <info-panel />                 // small in-page sidebar
 *     modeBodies = {
 *       counter: <demo-counter-view ... />,              // @demo/counter UI
 *       notes:   <demo-notes-view ... />,                // @demo/notes UI
 *       clock:   <demo-clock-view ... />,                // @demo/clock UI
 *     }
 *   </demo-layout-view>
 *
 * The host (this file) is also responsible for wiring cross-module
 * events. The @demo/configuration module is the SINGLE SOURCE OF
 * TRUTH for every module's config; this module subscribes to its
 * "config:changed" / "config:reset" events and re-feeds the values
 * back into each module's view by destroying/re-creating the view.
 * Each view re-mounts its wMEP instance with the new config (the
 * HOST-to-MODULE config slot is by definition construction-time).
 *
 *   @demo/configuration --on('config:changed')-->
 *     @demo/layout      --notify('config:changed')   (live update via listener)
 *     @demo/counter     <- new props -> re-construct (initial, step)
 *     @demo/notes       <- new props -> re-construct (maxNotes)
 *     @demo/clock       <- new props -> re-construct (format, tickIntervalMs)
 *
 * The reverse direction is also wired so the Configuration UI
 * mirrors the live panel widths in real time:
 *
 *   @demo/layout        --on('layout:panelResized')-->
 *   @demo/configuration --set('layout.{side}Panel.defaultWidth')
 *
 * A dedup check (`current !== width`) terminates the obvious
 * Configuration -> Layout -> Configuration round-trip.
 */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import type { WmepInstance } from "@aurorah/wmep";

import "./styles/globals.scss";
import "./styles/page.scss";

// Side-effect imports — load the boundary modules so the @customElement
// decorators in each module's view file run and register the custom
// elements before main.ts creates them via document.createElement(...).
// Without these, esbuild tree-shakes the otherwise-type-only imports
// below and the elements never get registered.
import "./modules/configuration/configuration.wmep";
import "./modules/layout/layout.wmep";
import "./modules/counter/counter.wmep";
import "./modules/notes/notes.wmep";
import "./modules/clock/clock.wmep";

import {
  DEFAULT_CONFIG,
  type Configuration,
  type ConfigurationShape,
  type ConfigurationView,
} from "./modules/configuration/configuration.wmep";
import type { Layout, LayoutView } from "./modules/layout/layout.wmep";
import type { CounterView } from "./modules/counter/counter.wmep";
import type { NotesView } from "./modules/notes/notes.wmep";
import type { ClockView } from "./modules/clock/clock.wmep";

import {
  clearLogBuffer,
  getLogBuffer,
  subscribeLog,
  type LogEntry,
} from "./lib/host";

// =================================================================
// Boot
// =================================================================

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("#app container missing");

let configSnapshot: ConfigurationShape = structuredClonePoly(DEFAULT_CONFIG);

let configRef: WmepInstance<Configuration> | null = null;
let layoutRef: WmepInstance<Layout> | null = null;

// ---- Configuration view (left panel) ----

const configView = document.createElement(
  "demo-configuration-view",
) as ConfigurationView;
configView.onInstance = (inst) => {
  configRef = inst;
  configSnapshot = inst.capabilities.getAll();
  applyTheme(configSnapshot.theme);
  if (layoutRef) wireCrossModule();
};

// ---- Info panel (right panel) ----

const infoPanel = document.createElement("info-panel") as InfoPanel;

// ---- Top bar toolbar ----

const topBarToolbar = document.createElement(
  "topbar-toolbar",
) as TopBarToolbar;

// ---- Initial mode bodies ----

let counterView: CounterView = buildCounter();
let notesView: NotesView = buildNotes();
let clockView: ClockView = buildClock();

function buildCounter(): CounterView {
  const el = document.createElement("demo-counter-view") as CounterView;
  el.initial = configSnapshot.counter.initial;
  el.step = configSnapshot.counter.step;
  return el;
}
function buildNotes(): NotesView {
  const el = document.createElement("demo-notes-view") as NotesView;
  el.maxNotes = configSnapshot.notes.maxNotes;
  return el;
}
function buildClock(): ClockView {
  const el = document.createElement("demo-clock-view") as ClockView;
  el.format = configSnapshot.clock.format;
  el.tickIntervalMs = configSnapshot.clock.tickIntervalMs;
  return el;
}

// ---- Layout view (root) ----

const layoutView = document.createElement("demo-layout-view") as LayoutView;
layoutView.title = configSnapshot.appTitle;
layoutView.initialMode = configSnapshot.initialMode;
layoutView.modes = configSnapshot.modes;
layoutView.leftPanel = {
  visible: configSnapshot.layout.leftPanel.visible,
  width: configSnapshot.layout.leftPanel.defaultWidth,
  minWidth: configSnapshot.layout.leftPanel.minWidth,
};
layoutView.rightPanel = {
  visible: configSnapshot.layout.rightPanel.visible,
  width: configSnapshot.layout.rightPanel.defaultWidth,
  minWidth: configSnapshot.layout.rightPanel.minWidth,
};
layoutView.topBarToolbar = topBarToolbar;
layoutView.leftPanelContent = configView;
layoutView.rightPanelContent = infoPanel;
layoutView.modeBodies = {
  counter: counterView,
  notes: notesView,
  clock: clockView,
};
layoutView.onInstance = (inst) => {
  layoutRef = inst;
  if (configRef) wireCrossModule();
};

appRoot.appendChild(layoutView);

// =================================================================
// Cross-module wiring (config <-> layout, config -> module rebuilds)
// =================================================================

let crossWireOff: Array<() => void> = [];

function wireCrossModule(): void {
  crossWireOff.forEach((fn) => fn());
  crossWireOff = [];

  const cfg = configRef;
  const layout = layoutRef;
  if (!cfg || !layout) return;

  configSnapshot = cfg.capabilities.getAll();
  applyTheme(configSnapshot.theme);

  crossWireOff.push(
    cfg.on("config:changed", ({ path, value }) => {
      layout.notify("config:changed", { path: String(path), value });
      const previous = configSnapshot;
      configSnapshot = cfg.capabilities.getAll();
      applyTheme(configSnapshot.theme);
      reactToConfigChange(previous, configSnapshot);
    }),
  );

  crossWireOff.push(
    cfg.on("config:reset", ({ snapshot }) => {
      const previous = configSnapshot;
      configSnapshot = snapshot;
      applyTheme(snapshot.theme);
      reactToConfigChange(previous, configSnapshot);
    }),
  );

  crossWireOff.push(
    layout.on("layout:panelResized", ({ side, width }) => {
      const path =
        side === "left"
          ? ("layout.leftPanel.defaultWidth" as const)
          : ("layout.rightPanel.defaultWidth" as const);
      const current = cfg.capabilities.get(path);
      if (current !== width) cfg.capabilities.set(path, width);
    }),
  );
}

function reactToConfigChange(
  prev: ConfigurationShape,
  next: ConfigurationShape,
): void {
  if (
    prev.counter.initial !== next.counter.initial ||
    prev.counter.step !== next.counter.step
  ) {
    rebuildCounter();
  }
  if (prev.notes.maxNotes !== next.notes.maxNotes) {
    rebuildNotes();
  }
  if (
    prev.clock.format !== next.clock.format ||
    prev.clock.tickIntervalMs !== next.clock.tickIntervalMs
  ) {
    rebuildClock();
  }
}

function rebuildCounter(): void {
  counterView = buildCounter();
  layoutView.modeBodies = { ...layoutView.modeBodies, counter: counterView };
  layoutView.requestUpdate();
}

function rebuildNotes(): void {
  notesView = buildNotes();
  layoutView.modeBodies = { ...layoutView.modeBodies, notes: notesView };
  layoutView.requestUpdate();
}

function rebuildClock(): void {
  clockView = buildClock();
  layoutView.modeBodies = { ...layoutView.modeBodies, clock: clockView };
  layoutView.requestUpdate();
}

function applyTheme(theme: ConfigurationShape["theme"]): void {
  document.documentElement.dataset.theme = theme;
}

// =================================================================
// Small in-page widgets (kept here because they aren't wMEP modules)
// =================================================================

@customElement("topbar-toolbar")
class TopBarToolbar extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="topbar-toolbar">
        <span class="topbar-toolbar-label">wMEP modules:</span>
        <code class="topbar-toolbar-pill">@demo/configuration</code>
        <code class="topbar-toolbar-pill">@demo/layout</code>
        <code class="topbar-toolbar-pill">@demo/counter</code>
        <code class="topbar-toolbar-pill">@demo/notes</code>
        <code class="topbar-toolbar-pill">@demo/clock</code>
      </div>
    `;
  }
}

@customElement("info-panel")
class InfoPanel extends LitElement {
  @state() private entries: LogEntry[] = [...getLogBuffer()];

  private unsubLog: (() => void) | null = null;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubLog = subscribeLog(() => {
      this.entries = [...getLogBuffer()];
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubLog?.();
    this.unsubLog = null;
  }

  protected override render(): TemplateResult {
    const entries = this.entries;
    return html`
      <section class="module-panel info-panel">
        <header class="module-panel-header">
          <span class="module-panel-title">Activity log</span>
          <div class="module-panel-header-right">
            <span class="module-panel-subtitle">
              host logger &middot; ${entries.length}
            </span>
            <button
              class="btn btn-ghost btn-sm"
              ?disabled=${entries.length === 0}
              title="Clear activity log"
              @click=${() => clearLogBuffer()}
            >
              Clear
            </button>
          </div>
        </header>

        <div class="info-panel-help">
          <p>
            Each panel is a wMEP module in its own directory under
            <code>src/modules/</code>. They communicate through the protocol:
          </p>
          <ul>
            <li><strong>capabilities</strong> &mdash; host calls module</li>
            <li><strong>events</strong> &mdash; module emits to host</li>
            <li><strong>listeners</strong> &mdash; host notifies module</li>
            <li><strong>requires</strong> &mdash; module calls host</li>
            <li><strong>config</strong> &mdash; values at construction</li>
          </ul>
        </div>

        <ol class="log-list">
          ${entries.length === 0
            ? html`<li class="log-empty">waiting for events...</li>`
            : entries
                .slice()
                .reverse()
                .map(
                  (e, i) => html`
                    <li class="log-item" .key=${`${e.ts}-${i}`}>
                      <span class="log-time">
                        ${new Date(e.ts).toLocaleTimeString([], {
                          hour12: false,
                        })}
                      </span>
                      <span class="log-module">${e.module}</span>
                      <span class="log-action">${e.action}</span>
                    </li>
                  `,
                )}
          ${nothing}
        </ol>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "topbar-toolbar": TopBarToolbar;
    "info-panel": InfoPanel;
  }
}

// =================================================================
// Polyfills
// =================================================================

function structuredClonePoly<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

// =================================================================
// Hot Module Replacement (Vite)
// =================================================================

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    crossWireOff.forEach((fn) => fn());
    appRoot?.replaceChildren();
  });
}
