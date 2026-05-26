/**
 * @demo/layout — module-owned UI
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
 * Rule 1: composed of Lego pieces (slots).
 * Rule 2: side panels resizable, min width clamped (via wMEP).
 * Rule 3: panels hidden/shown via toggle buttons.
 */

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG, type ModeKey } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Layout, type LayoutState, type PanelSide } from "./layout.wmep";

import "./layout.scss";

export interface LayoutViewProps {
  title?: string;
  initialMode?: ModeKey;
  modes?: typeof DEFAULT_CONFIG.modes;

  leftPanel?: {
    visible?: boolean;
    width?: number;
    minWidth?: number;
  };
  rightPanel?: {
    visible?: boolean;
    width?: number;
    minWidth?: number;
  };

  // Lego slots
  topBarToolbar?: ReactNode;
  topBarRightButtons?: ReactNode;
  leftPanelContent?: ReactNode;
  rightPanelContent?: ReactNode;
  pageHeaderLeftButtons?: ReactNode;
  pageHeaderRightButtons?: ReactNode;
  pageToolbar?: ReactNode;
  modeBodies: Partial<Record<ModeKey, ReactNode>>;

  /** Receive the constructed wMEP instance (for cross-module wiring). */
  onInstance?: (instance: WmepInstance<Layout>) => void;
}

