/**
 * @demo/configuration — boundary file
 *
 * Canonical Rule: All configuration constants and variables live
 * here. Every other module MUST refer to THIS file for its
 * relevant constants, variables, sets, presets, and tables.
 *
 * The boundary exports three things:
 *
 *   1) DEFAULT_CONFIG    immutable defaults (static reference)
 *   2) Configuration     wMEP factory + type (runtime mutable)
 *   3) ConfigurationView React component (this module's UI)
 *
 * Outside code never imports from `./configuration` or
 * `./configuration.view` directly — only from this boundary.
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createConfiguration } from "./configuration";
import { ConfigurationView as InternalView } from "./configuration.view";

// =================================================================
// 1) Canonical defaults — the single source of truth
// =================================================================

export type ThemeName = "light" | "dark";

export type ModeKey = "counter" | "notes" | "clock";

export interface ModePreset {
  key: ModeKey;
  label: string;
  icon: string;
  description: string;
}

export interface ConfigurationShape {
  // Top-level
  appTitle: string;
  theme: ThemeName;

  // Layout
  layout: {
    leftPanel: { defaultWidth: number; minWidth: number; visible: boolean };
    rightPanel: { defaultWidth: number; minWidth: number; visible: boolean };
    topBarHeight: number;
    pageHeaderHeight: number;
  };

  // Modes the layout can switch between
  modes: ModePreset[];
  initialMode: ModeKey;

  // Module-specific defaults
  counter: { initial: number; step: number };
  notes: { maxNotes: number };
  clock: { format: "12h" | "24h"; tickIntervalMs: number };
}

export const DEFAULT_CONFIG: ConfigurationShape = {
  appTitle: "wMEP Modular Demo",
  theme: "light",
  layout: {
    leftPanel: { defaultWidth: 420, minWidth: 300, visible: true },
    rightPanel: { defaultWidth: 600, minWidth: 300, visible: true },
    topBarHeight: 56,
    pageHeaderHeight: 48,
  },
  modes: [
    {
      key: "counter",
      label: "Counter",
      icon: "",
      description: "Simple counter with reactive state.",
    },
    {
      key: "notes",
      label: "Notes",
      icon: "",
      description: "Add and remove notes (CRUD pattern).",
    },
    {
      key: "clock",
      label: "Clock",
      icon: "",
      description: "Live clock driven by module events.",
    },
  ],
  initialMode: "counter",
  counter: { initial: 0, step: 1 },
  notes: { maxNotes: 50 },
  clock: { format: "24h", tickIntervalMs: 1000 },
};

// Convenience helper for nested key reads. Modules occasionally
// want a literal path like "layout.leftPanel.minWidth" — this is
// kept here so all dotted-path semantics live in one file.
export type ConfigPath =
  | "appTitle"
  | "theme"
  // layout
  | "layout.leftPanel.defaultWidth"
  | "layout.leftPanel.minWidth"
  | "layout.leftPanel.visible"
  | "layout.rightPanel.defaultWidth"
  | "layout.rightPanel.minWidth"
  | "layout.rightPanel.visible"
  | "layout.topBarHeight"
  | "layout.pageHeaderHeight"
  | "initialMode"
  // counter
  | "counter.initial"
  | "counter.step"
  // notes
  | "notes.maxNotes"
  // clock
  | "clock.format"
  | "clock.tickIntervalMs";

// =================================================================
// 2) wMEP contract — runtime, mutable, reactive
// =================================================================

export interface Configuration extends WmepModule<
  // HOST to MODULE: capabilities
  {
    /** Snapshot of the entire current configuration. */
    getAll(): ConfigurationShape;

    /** Read a leaf value by dotted path. */
    get<P extends ConfigPath>(path: P): unknown;

    /** Set a leaf value by dotted path. Emits 'config:changed'. */
    set<P extends ConfigPath>(path: P, value: unknown): void;

    /** Reset all values to DEFAULT_CONFIG. Emits 'config:reset'. */
    reset(): void;

    /** Toggle the theme between light and dark. */
    toggleTheme(): { theme: ThemeName };
  },
  // MODULE to HOST: events
  {
    "config:changed": { path: ConfigPath; value: unknown };
    "config:reset": { snapshot: ConfigurationShape };
  },
  // HOST to MODULE: listeners
  Record<string, never>,
  // MODULE to HOST: requires
  {
    logger: { write(entry: { action: string; detail?: unknown }): void };
  },
  // HOST to MODULE: config
  {
    overrides?: Partial<ConfigurationShape>;
  }
> {
  module: { name: "@demo/configuration"; version: "1.0.0" };
}

export const Configuration: WmepFactory<Configuration> = createConfiguration;

// =================================================================
// 3) Module-owned UI — every module renders its own
// =================================================================

export const ConfigurationView = InternalView;
