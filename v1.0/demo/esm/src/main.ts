/**
 * Main demo entry (vanilla TypeScript + Vite)
 *
 * Composes the wMEP modules like Lego pieces:
 *
 *   <LayoutView (the @demo/layout module's UI)>
 *     leftPanel  = <ConfigurationView />     // @demo/configuration UI
 *     rightPanel = <InfoPanel />             // small in-page sidebar
 *     modeBodies = {
 *       counter: <CounterView ... />,        // @demo/counter UI
 *       notes:   <NotesView ... />,          // @demo/notes UI
 *       clock:   <ClockView ... />,          // @demo/clock UI
 *     }
 *   </LayoutView>
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

import type { WmepInstance } from "@aurorah/wmep";

import "./styles/globals.scss";
import "./styles/page.scss";

import {
  Configuration,
  DEFAULT_CONFIG,
  createConfigurationView,
  type ConfigurationShape,
} from "./modules/configuration/configuration.wmep";
import {
  Layout,
  createLayoutView,
} from "./modules/layout/layout.wmep";
import {
  createCounterView,
  type CounterViewHandle,
} from "./modules/counter/counter.view";
import {
  createNotesView,
  type NotesViewHandle,
} from "./modules/notes/notes.view";
import {
  createClockView,
  type ClockViewHandle,
} from "./modules/clock/clock.view";

import {
  clearLogBuffer,
  getLogBuffer,
  subscribeLog,
  type LogEntry,
} from "./lib/host";
import { h, replaceChildren } from "./lib/dom";

// =================================================================
// Boot
// =================================================================

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("#app container missing");

let configSnapshot: ConfigurationShape = structuredClonePoly(DEFAULT_CONFIG);

let configRef: WmepInstance<Configuration> | null = null;
let layoutRef: WmepInstance<Layout> | null = null;

// ---- Configuration view (left panel) ----

const configView = createConfigurationView({
  onInstance: (inst) => {
    configRef = inst;
    configSnapshot = inst.capabilities.getAll();
    applyTheme(configSnapshot.theme);
    if (layoutRef) wireCrossModule();
  },
});

// ---- Info panel (right panel) ----

const infoPanel = createInfoPanel();

// ---- Top bar toolbar ----

const topBarToolbar = createTopBarToolbar();

// ---- Initial mode bodies ----

let counterView: CounterViewHandle | null = null;
let notesView: NotesViewHandle | null = null;
let clockView: ClockViewHandle | null = null;

const buildCounter = (): CounterViewHandle =>
  createCounterView({
    initial: configSnapshot.counter.initial,
    step: configSnapshot.counter.step,
  });
const buildNotes = (): NotesViewHandle =>
  createNotesView({ maxNotes: configSnapshot.notes.maxNotes });
const buildClock = (): ClockViewHandle =>
  createClockView({
    format: configSnapshot.clock.format,
    tickIntervalMs: configSnapshot.clock.tickIntervalMs,
  });

counterView = buildCounter();
notesView = buildNotes();
clockView = buildClock();

// ---- Layout view (root) ----

const layoutView = createLayoutView({
  title: configSnapshot.appTitle,
  initialMode: configSnapshot.initialMode,
  modes: configSnapshot.modes,
  leftPanel: {
    visible: configSnapshot.layout.leftPanel.visible,
    width: configSnapshot.layout.leftPanel.defaultWidth,
    minWidth: configSnapshot.layout.leftPanel.minWidth,
  },
  rightPanel: {
    visible: configSnapshot.layout.rightPanel.visible,
    width: configSnapshot.layout.rightPanel.defaultWidth,
    minWidth: configSnapshot.layout.rightPanel.minWidth,
  },
  topBarToolbar,
  leftPanelContent: configView.el,
  rightPanelContent: infoPanel.el,
  modeBodies: {
    counter: counterView.el,
    notes: notesView.el,
    clock: clockView.el,
  },
  onInstance: (inst) => {
    layoutRef = inst;
    if (configRef) wireCrossModule();
  },
});

appRoot.appendChild(layoutView.el);

// =================================================================
// Cross-module wiring (config <-> layout, config -> module rebuilds)
// =================================================================

let crossWireOff: Array<() => void> = [];

// Suppresses the layout->config reverse listeners while the host is
// pushing config values into the layout (e.g. during `config:reset`).
// Without this, calls like `setPanelMinWidth` always emit
// `layout:panelResized`, which would round-trip the just-reset value
// straight back into the configuration before the matching
// `setPanelWidth` call lands.
let suppressReverseSync = false;

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
      applyConfigChangeToLayout(layout, path, value);
      reactToConfigChange(previous, configSnapshot);
    }),
  );

  crossWireOff.push(
    cfg.on("config:reset", ({ snapshot }) => {
      const previous = configSnapshot;
      configSnapshot = snapshot;
      applyTheme(snapshot.theme);
      suppressReverseSync = true;
      try {
        syncLayoutFromConfig(layout, snapshot);
      } finally {
        suppressReverseSync = false;
      }
      reactToConfigChange(previous, configSnapshot);
    }),
  );

  crossWireOff.push(
    layout.on("layout:panelResized", ({ side, width }) => {
      if (suppressReverseSync) return;
      const path =
        side === "left"
          ? ("layout.leftPanel.defaultWidth" as const)
          : ("layout.rightPanel.defaultWidth" as const);
      const current = cfg.capabilities.get(path);
      if (current !== width) cfg.capabilities.set(path, width);
    }),
  );

  crossWireOff.push(
    layout.on("layout:panelToggled", ({ side, visible }) => {
      if (suppressReverseSync) return;
      const path =
        side === "left"
          ? ("layout.leftPanel.visible" as const)
          : ("layout.rightPanel.visible" as const);
      const current = cfg.capabilities.get(path);
      if (current !== visible) cfg.capabilities.set(path, visible);
    }),
  );
}

/**
 * Push every layout-relevant slice of the configuration snapshot into
 * the @demo/layout module's wMEP capabilities. Used after `config:reset`
 * so the layout's internal state cannot drift from the configuration's
 * source of truth. Callers must set `suppressReverseSync` so the
 * cascade of `layout:panelResized`/`panelToggled` events emitted while
 * the layout is being reseated does not echo back into the config.
 */