export function LayoutView(props: LayoutViewProps): React.ReactElement {
  const {
    title = DEFAULT_CONFIG.appTitle,
    initialMode = DEFAULT_CONFIG.initialMode,
    modes = DEFAULT_CONFIG.modes,
    leftPanel: leftCfg,
    rightPanel: rightCfg,
    topBarToolbar,
    topBarRightButtons,
    leftPanelContent,
    rightPanelContent,
    pageHeaderLeftButtons,
    pageHeaderRightButtons,
    pageToolbar,
    modeBodies,
    onInstance,
  } = props;

  const [state, setState] = useState<LayoutState>(() => ({
    title,
    leftPanel: {
      visible: leftCfg?.visible ?? DEFAULT_CONFIG.layout.leftPanel.visible,
      width: leftCfg?.width ?? DEFAULT_CONFIG.layout.leftPanel.defaultWidth,
      minWidth: leftCfg?.minWidth ?? DEFAULT_CONFIG.layout.leftPanel.minWidth,
    },
    rightPanel: {
      visible: rightCfg?.visible ?? DEFAULT_CONFIG.layout.rightPanel.visible,
      width: rightCfg?.width ?? DEFAULT_CONFIG.layout.rightPanel.defaultWidth,
      minWidth: rightCfg?.minWidth ?? DEFAULT_CONFIG.layout.rightPanel.minWidth,
    },
    mode: initialMode,
    modes,
  }));

  const instanceRef = useRef<WmepInstance<Layout> | null>(null);
  const stableOnInstance = useRef(onInstance);
  stableOnInstance.current = onInstance;

  useEffect(() => {
    const inst = Layout(
      { logger: createLogger("@demo/layout") },
      {
        title,
        modes,
        initialMode,
        leftPanel: {
          visible: leftCfg?.visible ?? DEFAULT_CONFIG.layout.leftPanel.visible,
          width: leftCfg?.width ?? DEFAULT_CONFIG.layout.leftPanel.defaultWidth,
          minWidth: leftCfg?.minWidth ?? DEFAULT_CONFIG.layout.leftPanel.minWidth,
        },
        rightPanel: {
          visible: rightCfg?.visible ?? DEFAULT_CONFIG.layout.rightPanel.visible,
          width: rightCfg?.width ?? DEFAULT_CONFIG.layout.rightPanel.defaultWidth,
          minWidth: rightCfg?.minWidth ?? DEFAULT_CONFIG.layout.rightPanel.minWidth,
        },
      },
    );
    instanceRef.current = inst;

    const refresh = () => setState(inst.capabilities.getState());

    const off = [
      inst.on("layout:panelToggled", refresh),
      inst.on("layout:panelResized", refresh),
      inst.on("layout:panelMinChanged", refresh),
      inst.on("layout:modeChanged", refresh),
      inst.on("layout:titleChanged", refresh),
      inst.on("wmep:mounted", () => {
        refresh();
        stableOnInstance.current?.(inst);
      }),
    ];

    return () => {
      off.forEach((fn) => fn());
      void inst.unmount("layout-view-unmount");
    };
    // Construct once per mount; props passed in only at initial construction
    // by design (subsequent prop changes can be propagated via the wMEP API).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------
  // Resize handlers — drag-to-resize for both panels (Rule 2)
  // -------------------------------------------------------------
  const startResize = useCallback(
    (side: PanelSide) =>
      (e: React.MouseEvent<HTMLDivElement>): void => {
        e.preventDefault();
        const inst = instanceRef.current;
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
      },
    [],
  );

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  const toggle = (side: PanelSide) =>
    instanceRef.current?.capabilities.togglePanel({ side });

  const setMode = (mode: ModeKey) =>
    instanceRef.current?.capabilities.setMode({ mode });

  const body = modeBodies[state.mode];

  return (
    <div className="layout-root">
      {/* ============ TOP BAR ============ */}
      <header className="layout-topbar">
        <div className="topbar-left">
          <span className="topbar-title">{state.title}</span>
        </div>
        <div className="topbar-center">{topBarToolbar}</div>
        <div className="topbar-right">
          <button
            className={`btn btn-ghost btn-sm ${state.leftPanel.visible ? "is-active" : ""}`}
            onClick={() => toggle("left")}
            title="Toggle left panel"
          >
            [L]
          </button>
          <button
            className={`btn btn-ghost btn-sm ${state.rightPanel.visible ? "is-active" : ""}`}
            onClick={() => toggle("right")}
            title="Toggle right panel"
          >
            [R]
          </button>
          {topBarRightButtons}
        </div>
      </header>

      {/* ============ BODY ============ */}
      <div className="layout-body">
        {/* ---- LEFT SIDE PANEL ---- */}
        {state.leftPanel.visible && (
          <aside
            className="side-panel side-panel-left"
            style={{ width: state.leftPanel.width }}
          >
            <div className="side-panel-content">{leftPanelContent}</div>
            <div
              className="resize-handle resize-handle-right"
              onMouseDown={startResize("left")}
              title={`Drag to resize (min ${state.leftPanel.minWidth}px)`}
            />
          </aside>
        )}

        {/* ---- PAGE AREA ---- */}
        <main className="page-area">
          {/* page header */}
          <div className="page-header">
            <div className="page-header-left">{pageHeaderLeftButtons}</div>
            <div className="page-header-center">
              {state.modes.map((m) => (
                <button
                  key={m.key}
                  className={`mode-btn ${state.mode === m.key ? "is-active" : ""}`}
                  onClick={() => setMode(m.key)}
                  title={m.description}
                >
                  {m.icon && <span className="mode-btn-icon">{m.icon}</span>}
                  <span className="mode-btn-label">{m.label}</span>
                </button>
              ))}
            </div>
            <div className="page-header-right">{pageHeaderRightButtons}</div>
          </div>

          {/* page toolbar */}
          {pageToolbar && <div className="page-toolbar">{pageToolbar}</div>}

          {/* page body */}
          <div className="page-body">
            {body ?? (
              <div className="page-body-empty">
                No view registered for mode &quot;{state.mode}&quot;.
              </div>
            )}
          </div>
        </main>

        {/* ---- RIGHT SIDE PANEL ---- */}
        {state.rightPanel.visible && (
          <aside
            className="side-panel side-panel-right"
            style={{ width: state.rightPanel.width }}
          >
            <div
              className="resize-handle resize-handle-left"
              onMouseDown={startResize("right")}
              title={`Drag to resize (min ${state.rightPanel.minWidth}px)`}
            />
            <div className="side-panel-content">{rightPanelContent}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
