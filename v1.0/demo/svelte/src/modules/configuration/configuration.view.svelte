<!--
  @demo/configuration — module-owned UI (Svelte 5)

  The Configuration module renders its own settings panel. The
  component constructs a wMEP instance internally on mount, wires
  it to the host's logger, and exposes the configuration values
  as editable inputs (commit-on-blur / Enter, revert-on-Escape).

  Internal to the `configuration/` directory.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import type { WmepInstance } from "@aurorah/wmep";

  import { createLogger } from "../../lib/host";

  import {
    Configuration,
    DEFAULT_CONFIG,
    type ConfigurationShape,
  } from "./configuration.wmep";

  import TextInput from "./TextInput.svelte";
  import NumberInput from "./NumberInput.svelte";

  import "./configuration.scss";

  type Props = {
    onInstance?: (instance: WmepInstance<Configuration>) => void;
  };

  let { onInstance }: Props = $props();

  let snapshot = $state<ConfigurationShape>(structuredClonePoly(DEFAULT_CONFIG));

  let instance: WmepInstance<Configuration> | null = null;
  let unsubs: Array<() => void> = [];

  onMount(() => {
    const inst = Configuration(
      { logger: createLogger("@demo/configuration") },
      { overrides: undefined },
    );
    instance = inst;

    unsubs.push(
      inst.on("config:changed", () => {
        snapshot = inst.capabilities.getAll();
      }),
      inst.on("config:reset", ({ snapshot: snap }) => {
        snapshot = snap;
      }),
      inst.on("wmep:mounted", () => {
        snapshot = inst.capabilities.getAll();
        onInstance?.(inst);
      }),
    );
  });

  onDestroy(() => {
    unsubs.forEach((fn) => fn());
    unsubs = [];
    const inst = instance;
    instance = null;
    if (inst) void inst.unmount("configuration-view-disconnect");
  });

  const update = (
    path: Parameters<Configuration["capabilities"]["set"]>[0],
    value: unknown,
  ): void => {
    instance?.capabilities.set(path, value);
  };

  function structuredClonePoly<T>(value: T): T {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
</script>

<section class="module-panel configuration-panel">
  <header class="module-panel-header">
    <span class="module-panel-title">Configuration</span>
    <span class="module-panel-subtitle">@demo/configuration</span>
  </header>

  <div class="config-row">
    <label class="config-label" for="cfg-app-title">App title</label>
    <TextInput
      id="cfg-app-title"
      value={snapshot.appTitle}
      onCommit={(v) => update("appTitle", v)}
    />
  </div>

  <div class="config-row">
    <span class="config-label">Theme</span>
    <button
      class="btn btn-ghost"
      onclick={() => instance?.capabilities.toggleTheme()}
    >
      {snapshot.theme}
    </button>
  </div>

  <div class="config-section-title">Layout</div>

  <div class="config-row">
    <label class="config-label" for="cfg-left-width">Left panel width (px)</label>
    <NumberInput
      id="cfg-left-width"
      value={snapshot.layout.leftPanel.defaultWidth}
      min={snapshot.layout.leftPanel.minWidth}
      onCommit={(v) => update("layout.leftPanel.defaultWidth", v)}
    />
  </div>

  <div class="config-row">
    <label class="config-label" for="cfg-left-min">Left panel min width (px)</label>
    <NumberInput
      id="cfg-left-min"
      value={snapshot.layout.leftPanel.minWidth}
      min={200}
      onCommit={(v) => update("layout.leftPanel.minWidth", v)}
    />
  </div>

  <div class="config-row">
    <label class="config-label" for="cfg-right-width">Right panel width (px)</label>
    <NumberInput
      id="cfg-right-width"
      value={snapshot.layout.rightPanel.defaultWidth}
      min={snapshot.layout.rightPanel.minWidth}
      onCommit={(v) => update("layout.rightPanel.defaultWidth", v)}
    />
  </div>

  <div class="config-row">
    <label class="config-label" for="cfg-right-min">Right panel min width (px)</label>
    <NumberInput
      id="cfg-right-min"
      value={snapshot.layout.rightPanel.minWidth}
      min={200}
      onCommit={(v) => update("layout.rightPanel.minWidth", v)}
    />
  </div>

  <div class="config-section-title">Counter</div>

  <div class="config-row">
    <label class="config-label" for="cfg-counter-initial">Initial value</label>
    <NumberInput
      id="cfg-counter-initial"
      value={snapshot.counter.initial}
      onCommit={(v) => update("counter.initial", v)}
    />
  </div>

  <div class="config-row">
    <label class="config-label" for="cfg-counter-step">Step</label>
    <NumberInput
      id="cfg-counter-step"
      value={snapshot.counter.step}
      min={1}
      onCommit={(v) => update("counter.step", v)}
    />
  </div>

  <div class="config-section-title">Notes</div>

  <div class="config-row">
    <label class="config-label" for="cfg-notes-max">Max notes</label>
    <NumberInput
      id="cfg-notes-max"
      value={snapshot.notes.maxNotes}
      min={1}
      onCommit={(v) => update("notes.maxNotes", v)}
    />
  </div>

  <div class="config-section-title">Clock</div>

  <div class="config-row">
    <span class="config-label">Format</span>
    <button
      class="btn btn-ghost"
      onclick={() =>
        update(
          "clock.format",
          snapshot.clock.format === "24h" ? "12h" : "24h",
        )}
    >
      {snapshot.clock.format}
    </button>
  </div>

  <div class="config-row">
    <label class="config-label" for="cfg-clock-tick">Tick interval (ms)</label>
    <NumberInput
      id="cfg-clock-tick"
      value={snapshot.clock.tickIntervalMs}
      min={100}
      onCommit={(v) => update("clock.tickIntervalMs", v)}
    />
  </div>

  <div class="config-actions">
    <button
      class="btn btn-ghost"
      onclick={() => instance?.capabilities.reset()}
    >
      Reset to defaults
    </button>
  </div>
</section>
