/**
 * @demo/configuration — internal implementation
 *
 * Owns the runtime configuration state. Other modules consume it
 * via their `requires.config` slot OR by reading the static
 * DEFAULT_CONFIG snapshot from the boundary.
 *
 * Internal to the `configuration/` directory; never imported from
 * outside.
 */

import { createWmepModule } from "@aurorah/wmep";
import {
  DEFAULT_CONFIG,
  type ConfigPath,
  type Configuration,
  type ConfigurationShape,
  type ThemeName,
} from "./configuration.wmep";

const PATHS: ReadonlyArray<ConfigPath> = [
  "appTitle",
  "theme",
  "layout.leftPanel.defaultWidth",
  "layout.leftPanel.minWidth",
  "layout.leftPanel.visible",
  "layout.rightPanel.defaultWidth",
  "layout.rightPanel.minWidth",
  "layout.rightPanel.visible",
  "layout.topBarHeight",
  "layout.pageHeaderHeight",
  "initialMode",
  "counter.initial",
  "counter.step",
  "notes.maxNotes",
  "clock.format",
  "clock.tickIntervalMs",
] as const;

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readPath(obj: ConfigurationShape, path: ConfigPath): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
    obj as unknown,
  );
}

function writePath(obj: ConfigurationShape, path: ConfigPath, value: unknown): void {
  const parts = path.split(".");
  const last = parts.pop()!;
  const target = parts.reduce<Record<string, unknown>>(
    (acc, key) => acc[key] as Record<string, unknown>,
    obj as unknown as Record<string, unknown>,
  );
  target[last] = value;
}

export const createConfiguration = createWmepModule<Configuration>(
  ({ requires, config, emit }) => {
    let state: ConfigurationShape = {
      ...clone(DEFAULT_CONFIG),
      ...(config.overrides ?? {}),
    };

    const log = (
      action: string,
      detail?: Record<string, unknown>,
    ): void => {
      requires.logger.write({ action, detail });
    };

    return {
      capabilities: {
        getAll: () => clone(state),

        get: (path) => {
          if (!PATHS.includes(path as ConfigPath)) {
            throw new Error(`Unknown config path: ${path}`);
          }
          return readPath(state, path);
        },

        set: (path, value) => {
          if (!PATHS.includes(path as ConfigPath)) {
            throw new Error(`Unknown config path: ${path}`);
          }
          writePath(state, path, value);
          log("configuration:set", { path, value });
          emit("config:changed", { path, value });
        },

        reset: () => {
          state = clone(DEFAULT_CONFIG);
          log("configuration:reset");
          emit("config:reset", { snapshot: clone(state) });
        },

        toggleTheme: () => {
          const next: ThemeName = state.theme === "light" ? "dark" : "light";
          state.theme = next;
          log("configuration:toggleTheme", { theme: next });
          emit("config:changed", { path: "theme", value: next });
          return { theme: next };
        },
      },

      onMount: () => {
        log("configuration:mount", { snapshot: clone(state) });
        return () => {
          log("configuration:unmount");
        };
      },
    };
  },
);
