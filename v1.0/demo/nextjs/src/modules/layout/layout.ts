/**
 * @demo/layout — internal implementation
 *
 * Pure state machine for the layout shell. The React component
 * in layout.view.tsx reads this state and renders the actual
 * top-bar / side-panels / page-area DOM.
 *
 * Internal to the `layout/` directory.
 */

import { createWmepModule } from "@aurorah/wmep";
import type { Layout, LayoutState, PanelState, PanelSide } from "./layout.wmep";
import type { ModeKey } from "../configuration/configuration.wmep";

const clampWidth = (value: number, min: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min;

export const createLayout = createWmepModule<Layout>(
  ({ requires, config, emit }) => {
    let title = config.title;
    let mode: ModeKey = config.initialMode;
    const modes = [...config.modes];

    const left: PanelState = {
      visible: config.leftPanel.visible,
      width: clampWidth(config.leftPanel.width, config.leftPanel.minWidth),
      minWidth: config.leftPanel.minWidth,
    };
    const right: PanelState = {
      visible: config.rightPanel.visible,
      width: clampWidth(config.rightPanel.width, config.rightPanel.minWidth),
      minWidth: config.rightPanel.minWidth,
    };

    const log = (
      action: string,
      detail?: Record<string, unknown>,
    ): void => {
      requires.logger.write({ action, detail });
    };

    const sideRef = (side: PanelSide): PanelState =>
      side === "left" ? left : right;

    const snapshot = (): LayoutState => ({
      title,
      leftPanel: { ...left },
      rightPanel: { ...right },
      mode,
      modes: modes.map((m) => ({ ...m })),
    });

    return {
      capabilities: {
        getState: () => snapshot(),

        togglePanel: ({ side }) => {
          const panel = sideRef(side);
          panel.visible = !panel.visible;
          log("layout:togglePanel", { side, visible: panel.visible });
          emit("layout:panelToggled", { side, visible: panel.visible });
          return { visible: panel.visible };
        },

        setPanelVisible: ({ side, visible }) => {
          const panel = sideRef(side);
          if (panel.visible === visible) return;
          panel.visible = visible;
          log("layout:setPanelVisible", { side, visible });
          emit("layout:panelToggled", { side, visible });
        },

        setPanelWidth: ({ side, width }) => {
          const panel = sideRef(side);
          panel.width = clampWidth(width, panel.minWidth);
          log("layout:setPanelWidth", { side, width: panel.width });
          emit("layout:panelResized", { side, width: panel.width });
          return { width: panel.width };
        },

        setPanelMinWidth: ({ side, minWidth }) => {
          const panel = sideRef(side);
          panel.minWidth = Math.max(0, Math.floor(minWidth));
          if (panel.width < panel.minWidth) panel.width = panel.minWidth;
          log("layout:setPanelMinWidth", {
            side,
            minWidth: panel.minWidth,
            width: panel.width,
          });
          emit("layout:panelMinChanged", { side, minWidth: panel.minWidth });
          emit("layout:panelResized", { side, width: panel.width });
          return { minWidth: panel.minWidth, width: panel.width };
        },

        setMode: ({ mode: next }) => {
          if (!modes.some((m) => m.key === next)) {
            throw new Error(`Unknown mode: ${next}`);
          }
          mode = next;
          log("layout:setMode", { mode: next });
          emit("layout:modeChanged", { mode: next });
          return { mode: next };
        },

        setTitle: ({ title: next }) => {
          title = next;
          log("layout:setTitle", { title: next });
          emit("layout:titleChanged", { title: next });
          return { title: next };
        },
      },

      listeners: {
        "config:changed": ({ path, value }) => {
          log("layout:configChanged", { path, value });
          if (typeof value !== "number") return;
          switch (path) {
            case "layout.leftPanel.minWidth": {
              left.minWidth = value;
              if (left.width < value) {
                left.width = value;
                emit("layout:panelResized", { side: "left", width: value });
              }
              emit("layout:panelMinChanged", { side: "left", minWidth: value });
              break;
            }
            case "layout.rightPanel.minWidth": {
              right.minWidth = value;
              if (right.width < value) {
                right.width = value;
                emit("layout:panelResized", { side: "right", width: value });
              }
              emit("layout:panelMinChanged", { side: "right", minWidth: value });
              break;
            }
            case "layout.leftPanel.defaultWidth": {
              left.width = clampWidth(value, left.minWidth);
              emit("layout:panelResized", { side: "left", width: left.width });
              break;
            }
            case "layout.rightPanel.defaultWidth": {
              right.width = clampWidth(value, right.minWidth);
              emit("layout:panelResized", { side: "right", width: right.width });
              break;
            }
            default:
              break;
          }
        },
      },

      onMount: () => {
        log("layout:mount", { snapshot: snapshot() });
        return () => {
          log("layout:unmount");
        };
      },
    };
  },
);
