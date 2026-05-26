<script lang="ts" module>
  /**
   * Main demo page (Svelte 5)
   *
   * Composes the wMEP modules like Lego pieces:
   *
   *   <LayoutView (the @demo/layout module's UI)>
   *     leftPanelContent  = <ConfigurationView />     (@demo/configuration UI)
   *     rightPanelContent = <InfoPanel />             (small in-page sidebar)
   *     modeBodies = {
   *       counter: <CounterView ... />,               (@demo/counter UI)
   *       notes:   <NotesView ... />,                 (@demo/notes UI)
   *       clock:   <ClockView ... />,                 (@demo/clock UI)
   *     }
   *   </LayoutView>
   *
   * The host (this file) is also responsible for wiring cross-module
   * events. The @demo/configuration module is the SINGLE SOURCE OF
   * TRUTH for every module's config; this page subscribes to its
   * "config:changed" / "config:reset" events and re-feeds the values
   * back into each module's view as Svelte props. Each view re-mounts
   * its wMEP instance with the new config (the HOST-to-MODULE config
   * slot is by definition construction-time) by being keyed in a
   * {#key ...} block.
   *
   *   @demo/configuration on 'config:changed':
   *     @demo/layout    notify 'config:changed'    (live update via listener)
   *     @demo/counter   new props -> re-construct  (initial, step)
   *     @demo/notes     new props -> re-construct  (maxNotes)
   *     @demo/clock     new props -> re-construct  (format, tickIntervalMs)
   *
   * The reverse direction is also wired so the Configuration UI
   * mirrors the live panel widths in real time:
   *
   *   @demo/layout        on 'layout:panelResized':
   *   @demo/configuration set 'layout.{side}Panel.defaultWidth'
   *
   * A dedup check (`current !== width`) terminates the obvious
   * Configuration -> Layout -> Configuration round-trip.
   *
   * configRef / layoutRef are kept as $state so the cross-wiring
   * effect re-runs whenever EITHER instance is rebuilt at runtime
   * (e.g. when the user toggles a side panel off and back on, the
   * affected module's view is destroyed/recreated and a fresh wMEP
   * instance is constructed). The effect's cleanup function unwires
   * listeners from the prior instance before wiring the new one.
   */
</script>

<script lang="ts">
  import type { WmepInstance } from "@aurorah/wmep";

  import {
    type Configuration,
    ConfigurationView,
    DEFAULT_CONFIG,
    type ConfigurationShape,
  } from "./modules/configuration/configuration.wmep";
  import { type Layout, LayoutView } from "./modules/layout/layout.wmep";
  import { CounterView } from "./modules/counter/counter.wmep";
  import { NotesView } from "./modules/notes/notes.wmep";
  import { ClockView } from "./modules/clock/clock.wmep";

  import InfoPanel from "./InfoPanel.svelte";

  import "./styles/page.scss";

  let configRef = $state<WmepInstance<Configuration> | null>(null);
  let layoutRef = $state<WmepInstance<Layout> | null>(null);

  let configSnapshot = $state<ConfigurationShape>(DEFAULT_CONFIG);

  $effect(() => {
    const cfg = configRef;
    const layout = layoutRef;
    if (!cfg || !layout) return;

    configSnapshot = cfg.capabilities.getAll();

    const offChanged = cfg.on("config:changed", ({ path, value }) => {
      layout.notify("config:changed", { path: String(path), value });
      configSnapshot = cfg.capabilities.getAll();
    });
    const offReset = cfg.on("config:reset", ({ snapshot }) => {
      configSnapshot = snapshot;
    });

    const offResized = layout.on(
      "layout:panelResized",
      ({ side, width }) => {
        const path =
          side === "left"
            ? ("layout.leftPanel.defaultWidth" as const)
            : ("layout.rightPanel.defaultWidth" as const);
        const current = cfg.capabilities.get(path);
        if (current !== width) {
          cfg.capabilities.set(path, width);
        }
      },
    );

    return () => {
      offChanged();
      offReset();
      offResized();
    };
  });

  $effect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = configSnapshot.theme;
  });

  const onConfigInstance = (inst: WmepInstance<Configuration>): void => {
    configRef = inst;
  };
  const onLayoutInstance = (inst: WmepInstance<Layout>): void => {
    layoutRef = inst;
  };
</script>

<LayoutView
  onInstance={onLayoutInstance}
  leftPanelContent={leftPanel}
  rightPanelContent={rightPanel}
  topBarToolbar={topBar}
  modeBodies={{ counter, notes, clock }}
/>

{#snippet topBar()}
  <div class="topbar-toolbar">
    <span class="topbar-toolbar-label">wMEP modules:</span>
    <code class="topbar-toolbar-pill">@demo/configuration</code>
    <code class="topbar-toolbar-pill">@demo/layout</code>
    <code class="topbar-toolbar-pill">@demo/counter</code>
    <code class="topbar-toolbar-pill">@demo/notes</code>
    <code class="topbar-toolbar-pill">@demo/clock</code>
  </div>
{/snippet}

{#snippet leftPanel()}
  <ConfigurationView onInstance={onConfigInstance} />
{/snippet}

{#snippet rightPanel()}
  <InfoPanel />
{/snippet}

{#snippet counter()}
  {#key `${configSnapshot.counter.initial}:${configSnapshot.counter.step}`}
    <CounterView
      initial={configSnapshot.counter.initial}
      step={configSnapshot.counter.step}
    />
  {/key}
{/snippet}

{#snippet notes()}
  {#key configSnapshot.notes.maxNotes}
    <NotesView maxNotes={configSnapshot.notes.maxNotes} />
  {/key}
{/snippet}

{#snippet clock()}
  {#key `${configSnapshot.clock.format}:${configSnapshot.clock.tickIntervalMs}`}
    <ClockView
      format={configSnapshot.clock.format}
      tickIntervalMs={configSnapshot.clock.tickIntervalMs}
    />
  {/key}
{/snippet}
