/**
 * @demo/configuration — module-owned UI (vanilla DOM)
 *
 * The Configuration module renders its own settings panel. The
 * factory function constructs a wMEP instance internally, wires
 * it to the host's logger, and exposes the configuration values
 * as editable inputs. Returns a ViewHandle that the host can
 * mount, listen to, and destroy.
 *
 * Internal to the `configuration/` directory.
 */

import type { WmepInstance } from "@aurorah/wmep";

import { createLogger } from "../../lib/host";
import { h, t } from "../../lib/dom";

import {
  Configuration,
  DEFAULT_CONFIG,
  type ConfigurationShape,
} from "./configuration.wmep";

import "./configuration.scss";

export interface ConfigurationViewProps {
  /** Receive the constructed wMEP instance for cross-module wiring. */
  onInstance?: (instance: WmepInstance<Configuration>) => void;
}

export interface ConfigurationViewHandle {
  el: HTMLElement;
  instance: WmepInstance<Configuration>;
  destroy(): Promise<void>;
}

interface FieldInput {
  refresh(value: string): void;
  el: HTMLInputElement;
}

export function createConfigurationView(
  props: ConfigurationViewProps = {},
): ConfigurationViewHandle {
  const instance = Configuration(
    { logger: createLogger("@demo/configuration") },
    { overrides: undefined },
  );

  let snapshot: ConfigurationShape = structuredClonePoly(DEFAULT_CONFIG);

  const update = (
    path: Parameters<Configuration["capabilities"]["set"]>[0],
    value: unknown,
  ): void => {
    instance.capabilities.set(path, value);
  };

  // ---- inputs (we keep refs to refresh them when state changes) ----

  const fields: FieldInput[] = [];

  const text = (
    initial: string,
    onCommit: (next: string) => void,
  ): FieldInput => {
    const f = createTextInput(initial, onCommit);
    fields.push(f);
    return f;
  };

  const num = (
    initial: number,
    opts: { min?: number },
    onCommit: (next: number) => void,
  ): FieldInput => {
    const f = createNumberInput(initial, opts, onCommit);
    fields.push(f);
    return f;
  };

  // ---- DOM ----

  const appTitleField = text(snapshot.appTitle, (v) => update("appTitle", v));

  const themeBtn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => instance.capabilities.toggleTheme(),
    },
    snapshot.theme,
  );

  const leftWidthField = num(
    snapshot.layout.leftPanel.defaultWidth,
    { min: snapshot.layout.leftPanel.minWidth },
    (v) => update("layout.leftPanel.defaultWidth", v),
  );
  const leftMinField = num(
    snapshot.layout.leftPanel.minWidth,
    { min: 200 },
    (v) => update("layout.leftPanel.minWidth", v),
  );
  const rightWidthField = num(
    snapshot.layout.rightPanel.defaultWidth,
    { min: snapshot.layout.rightPanel.minWidth },
    (v) => update("layout.rightPanel.defaultWidth", v),
  );
  const rightMinField = num(
    snapshot.layout.rightPanel.minWidth,
    { min: 200 },
    (v) => update("layout.rightPanel.minWidth", v),
  );

  const counterInitialField = num(snapshot.counter.initial, {}, (v) =>
    update("counter.initial", v),
  );
  const counterStepField = num(snapshot.counter.step, { min: 1 }, (v) =>
    update("counter.step", v),
  );

  const notesMaxField = num(snapshot.notes.maxNotes, { min: 1 }, (v) =>
    update("notes.maxNotes", v),
  );

  const clockFormatBtn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () =>
        update(
          "clock.format",
          snapshot.clock.format === "24h" ? "12h" : "24h",
        ),
    },
    snapshot.clock.format,
  );
  const clockTickField = num(
    snapshot.clock.tickIntervalMs,
    { min: 100 },
    (v) => update("clock.tickIntervalMs", v),
  );

  const resetBtn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => instance.capabilities.reset(),
    },
    "Reset to defaults",
  );

  const root = h(
    "section",
    { className: "module-panel configuration-panel" },
    h(
      "header",
      { className: "module-panel-header" },
      h("span", { className: "module-panel-title" }, "Configuration"),
      h("span", { className: "module-panel-subtitle" }, "@demo/configuration"),
    ),

    row("App title", appTitleField.el),
    row("Theme", themeBtn),

    sectionTitle("Layout"),
    row("Left panel width (px)", leftWidthField.el),
    row("Left panel min width (px)", leftMinField.el),
    row("Right panel width (px)", rightWidthField.el),
    row("Right panel min width (px)", rightMinField.el),

    sectionTitle("Counter"),
    row("Initial value", counterInitialField.el),
    row("Step", counterStepField.el),

    sectionTitle("Notes"),
    row("Max notes", notesMaxField.el),

    sectionTitle("Clock"),
    row("Format", clockFormatBtn),
    row("Tick interval (ms)", clockTickField.el),

    h("div", { className: "config-actions" }, resetBtn),
  );

  // ---- subscriptions ----

  const refreshFromSnapshot = (next: ConfigurationShape): void => {
    snapshot = next;
    appTitleField.refresh(next.appTitle);
    themeBtn.textContent = next.theme;
    leftWidthField.refresh(String(next.layout.leftPanel.defaultWidth));
    leftMinField.refresh(String(next.layout.leftPanel.minWidth));
    rightWidthField.refresh(String(next.layout.rightPanel.defaultWidth));
    rightMinField.refresh(String(next.layout.rightPanel.minWidth));
    counterInitialField.refresh(String(next.counter.initial));
    counterStepField.refresh(String(next.counter.step));
    notesMaxField.refresh(String(next.notes.maxNotes));
    clockFormatBtn.textContent = next.clock.format;
    clockTickField.refresh(String(next.clock.tickIntervalMs));
  };

  const offChanged = instance.on("config:changed", () => {
    refreshFromSnapshot(instance.capabilities.getAll());
  });
  const offReset = instance.on("config:reset", ({ snapshot: snap }) => {
    refreshFromSnapshot(snap);
  });
  const offMounted = instance.on("wmep:mounted", () => {
    refreshFromSnapshot(instance.capabilities.getAll());
    props.onInstance?.(instance);
  });

  return {
    el: root,
    instance,
    destroy: async () => {
      offChanged();
      offReset();
      offMounted();
      await instance.unmount("configuration-view-unmount");
    },
  };
}

