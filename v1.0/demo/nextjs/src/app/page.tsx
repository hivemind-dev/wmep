/**
 * Main demo page
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
 * TRUTH for every module's config; this page subscribes to its
 * "config:changed" / "config:reset" events and re-feeds the values
 * back into each module's view as React props. Each view re-mounts
 * its wMEP instance with the new config (the HOST-to-MODULE config
 * slot is by definition construction-time).
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

"use client";

import { useEffect, useRef, useState } from "react";

import type { WmepInstance } from "@aurorah/wmep";

import {
  Configuration,
  ConfigurationView,
  DEFAULT_CONFIG,
  type ConfigurationShape,
} from "@/modules/configuration/configuration.wmep";
import { Layout, LayoutView } from "@/modules/layout/layout.wmep";
import { CounterView } from "@/modules/counter/counter.wmep";
import { NotesView } from "@/modules/notes/notes.wmep";
import { ClockView } from "@/modules/clock/clock.wmep";

import {
  type LogEntry,
  clearLogBuffer,
  getLogBuffer,
  subscribeLog,
} from "@/lib/host";

import "./page.scss";

export default function Page(): React.ReactElement {
  const configRef = useRef<WmepInstance<Configuration> | null>(null);
  const layoutRef = useRef<WmepInstance<Layout> | null>(null);
  const [bothReady, setBothReady] = useState(false);

  // Live snapshot of the entire configuration. Updated on every
  // "config:changed" / "config:reset" event from the Configuration
  // module. Drives the props for Counter / Notes / Clock views.
  const [configSnapshot, setConfigSnapshot] =
    useState<ConfigurationShape>(DEFAULT_CONFIG);

  // Wire @demo/configuration -> @demo/layout AND keep React state
  // in sync with the Configuration module so other module views
  // can be re-fed their configs as props.
  useEffect(() => {
    if (!bothReady) return;
    const cfg = configRef.current;
    const layout = layoutRef.current;
    if (!cfg || !layout) return;

    setConfigSnapshot(cfg.capabilities.getAll());

    const offChanged = cfg.on("config:changed", ({ path, value }) => {
      layout.notify("config:changed", { path: String(path), value });
      setConfigSnapshot(cfg.capabilities.getAll());
    });
    const offReset = cfg.on("config:reset", ({ snapshot }) => {
      setConfigSnapshot(snapshot);
    });

    // Reverse direction: when the user drags a resize handle the
    // Layout module emits "layout:panelResized" on every mousemove.
    // Mirror the live width into the Configuration module so the
    // input next to "Left/Right panel width (px)" updates in real
    // time. The dedup check prevents the cfg -> layout -> cfg loop.
    const offResized = layout.on("layout:panelResized", ({ side, width }) => {
      const path =
        side === "left"
          ? ("layout.leftPanel.defaultWidth" as const)
          : ("layout.rightPanel.defaultWidth" as const);
      const current = cfg.capabilities.get(path);
      if (current !== width) {
        cfg.capabilities.set(path, width);
      }
    });

    return () => {
      offChanged();
      offReset();
      offResized();
    };
  }, [bothReady]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = configSnapshot.theme;
  }, [configSnapshot.theme]);

  const onConfigInstance = (inst: WmepInstance<Configuration>) => {
    configRef.current = inst;
    if (layoutRef.current) setBothReady(true);
  };
  const onLayoutInstance = (inst: WmepInstance<Layout>) => {
    layoutRef.current = inst;
    if (configRef.current) setBothReady(true);
  };

  return (
    <LayoutView
      onInstance={onLayoutInstance}
      leftPanelContent={<ConfigurationView onInstance={onConfigInstance} />}
      rightPanelContent={<InfoPanel />}
      topBarToolbar={<TopBarToolbar />}
      modeBodies={{
        // `key` is derived from the config so that changing a value
        // in the Configuration panel forces React to fully re-mount
        // the module view. The wMEP module is then constructed
        // afresh with the new config (HOST-to-MODULE construction
        // slot), and every piece of view-local React state is
        // re-initialised from those new props.
        counter: (
          <CounterView
            key={`counter:${configSnapshot.counter.initial}:${configSnapshot.counter.step}`}
            initial={configSnapshot.counter.initial}
            step={configSnapshot.counter.step}
          />
        ),
        notes: (
          <NotesView
            key={`notes:${configSnapshot.notes.maxNotes}`}
            maxNotes={configSnapshot.notes.maxNotes}
          />
        ),
        clock: (
          <ClockView
            key={`clock:${configSnapshot.clock.format}:${configSnapshot.clock.tickIntervalMs}`}
            format={configSnapshot.clock.format}
            tickIntervalMs={configSnapshot.clock.tickIntervalMs}
          />
        ),
      }}
    />
  );
}

// =================================================================
// Small in-page widgets (kept here because they aren't wMEP modules)
// =================================================================

function TopBarToolbar(): React.ReactElement {
  return (
    <div className="topbar-toolbar">
      <span className="topbar-toolbar-label">wMEP modules:</span>
      <code className="topbar-toolbar-pill">@demo/configuration</code>
      <code className="topbar-toolbar-pill">@demo/layout</code>
      <code className="topbar-toolbar-pill">@demo/counter</code>
      <code className="topbar-toolbar-pill">@demo/notes</code>
      <code className="topbar-toolbar-pill">@demo/clock</code>
    </div>
  );
}

function InfoPanel(): React.ReactElement {
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogBuffer()]);

  useEffect(() => {
    return subscribeLog(() => setEntries([...getLogBuffer()]));
  }, []);

  return (
    <section className="module-panel info-panel">
      <header className="module-panel-header">
        <span className="module-panel-title">Activity log</span>
        <div className="module-panel-header-right">
          <span className="module-panel-subtitle">
            host logger &middot; {entries.length}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => clearLogBuffer()}
            disabled={entries.length === 0}
            title="Clear activity log"
          >
            Clear
          </button>
        </div>
      </header>

      <div className="info-panel-help">
        <p>
          Each panel is a wMEP module in its own directory under{" "}
          <code>src/modules/</code>. They communicate through the protocol:
        </p>
        <ul>
          <li>
            <strong>capabilities</strong> &mdash; host calls module
          </li>
          <li>
            <strong>events</strong> &mdash; module emits to host
          </li>
          <li>
            <strong>listeners</strong> &mdash; host notifies module
          </li>
          <li>
            <strong>requires</strong> &mdash; module calls host
          </li>
          <li>
            <strong>config</strong> &mdash; values at construction
          </li>
        </ul>
      </div>

      <ol className="log-list">
        {entries.length === 0 ? (
          <li className="log-empty">waiting for events...</li>
        ) : (
          entries
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={`${e.ts}-${i}`} className="log-item">
                <span className="log-time">
                  {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className="log-module">{e.module}</span>
                <span className="log-action">{e.action}</span>
              </li>
            ))
        )}
      </ol>
    </section>
  );
}
