/**
 * @demo/layout — module-owned UI (Lit 3)
 *
 * Implements the Provisions:
 *
 *   <topbar>
 *     <left> title </left>
 *     <center> {topBarToolbar} </center>
 *     <right> {topBarRightButtons} + panel toggles </right>
 *   </topbar>
 *
 *   <body>
 *     <leftPanel> {leftPanelContent} + resize handle </leftPanel>
 *     <pageArea>
 *       <pageHeader>
 *         <left> {pageHeaderLeftButtons} </left>
 *         <center> mode switch buttons </center>
 *         <right> {pageHeaderRightButtons} </right>
 *       </pageHeader>
 *       <pageToolbar> {pageToolbar} </pageToolbar>
 *       <pageBody> modeBodies[currentMode] </pageBody>
 *     </pageArea>
 *     <rightPanel> resize handle + {rightPanelContent} </rightPanel>
 *   </body>
 *
 * Rule 1: composed of Lego pieces — slot HTMLElements are passed
 *         in as Lit properties (NOT shadow-DOM <slot>) so the
 *         host can swap nodes imperatively at runtime.
 * Rule 2: side panels resizable, min width clamped (via wMEP).
 * Rule 3: panels hidden/shown via toggle buttons.
 */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { WmepInstance } from "@aurorah/wmep";

import {
  DEFAULT_CONFIG,
  type ModeKey,
  type ModePreset,
} from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Layout, type LayoutState, type PanelSide } from "./layout.wmep";

import "./layout.scss";

export type LayoutInstanceCallback = (
  instance: WmepInstance<Layout>,
) => void;

export interface LayoutPanelConfig {
  visible?: boolean;
  width?: number;
  minWidth?: number;
}

@customElement("demo-layout-view")
export class LayoutView extends LitElement {
  // ---- construction-time inputs (read in connectedCallback) ----

  @property({ attribute: false }) title = DEFAULT_CONFIG.appTitle;
  @property({ attribute: false }) initialMode: ModeKey =
    DEFAULT_CONFIG.initialMode;
  @property({ attribute: false }) modes: ModePreset[] = DEFAULT_CONFIG.modes;
  @property({ attribute: false }) leftPanel: LayoutPanelConfig | undefined;
  @property({ attribute: false }) rightPanel: LayoutPanelConfig | undefined;

  // ---- slotted content (HTMLElement references) ----

  @property({ attribute: false }) topBarToolbar: HTMLElement | null = null;
  @property({ attribute: false }) topBarRightButtons: HTMLElement | null =
    null;
  @property({ attribute: false }) leftPanelContent: HTMLElement | null = null;
  @property({ attribute: false }) rightPanelContent: HTMLElement | null = null;
  @property({ attribute: false }) pageHeaderLeftButtons: HTMLElement | null =
    null;
  @property({ attribute: false }) pageHeaderRightButtons: HTMLElement | null =
    null;
  @property({ attribute: false }) pageToolbar: HTMLElement | null = null;
  @property({ attribute: false }) modeBodies: Partial<
    Record<ModeKey, HTMLElement>
  > = {};

  /** Function callback for the host to grab the wMEP instance. */
  onInstance: LayoutInstanceCallback | null = null;

  // ---- internal reactive state mirrored from the wMEP module ----

  @state() private layoutState: LayoutState | null = null;

  private instance: WmepInstance<Layout> | null = null;
  private unsubs: Array<() => void> = [];

  // Light DOM so cascaded SCSS applies.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    const leftCfg = this.leftPanel;
    const rightCfg = this.rightPanel;

    const left = {
      visible: leftCfg?.visible ?? DEFAULT_CONFIG.layout.leftPanel.visible,
      width: leftCfg?.width ?? DEFAULT_CONFIG.layout.leftPanel.defaultWidth,
      minWidth: leftCfg?.minWidth ?? DEFAULT_CONFIG.layout.leftPanel.minWidth,
    };
    const right = {
      visible: rightCfg?.visible ?? DEFAULT_CONFIG.layout.rightPanel.visible,
      width: rightCfg?.width ?? DEFAULT_CONFIG.layout.rightPanel.defaultWidth,
      minWidth:
        rightCfg?.minWidth ?? DEFAULT_CONFIG.layout.rightPanel.minWidth,
    };

    const instance = Layout(
      { logger: createLogger("@demo/layout") },
      {
        title: this.title,
        modes: this.modes,
        initialMode: this.initialMode,
        leftPanel: left,
        rightPanel: right,
      },
    );
    this.instance = instance;
    this.layoutState = instance.capabilities.getState();

