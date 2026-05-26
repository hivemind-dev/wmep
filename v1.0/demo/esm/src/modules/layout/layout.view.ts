/**
 * @demo/layout — module-owned UI (vanilla DOM)
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
 *       <pageBody> bodies[currentMode] </pageBody>
 *     </pageArea>
 *     <rightPanel> resize handle + {rightPanelContent} </rightPanel>
 *   </body>
 *
 * Rule 1: composed of Lego pieces (slots).
 * Rule 2: side panels resizable, min width clamped (via wMEP).
 * Rule 3: panels hidden/shown via toggle buttons.
 */

import type { WmepInstance } from "@aurorah/wmep";

import {
  DEFAULT_CONFIG,
  type ModeKey,
  type ModePreset,
} from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";
import { h, replaceChildren } from "../../lib/dom";

import { Layout, type LayoutState, type PanelSide } from "./layout.wmep";

import "./layout.scss";

export interface LayoutPanelConfig {
  visible?: boolean;
  width?: number;
  minWidth?: number;
}

export interface LayoutViewProps {
  title?: string;
  initialMode?: ModeKey;
  modes?: ModePreset[];

  leftPanel?: LayoutPanelConfig;
  rightPanel?: LayoutPanelConfig;

  topBarToolbar?: HTMLElement | null;
  topBarRightButtons?: HTMLElement | null;
  leftPanelContent?: HTMLElement | null;
  rightPanelContent?: HTMLElement | null;
  pageHeaderLeftButtons?: HTMLElement | null;
  pageHeaderRightButtons?: HTMLElement | null;
  pageToolbar?: HTMLElement | null;

  /** Initial mode bodies; can be updated later via setModeBody. */
  modeBodies?: Partial<Record<ModeKey, HTMLElement>>;

  /** Receive the constructed wMEP instance for cross-module wiring. */
  onInstance?: (instance: WmepInstance<Layout>) => void;
}

export interface LayoutViewHandle {
  el: HTMLElement;
  instance: WmepInstance<Layout>;

  setTopBarToolbar(el: HTMLElement | null): void;
  setTopBarRightButtons(el: HTMLElement | null): void;
  setLeftPanelContent(el: HTMLElement | null): void;
  setRightPanelContent(el: HTMLElement | null): void;
  setPageHeaderLeftButtons(el: HTMLElement | null): void;
  setPageHeaderRightButtons(el: HTMLElement | null): void;
  setPageToolbar(el: HTMLElement | null): void;
  setModeBody(mode: ModeKey, el: HTMLElement | null): void;

  destroy(): Promise<void>;
}