function syncLayoutFromConfig(
  layout: WmepInstance<Layout>,
  snap: ConfigurationShape,
): void {
  layout.capabilities.setTitle({ title: snap.appTitle });
  layout.capabilities.setPanelMinWidth({
    side: "left",
    minWidth: snap.layout.leftPanel.minWidth,
  });
  layout.capabilities.setPanelMinWidth({
    side: "right",
    minWidth: snap.layout.rightPanel.minWidth,
  });
  layout.capabilities.setPanelWidth({
    side: "left",
    width: snap.layout.leftPanel.defaultWidth,
  });
  layout.capabilities.setPanelWidth({
    side: "right",
    width: snap.layout.rightPanel.defaultWidth,
  });
  layout.capabilities.setPanelVisible({
    side: "left",
    visible: snap.layout.leftPanel.visible,
  });
  layout.capabilities.setPanelVisible({
    side: "right",
    visible: snap.layout.rightPanel.visible,
  });
}

/**
 * Translate a single `config:changed` path into the corresponding
 * @demo/layout capability call. The layout module's own listener
 * already covers the four panel-width paths, so we only handle the
 * leftover paths here (title, panel visibility).
 */
function applyConfigChangeToLayout(
  layout: WmepInstance<Layout>,
  path: string,
  value: unknown,
): void {
  if (path === "appTitle" && typeof value === "string") {
    layout.capabilities.setTitle({ title: value });
    return;
  }
  if (path === "layout.leftPanel.visible" && typeof value === "boolean") {
    layout.capabilities.setPanelVisible({ side: "left", visible: value });
    return;
  }
  if (path === "layout.rightPanel.visible" && typeof value === "boolean") {
    layout.capabilities.setPanelVisible({ side: "right", visible: value });
  }
}

function reactToConfigChange(
  prev: ConfigurationShape,
  next: ConfigurationShape,
): void {
  if (
    prev.counter.initial !== next.counter.initial ||
    prev.counter.step !== next.counter.step
  ) {
    void rebuildCounter();
  }
  if (prev.notes.maxNotes !== next.notes.maxNotes) {
    void rebuildNotes();
  }
  if (
    prev.clock.format !== next.clock.format ||
    prev.clock.tickIntervalMs !== next.clock.tickIntervalMs
  ) {
    void rebuildClock();
  }
}

