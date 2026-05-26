/**
 * @demo/layout — boundary file
 *
 * The top-level UI/UX layout module.
 *
 * Canonical Rules (from layout.ts spec):
 *   1) The layout must all be composed of the assembly of
 *      components, like Lego.
 *   2) The side panels must be resizable fully but have a
 *      minimum width of N (here N comes from @demo/configuration).
 *   3) The side panels must be able to be hidden/shown by user
 *      action (toggle buttons).
 *
 * Provisions:
 *   - Top bar:     left-side Title, center toolbar, right-side buttons
 *   - Side panel:  left-side panel, right-side panel
 *   - Page area:   page header, page toolbar, page body
 *   - Page header: left-buttons, center switch-mode buttons,
 *                  right-side buttons
 *
 * The boundary exports the contract, the factory, and the Svelte
 * view component that renders the whole shell.
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import type { ModeKey, ModePreset } from "../configuration/configuration.wmep";

import { createLayout } from "./layout";

export type PanelSide = "left" | "right";

export interface PanelState {
  visible: boolean;
  width: number;
  minWidth: number;
}

export interface LayoutState {
  title: string;
  leftPanel: PanelState;
  rightPanel: PanelState;
  mode: ModeKey;
  modes: ModePreset[];
}

export interface Layout
  extends WmepModule<
    {
      getState(): LayoutState;

      /** Show/hide a side panel (Rule 3). */
      togglePanel(p: { side: PanelSide }): { visible: boolean };
      setPanelVisible(p: { side: PanelSide; visible: boolean }): void;

      /** Resize a panel — clamped to its minimum width (Rule 2). */
      setPanelWidth(p: { side: PanelSide; width: number }): { width: number };

      /** Set the minimum panel width (Rule 2 — N is configurable). */
      setPanelMinWidth(p: { side: PanelSide; minWidth: number }): {
        minWidth: number;
        width: number;
      };

      /** Switch the active page-body mode. */
      setMode(p: { mode: ModeKey }): { mode: ModeKey };

      /** Replace the title shown in the top bar. */
      setTitle(p: { title: string }): { title: string };
    },
    {
      "layout:panelToggled": { side: PanelSide; visible: boolean };
      "layout:panelResized": { side: PanelSide; width: number };
      "layout:panelMinChanged": { side: PanelSide; minWidth: number };
      "layout:modeChanged": { mode: ModeKey };
      "layout:titleChanged": { title: string };
    },
    {
      /** Sent by the host when @demo/configuration emits a change. */
      "config:changed": { path: string; value: unknown };
    },
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    {
      title: string;
      modes: ModePreset[];
      initialMode: ModeKey;
      leftPanel: { visible: boolean; width: number; minWidth: number };
      rightPanel: { visible: boolean; width: number; minWidth: number };
    }
  > {
  module: { name: "@demo/layout"; version: "1.0.0" };
}

export const Layout: WmepFactory<Layout> = createLayout;

export { default as LayoutView } from "./layout.view.svelte";