    const refresh = () => {
      this.layoutState = instance.capabilities.getState();
    };

    this.unsubs.push(
      instance.on("layout:panelToggled", refresh),
      instance.on("layout:panelResized", refresh),
      instance.on("layout:panelMinChanged", refresh),
      instance.on("layout:modeChanged", refresh),
      instance.on("layout:titleChanged", refresh),
      instance.on("wmep:mounted", () => {
        refresh();
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
    if (inst) void inst.unmount("layout-view-disconnect");
  }

  // ---- resize handler (Rule 2) ----

  private startResize = (side: PanelSide) =>
    (e: MouseEvent): void => {
      e.preventDefault();
      const inst = this.instance;
      if (!inst) return;

      const startX = e.clientX;
      const snap = inst.capabilities.getState();
      const startWidth =
        side === "left" ? snap.leftPanel.width : snap.rightPanel.width;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent): void => {
        const dx = ev.clientX - startX;
        const next = side === "left" ? startWidth + dx : startWidth - dx;
        inst.capabilities.setPanelWidth({ side, width: next });
      };
      const onUp = (): void => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

  // ---- helpers used by templates ----

  private toggle = (side: PanelSide): void => {
    this.instance?.capabilities.togglePanel({ side });
  };

  private setMode = (mode: ModeKey): void => {
    this.instance?.capabilities.setMode({ mode });
  };

  protected override render(): TemplateResult {
    const state = this.layoutState;
    if (!state) {
      return html`<div class="layout-root"></div>`;
    }

    const body =
      this.modeBodies[state.mode] ??
      html`<div class="page-body-empty">
        No view registered for mode "${state.mode}".
      </div>`;

    return html`
      <div class="layout-root">
        <header class="layout-topbar">
          <div class="topbar-left">
            <span class="topbar-title">${state.title}</span>
          </div>
          <div class="topbar-center">${this.topBarToolbar ?? nothing}</div>
          <div class="topbar-right">
            <button
              class="btn btn-ghost btn-sm ${state.leftPanel.visible
                ? "is-active"
                : ""}"
              title="Toggle left panel"
              @click=${() => this.toggle("left")}
            >
              [L]
            </button>
            <button
              class="btn btn-ghost btn-sm ${state.rightPanel.visible
                ? "is-active"
                : ""}"
              title="Toggle right panel"
              @click=${() => this.toggle("right")}
            >
              [R]
            </button>
            ${this.topBarRightButtons ?? nothing}
          </div>
        </header>

        <div class="layout-body">
          ${state.leftPanel.visible
            ? html`
                <aside
                  class="side-panel side-panel-left"
                  style="width: ${state.leftPanel.width}px"
                >
                  <div class="side-panel-content">
                    ${this.leftPanelContent ?? nothing}
                  </div>
                  <div
                    class="resize-handle resize-handle-right"
                    title="Drag to resize (min ${state.leftPanel.minWidth}px)"
                    @mousedown=${this.startResize("left")}
                  ></div>
                </aside>
              `
            : nothing}

          <main class="page-area">
            <div class="page-header">
              <div class="page-header-left">
                ${this.pageHeaderLeftButtons ?? nothing}
              </div>
              <div class="page-header-center">
                ${state.modes.map(
                  (m) => html`
                    <button
                      class="mode-btn ${state.mode === m.key
                        ? "is-active"
                        : ""}"
                      title=${m.description}
                      @click=${() => this.setMode(m.key)}
                    >
                      ${m.icon
                        ? html`<span class="mode-btn-icon">${m.icon}</span>`
                        : nothing}
                      <span class="mode-btn-label">${m.label}</span>
                    </button>
                  `,
                )}
              </div>
              <div class="page-header-right">
                ${this.pageHeaderRightButtons ?? nothing}
              </div>
            </div>

            ${this.pageToolbar
              ? html`<div class="page-toolbar">${this.pageToolbar}</div>`
              : nothing}

            <div class="page-body">${body}</div>
          </main>

          ${state.rightPanel.visible
            ? html`
                <aside
                  class="side-panel side-panel-right"
                  style="width: ${state.rightPanel.width}px"
                >
                  <div
                    class="resize-handle resize-handle-left"
                    title="Drag to resize (min ${state.rightPanel.minWidth}px)"
                    @mousedown=${this.startResize("right")}
                  ></div>
                  <div class="side-panel-content">
                    ${this.rightPanelContent ?? nothing}
                  </div>
                </aside>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "demo-layout-view": LayoutView;
  }
}