async function rebuildCounter(): Promise<void> {
  const old = counterView;
  counterView = buildCounter();
  layoutView.setModeBody("counter", counterView.el);
  if (old) await old.destroy();
}

async function rebuildNotes(): Promise<void> {
  const old = notesView;
  notesView = buildNotes();
  layoutView.setModeBody("notes", notesView.el);
  if (old) await old.destroy();
}

async function rebuildClock(): Promise<void> {
  const old = clockView;
  clockView = buildClock();
  layoutView.setModeBody("clock", clockView.el);
  if (old) await old.destroy();
}

function applyTheme(theme: ConfigurationShape["theme"]): void {
  document.documentElement.dataset.theme = theme;
}

// =================================================================
// Small in-page widgets (kept here because they aren't wMEP modules)
// =================================================================

function createTopBarToolbar(): HTMLElement {
  const pill = (text: string): HTMLElement =>
    h("code", { className: "topbar-toolbar-pill" }, text);

  return h(
    "div",
    { className: "topbar-toolbar" },
    h("span", { className: "topbar-toolbar-label" }, "wMEP modules:"),
    pill("@demo/configuration"),
    pill("@demo/layout"),
    pill("@demo/counter"),
    pill("@demo/notes"),
    pill("@demo/clock"),
  );
}

interface InfoPanelHandle {
  el: HTMLElement;
}

function createInfoPanel(): InfoPanelHandle {
  const subtitle = h(
    "span",
    { className: "module-panel-subtitle" },
    "host logger · 0",
  );

  const clearBtn = h(
    "button",
    {
      className: "btn btn-ghost btn-sm",
      title: "Clear activity log",
      onClick: () => clearLogBuffer(),
    },
    "Clear",
  ) as HTMLButtonElement;

  const helpItems = [
    ["capabilities", "host calls module"],
    ["events", "module emits to host"],
    ["listeners", "host notifies module"],
    ["requires", "module calls host"],
    ["config", "values at construction"],
  ] as const;

  const help = h(
    "div",
    { className: "info-panel-help" },
    h(
      "p",
      null,
      "Each panel is a wMEP module in its own directory under ",
      h("code", null, "src/modules/"),
      ". They communicate through the protocol:",
    ),
    h(
      "ul",
      null,
      ...helpItems.map(([k, v]) =>
        h("li", null, h("strong", null, k), " — ", v),
      ),
    ),
  );

  const list = h("ol", { className: "log-list" });

  const renderEntries = (entries: readonly LogEntry[]): void => {
    subtitle.textContent = `host logger · ${entries.length}`;
    clearBtn.disabled = entries.length === 0;
    if (entries.length === 0) {
      replaceChildren(
        list,
        h("li", { className: "log-empty" }, "waiting for events..."),
      );
      return;
    }
    const reversed = entries.slice().reverse();
    replaceChildren(
      list,
      ...reversed.map((e) =>
        h(
          "li",
          { className: "log-item" },
          h(
            "span",
            { className: "log-time" },
            new Date(e.ts).toLocaleTimeString([], { hour12: false }),
          ),
          h("span", { className: "log-module" }, e.module),
          h("span", { className: "log-action" }, e.action),
        ),
      ),
    );
  };

  const root = h(
    "section",
    { className: "module-panel info-panel" },
    h(
      "header",
      { className: "module-panel-header" },
      h("span", { className: "module-panel-title" }, "Activity log"),
      h(
        "div",
        { className: "module-panel-header-right" },
        subtitle,
        clearBtn,
      ),
    ),
    help,
    list,
  );

  renderEntries(getLogBuffer());
  subscribeLog(() => renderEntries(getLogBuffer()));

  return { el: root };
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
  import.meta.hot.dispose(async () => {
    crossWireOff.forEach((fn) => fn());
    await Promise.all([
      counterView?.destroy(),
      notesView?.destroy(),
      clockView?.destroy(),
      configView.destroy(),
      layoutView.destroy(),
    ]);
    appRoot?.replaceChildren();
  });
}
