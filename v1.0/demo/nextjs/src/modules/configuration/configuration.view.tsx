/**
 * @demo/configuration — module-owned UI
 *
 * The Configuration module renders its own settings panel. The
 * component constructs a wMEP instance internally, wires it to
 * the host's logger, and exposes the configuration values as
 * editable inputs.
 *
 * Internal to the `configuration/` directory.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import type { WmepInstance } from "@aurorah/wmep";
import { createLogger } from "../../lib/host";

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

export function ConfigurationView({
  onInstance,
}: ConfigurationViewProps): React.ReactElement {
  const [snapshot, setSnapshot] = useState<ConfigurationShape>(() =>
    structuredClonePoly(DEFAULT_CONFIG),
  );
  const instanceRef = useRef<WmepInstance<Configuration> | null>(null);

  // Stable ref to `onInstance`. The wMEP instance is created exactly
  // once per mount; we read the latest callback through the ref so a
  // changing `onInstance` prop reference does not trigger a re-mount
  // (and therefore does not produce a stale instance handed back to
  // the host).
  const stableOnInstance = useRef(onInstance);
  stableOnInstance.current = onInstance;

  useEffect(() => {
    const instance = Configuration(
      { logger: createLogger("@demo/configuration") },
      { overrides: undefined },
    );
    instanceRef.current = instance;

    const offChanged = instance.on("config:changed", () => {
      setSnapshot(instance.capabilities.getAll());
    });
    const offReset = instance.on("config:reset", ({ snapshot: snap }) => {
      setSnapshot(snap);
    });
    const offMounted = instance.on("wmep:mounted", () => {
      setSnapshot(instance.capabilities.getAll());
      stableOnInstance.current?.(instance);
    });

    return () => {
      offChanged();
      offReset();
      offMounted();
      void instance.unmount("configuration-view-unmount");
    };
    // Construct once per mount; subsequent prop changes don't re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (path: Parameters<Configuration["capabilities"]["set"]>[0], value: unknown) => {
    instanceRef.current?.capabilities.set(path, value);
  };

  return (
    <section className="module-panel configuration-panel">
      <header className="module-panel-header">
        <span className="module-panel-title">Configuration</span>
        <span className="module-panel-subtitle">@demo/configuration</span>
      </header>

      <div className="config-row">
        <label className="config-label">App title</label>
        <TextInput
          value={snapshot.appTitle}
          onCommit={(v) => update("appTitle", v)}
        />
      </div>

      <div className="config-row">
        <label className="config-label">Theme</label>
        <button
          className="btn btn-ghost"
          onClick={() => instanceRef.current?.capabilities.toggleTheme()}
        >
          {snapshot.theme}
        </button>
      </div>

      <div className="config-section-title">Layout</div>

      <div className="config-row">
        <label className="config-label">Left panel width (px)</label>
        <NumberInput
          value={snapshot.layout.leftPanel.defaultWidth}
          min={snapshot.layout.leftPanel.minWidth}
          onCommit={(v) => update("layout.leftPanel.defaultWidth", v)}
        />
      </div>

      <div className="config-row">
        <label className="config-label">Left panel min width (px)</label>
        <NumberInput
          value={snapshot.layout.leftPanel.minWidth}
          min={200}
          onCommit={(v) => update("layout.leftPanel.minWidth", v)}
        />
      </div>

      <div className="config-row">
        <label className="config-label">Right panel width (px)</label>
        <NumberInput
          value={snapshot.layout.rightPanel.defaultWidth}
          min={snapshot.layout.rightPanel.minWidth}
          onCommit={(v) => update("layout.rightPanel.defaultWidth", v)}
        />
      </div>

      <div className="config-row">
        <label className="config-label">Right panel min width (px)</label>
        <NumberInput
          value={snapshot.layout.rightPanel.minWidth}
          min={200}
          onCommit={(v) => update("layout.rightPanel.minWidth", v)}
        />
      </div>

      {/* ===== @demo/counter ===== */}
      <div className="config-section-title">Counter</div>

      <div className="config-row">
        <label className="config-label">Initial value</label>
        <NumberInput
          value={snapshot.counter.initial}
          onCommit={(v) => update("counter.initial", v)}
        />
      </div>

      <div className="config-row">
        <label className="config-label">Step</label>
        <NumberInput
          value={snapshot.counter.step}
          min={1}
          onCommit={(v) => update("counter.step", v)}
        />
      </div>

      {/* ===== @demo/notes ===== */}
      <div className="config-section-title">Notes</div>

      <div className="config-row">
        <label className="config-label">Max notes</label>
        <NumberInput
          value={snapshot.notes.maxNotes}
          min={1}
          onCommit={(v) => update("notes.maxNotes", v)}
        />
      </div>

      {/* ===== @demo/clock ===== */}
      <div className="config-section-title">Clock</div>

      <div className="config-row">
        <label className="config-label">Format</label>
        <button
          className="btn btn-ghost"
          onClick={() =>
            update(
              "clock.format",
              snapshot.clock.format === "24h" ? "12h" : "24h",
            )
          }
        >
          {snapshot.clock.format}
        </button>
      </div>

      <div className="config-row">
        <label className="config-label">Tick interval (ms)</label>
        <NumberInput
          value={snapshot.clock.tickIntervalMs}
          min={100}
          onCommit={(v) => update("clock.tickIntervalMs", v)}
        />
      </div>

      <div className="config-actions">
        <button
          className="btn btn-ghost"
          onClick={() => instanceRef.current?.capabilities.reset()}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}

// =================================================================
// Input helpers — commit on Enter / blur (NOT on every keystroke)
//
// Both inputs use type="text" so the browser's number-spinner
// up/down buttons never appear. Validation and clamping happen
// only when the user signals "I'm done" (Enter or blur). Escape
// reverts the draft.
// =================================================================

interface TextInputProps {
  value: string;
  onCommit: (next: string) => void;
}

function TextInput({ value, onCommit }: TextInputProps): React.ReactElement {
  const [draft, setDraft] = useState<string>(value);

  // Re-sync when the external value changes (e.g., reset to defaults).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      type="text"
      className="config-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onBlur={commit}
    />
  );
}

interface NumberInputProps {
  value: number;
  min?: number;
  onCommit: (next: number) => void;
}

function NumberInput({
  value,
  min,
  onCommit,
}: NumberInputProps): React.ReactElement {
  const [draft, setDraft] = useState<string>(() => String(value));

  // Re-sync when the external value changes (e.g., reset to defaults
  // or another module updated this same config path).
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (): void => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const integer = Math.trunc(n);
    const clamped = min !== undefined ? Math.max(min, integer) : integer;
    // Always normalise the draft to the clamped value so the user
    // sees the actually-applied number after committing.
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className="config-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(String(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onBlur={commit}
    />
  );
}

function structuredClonePoly<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