export function createLayoutView(props: LayoutViewProps = {}): LayoutViewHandle {
  const {
    title = DEFAULT_CONFIG.appTitle,
    initialMode = DEFAULT_CONFIG.initialMode,
    modes = DEFAULT_CONFIG.modes,
    leftPanel: leftCfg,
    rightPanel: rightCfg,
  } = props;

  const initialLeft = {
    visible: leftCfg?.visible ?? DEFAULT_CONFIG.layout.leftPanel.visible,
    width: leftCfg?.width ?? DEFAULT_CONFIG.layout.leftPanel.defaultWidth,
    minWidth: leftCfg?.minWidth ?? DEFAULT_CONFIG.layout.leftPanel.minWidth,
  };
  const initialRight = {
    visible: rightCfg?.visible ?? DEFAULT_CONFIG.layout.rightPanel.visible,
    width: rightCfg?.width ?? DEFAULT_CONFIG.layout.rightPanel.defaultWidth,
    minWidth: rightCfg?.minWidth ?? DEFAULT_CONFIG.layout.rightPanel.minWidth,
  };

  const instance = Layout(
    { logger: createLogger("@demo/layout") },
    {
      title,
      modes,
      initialMode,
      leftPanel: initialLeft,
      rightPanel: initialRight,
    },
  );

  const bodies: Map<ModeKey, HTMLElement> = new Map();
  for (const [k, v] of Object.entries(props.modeBodies ?? {}) as [
    ModeKey,
    HTMLElement | undefined,
  ][]) {
    if (v) bodies.set(k, v);
  }

  // ---- DOM construction ----

  const titleEl = h("span", { className: "topbar-title" }, title);

  const topbarCenter = h(
    "div",
    { className: "topbar-center" },
    props.topBarToolbar ?? null,
  );

  const leftToggle = h(
    "button",
    {
      className: `btn btn-ghost btn-sm ${initialLeft.visible ? "is-active" : ""}`,
      title: "Toggle left panel",
      onClick: () => instance.capabilities.togglePanel({ side: "left" }),
    },
    "[L]",
  );
  const rightToggle = h(
    "button",
    {
      className: `btn btn-ghost btn-sm ${initialRight.visible ? "is-active" : ""}`,
      title: "Toggle right panel",
      onClick: () => instance.capabilities.togglePanel({ side: "right" }),
    },
    "[R]",
  );

  const topbarRightSlot = h("span", { className: "topbar-right-slot" });
  if (props.topBarRightButtons) topbarRightSlot.appendChild(props.topBarRightButtons);

  const topbar = h(
    "header",
    { className: "layout-topbar" },
    h("div", { className: "topbar-left" }, titleEl),
    topbarCenter,
    h(
      "div",
      { className: "topbar-right" },
      leftToggle,
      rightToggle,
      topbarRightSlot,
    ),
  );

  // ---- side panels ----

  const leftPanelContent = h(
    "div",
    { className: "side-panel-content" },
    props.leftPanelContent ?? null,
  );
  const leftHandle = h("div", {
    className: "resize-handle resize-handle-right",
    title: `Drag to resize (min ${initialLeft.minWidth}px)`,
    onMousedown: (e) => startResize(e, "left"),
  });
  const leftAside = h(
    "aside",
    {
      className: "side-panel side-panel-left",
      style: { width: `${initialLeft.width}px` },
    },
    leftPanelContent,
    leftHandle,
  );
  if (!initialLeft.visible) leftAside.style.display = "none";

  const rightPanelContent = h(
    "div",
    { className: "side-panel-content" },
    props.rightPanelContent ?? null,
  );
  const rightHandle = h("div", {
    className: "resize-handle resize-handle-left",
    title: `Drag to resize (min ${initialRight.minWidth}px)`,
    onMousedown: (e) => startResize(e, "right"),
  });
  const rightAside = h(
    "aside",
    {
      className: "side-panel side-panel-right",
      style: { width: `${initialRight.width}px` },
    },
    rightHandle,
    rightPanelContent,
  );
  if (!initialRight.visible) rightAside.style.display = "none";

  // ---- page area ----

  const pageHeaderLeft = h(
    "div",
    { className: "page-header-left" },
    props.pageHeaderLeftButtons ?? null,
  );

  const modeButtons = new Map<ModeKey, HTMLButtonElement>();
  const pageHeaderCenter = h("div", { className: "page-header-center" });
  for (const m of modes) {
    const btn = h(
      "button",
      {
        className: `mode-btn ${m.key === initialMode ? "is-active" : ""}`,
        title: m.description,
        onClick: () => instance.capabilities.setMode({ mode: m.key }),
      },
      m.icon
        ? h("span", { className: "mode-btn-icon" }, m.icon)
        : null,
      h("span", { className: "mode-btn-label" }, m.label),
    );
    modeButtons.set(m.key, btn);
    pageHeaderCenter.appendChild(btn);
  }

  const pageHeaderRight = h(
    "div",
    { className: "page-header-right" },
    props.pageHeaderRightButtons ?? null,
  );

  const pageHeader = h(
    "div",
    { className: "page-header" },
    pageHeaderLeft,
    pageHeaderCenter,
    pageHeaderRight,
  );

  const pageToolbar = h("div", { className: "page-toolbar" });
  if (props.pageToolbar) pageToolbar.appendChild(props.pageToolbar);
  else pageToolbar.style.display = "none";

  const pageBody = h("div", { className: "page-body" });
  renderModeBody(initialMode);

  const pageArea = h(
    "main",
    { className: "page-area" },
    pageHeader,
    pageToolbar,
    pageBody,
  );

  const layoutBody = h(
    "div",
    { className: "layout-body" },
    leftAside,
    pageArea,
    rightAside,
  );

  const root = h("div", { className: "layout-root" }, topbar, layoutBody);

  // ---- helpers ----

  function renderModeBody(mode: ModeKey): void {
    const body = bodies.get(mode);
    if (body) {
      replaceChildren(pageBody, body);
    } else {
      replaceChildren(
        pageBody,
        h(
          "div",
          { className: "page-body-empty" },
          `No view registered for mode "${mode}".`,
        ),
      );
    }
  }

  function applyState(state: LayoutState): void {
    titleEl.textContent = state.title;
    leftAside.style.display = state.leftPanel.visible ? "" : "none";
    leftAside.style.width = `${state.leftPanel.width}px`;
    leftHandle.title = `Drag to resize (min ${state.leftPanel.minWidth}px)`;
    rightAside.style.display = state.rightPanel.visible ? "" : "none";
    rightAside.style.width = `${state.rightPanel.width}px`;
    rightHandle.title = `Drag to resize (min ${state.rightPanel.minWidth}px)`;
    leftToggle.classList.toggle("is-active", state.leftPanel.visible);
    rightToggle.classList.toggle("is-active", state.rightPanel.visible);

    for (const [key, btn] of modeButtons) {
      btn.classList.toggle("is-active", key === state.mode);
    }
  }

  // ---- resize handler (Rule 2) ----

  function startResize(e: MouseEvent, side: PanelSide): void {
    e.preventDefault();
    const startX = e.clientX;
    const snap = instance.capabilities.getState();
    const startWidth =
      side === "left" ? snap.leftPanel.width : snap.rightPanel.width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent): void => {
      const dx = ev.clientX - startX;
      const next = side === "left" ? startWidth + dx : startWidth - dx;
      instance.capabilities.setPanelWidth({ side, width: next });
    };
    const onUp = (): void => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ---- subscriptions ----

  const refresh = () => applyState(instance.capabilities.getState());

  const off = [
    instance.on("layout:panelToggled", refresh),
    instance.on("layout:panelResized", refresh),
    instance.on("layout:panelMinChanged", refresh),
    instance.on("layout:modeChanged", ({ mode }) => {
      renderModeBody(mode);
      refresh();
    }),
    instance.on("layout:titleChanged", refresh),
    instance.on("wmep:mounted", () => {
      refresh();
      props.onInstance?.(instance);
    }),
  ];

  return {
    el: root,
    instance,

    setTopBarToolbar: (el) => replaceChildren(topbarCenter, el),
    setTopBarRightButtons: (el) => replaceChildren(topbarRightSlot, el),
    setLeftPanelContent: (el) => replaceChildren(leftPanelContent, el),
    setRightPanelContent: (el) => replaceChildren(rightPanelContent, el),
    setPageHeaderLeftButtons: (el) => replaceChildren(pageHeaderLeft, el),
    setPageHeaderRightButtons: (el) => replaceChildren(pageHeaderRight, el),
    setPageToolbar: (el) => {
      replaceChildren(pageToolbar, el);
      pageToolbar.style.display = el ? "" : "none";
    },
    setModeBody: (mode, el) => {
      if (el) bodies.set(mode, el);
      else bodies.delete(mode);
      const current = instance.capabilities.getState().mode;
      if (current === mode) renderModeBody(mode);
    },

    destroy: async () => {
      off.forEach((fn) => fn());
      await instance.unmount("layout-view-unmount");
    },
  };
}