// =================================================================
// Helpers
// =================================================================

function row(label: string, control: HTMLElement): HTMLElement {
  return h(
    "div",
    { className: "config-row" },
    h("label", { className: "config-label" }, label),
    control,
  );
}

function sectionTitle(label: string): HTMLElement {
  return h("div", { className: "config-section-title" }, t(label));
}

// =================================================================
// Input helpers — commit on Enter / blur (NOT on every keystroke)
// =================================================================

function createTextInput(
  initial: string,
  onCommit: (next: string) => void,
): FieldInput {
  let last = initial;
  const el = h("input", {
    type: "text",
    className: "config-input",
    value: initial,
  });

  const commit = (): void => {
    if (el.value !== last) {
      last = el.value;
      onCommit(el.value);
    }
  };

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      el.blur();
    } else if (e.key === "Escape") {
      el.value = last;
      el.blur();
    }
  });
  el.addEventListener("blur", commit);

  return {
    el,
    refresh: (value) => {
      last = value;
      if (document.activeElement !== el) el.value = value;
    },
  };
}

function createNumberInput(
  initial: number,
  opts: { min?: number },
  onCommit: (next: number) => void,
): FieldInput {
  let last = initial;
  const el = h("input", {
    type: "text",
    inputmode: "numeric",
    className: "config-input",
    value: String(initial),
  });

  const commit = (): void => {
    const n = Number(el.value);
    if (!Number.isFinite(n)) {
      el.value = String(last);
      return;
    }
    const integer = Math.trunc(n);
    const clamped =
      opts.min !== undefined ? Math.max(opts.min, integer) : integer;
    el.value = String(clamped);
    if (clamped !== last) {
      last = clamped;
      onCommit(clamped);
    }
  };

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      el.blur();
    } else if (e.key === "Escape") {
      el.value = String(last);
      el.blur();
    }
  });
  el.addEventListener("blur", commit);

  return {
    el,
    refresh: (value) => {
      const n = Number(value);
      last = Number.isFinite(n) ? n : last;
      if (document.activeElement !== el) el.value = value;
    },
  };
}

function structuredClonePoly<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
