<!--
  @demo/layout — module-owned UI (Svelte 5)

  Implements the Provisions:

    <topbar>
      <left> title </left>
      <center> {topBarToolbar} </center>
      <right> {topBarRightButtons} + panel toggles </right>
    </topbar>

    <body>
      <leftPanel> {leftPanelContent} + resize handle </leftPanel>
      <pageArea>
        <pageHeader>
          <left> {pageHeaderLeftButtons} </left>
          <center> mode switch buttons </center>
          <right> {pageHeaderRightButtons} </right>
        </pageHeader>
        <pageToolbar> {pageToolbar} </pageToolbar>
        <pageBody> modeBodies[currentMode] </pageBody>
      </pageArea>
      <rightPanel> resize handle + {rightPanelContent} </rightPanel>
    </body>

  Rule 1: composed of Lego pieces — slotted content is passed in
          as Svelte snippets ({@render snippet()}) so the host
          can swap content imperatively at runtime.
  Rule 2: side panels resizable, min width clamped (via wMEP).
  Rule 3: panels hidden/shown via toggle buttons.
-->
<script lang="ts">
  import { onMount, onDestroy, type Snippet } from "svelte";

  import type { WmepInstance } from "@aurorah/wmep";

  import {
    DEFAULT_CONFIG,
    type ModeKey,
    type ModePreset,
  } from "../configuration/configuration.wmep";
  import { createLogger } from "../../lib/host";

  import { Layout, type LayoutState, type PanelSide } from "./layout.wmep";

  import "./layout.scss";

  type LayoutPanelConfig = {
    visible?: boolean;
    width?: number;
    minWidth?: number;
  };

  type Props = {
    title?: string;
    initialMode?: ModeKey;
    modes?: ModePreset[];
    leftPanel?: LayoutPanelConfig;
    rightPanel?: LayoutPanelConfig;

    topBarToolbar?: Snippet;
    topBarRightButtons?: Snippet;
    leftPanelContent?: Snippet;
    rightPanelContent?: Snippet;
    pageHeaderLeftButtons?: Snippet;
    pageHeaderRightButtons?: Snippet;
    pageToolbar?: Snippet;
    modeBodies?: Partial<Record<ModeKey, Snippet>>;

    onInstance?: (instance: WmepInstance<Layout>) => void;
  };

  let {
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
    modeBodies = {},
    onInstance,
  }: Props = $props();

  let layoutState = $state<LayoutState | null>(null);

  let instance: WmepInstance<Layout> | null = null;
  let unsubs: Array<() => void> = [];

  onMount(() => {
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

    const inst = Layout(
      { logger: createLogger("@demo/layout") },
      {
        title,
        modes,
        initialMode,
        leftPanel: left,
        rightPanel: right,
      },
    );
    instance = inst;
    layoutState = inst.capabilities.getState();

    const refresh = () => {
      layoutState = inst.capabilities.getState();
    };

    unsubs.push(
      inst.on("layout:panelToggled", refresh),
      inst.on("layout:panelResized", refresh),
      inst.on("layout:panelMinChanged", refresh),
      inst.on("layout:modeChanged", refresh),
      inst.on("layout:titleChanged", refresh),
      inst.on("wmep:mounted", () => {
        refresh();
        onInstance?.(inst);
      }),
    );
  });

  onDestroy(() => {
    unsubs.forEach((fn) => fn());
    unsubs = [];
    const inst = instance;
    instance = null;
    if (inst) void inst.unmount("layout-view-disconnect");
  });

  const startResize = (side: PanelSide) => (e: MouseEvent): void => {
    e.preventDefault();
    const inst = instance;
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

  const toggle = (side: PanelSide): void => {
    instance?.capabilities.togglePanel({ side });
  };

  const setMode = (mode: ModeKey): void => {
    instance?.capabilities.setMode({ mode });
  };
</script>

{#if layoutState}
  {@const state = layoutState}
  {@const body = modeBodies[state.mode]}
  <div class="layout-root">
    <header class="layout-topbar">
      <div class="topbar-left">
        <span class="topbar-title">{state.title}</span>
      </div>
      <div class="topbar-center">
        {#if topBarToolbar}{@render topBarToolbar()}{/if}
      </div>
      <div class="topbar-right">
        <button
          class="btn btn-ghost btn-sm {state.leftPanel.visible
            ? 'is-active'
            : ''}"
          title="Toggle left panel"
          onclick={() => toggle("left")}
        >
          [L]
        </button>
        <button
          class="btn btn-ghost btn-sm {state.rightPanel.visible
            ? 'is-active'
            : ''}"
          title="Toggle right panel"
          onclick={() => toggle("right")}
        >
          [R]
        </button>
        {#if topBarRightButtons}{@render topBarRightButtons()}{/if}
      </div>
    </header>

    <div class="layout-body">
      {#if state.leftPanel.visible}
        <aside
          class="side-panel side-panel-left"
          style="width: {state.leftPanel.width}px"
        >
          <div class="side-panel-content">
            {#if leftPanelContent}{@render leftPanelContent()}{/if}
          </div>
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="resize-handle resize-handle-right"
            title="Drag to resize (min {state.leftPanel.minWidth}px)"
            onmousedown={startResize("left")}
            role="separator"
            aria-orientation="vertical"
          ></div>
        </aside>
      {/if}

      <main class="page-area">
        <div class="page-header">
          <div class="page-header-left">
            {#if pageHeaderLeftButtons}{@render pageHeaderLeftButtons()}{/if}
          </div>
          <div class="page-header-center">
            {#each state.modes as m (m.key)}
              <button
                class="mode-btn {state.mode === m.key ? 'is-active' : ''}"
                title={m.description}
                onclick={() => setMode(m.key)}
              >
                {#if m.icon}<span class="mode-btn-icon">{m.icon}</span>{/if}
                <span class="mode-btn-label">{m.label}</span>
              </button>
            {/each}
          </div>
          <div class="page-header-right">
            {#if pageHeaderRightButtons}{@render pageHeaderRightButtons()}{/if}
          </div>
        </div>

        {#if pageToolbar}
          <div class="page-toolbar">{@render pageToolbar()}</div>
        {/if}

        <div class="page-body">
          {#if body}
            {@render body()}
          {:else}
            <div class="page-body-empty">
              No view registered for mode "{state.mode}".
            </div>
          {/if}
        </div>
      </main>

      {#if state.rightPanel.visible}
        <aside
          class="side-panel side-panel-right"
          style="width: {state.rightPanel.width}px"
        >
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="resize-handle resize-handle-left"
            title="Drag to resize (min {state.rightPanel.minWidth}px)"
            onmousedown={startResize("right")}
            role="separator"
            aria-orientation="vertical"
          ></div>
          <div class="side-panel-content">
            {#if rightPanelContent}{@render rightPanelContent()}{/if}
          </div>
        </aside>
      {/if}
    </div>
  </div>
{:else}
  <div class="layout-root"></div>
{/if}
