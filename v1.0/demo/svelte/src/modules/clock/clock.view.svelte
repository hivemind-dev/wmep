<!--
  @demo/clock — module-owned UI (Svelte 5)
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";

  import type { WmepInstance } from "@aurorah/wmep";

  import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
  import { createLogger } from "../../lib/host";

  import { Clock, type ClockFormat } from "./clock.wmep";

  import "./clock.scss";

  type Props = {
    format?: ClockFormat;
    tickIntervalMs?: number;
  };

  let {
    format = DEFAULT_CONFIG.clock.format,
    tickIntervalMs = DEFAULT_CONFIG.clock.tickIntervalMs,
  }: Props = $props();

  let ts = $state(Date.now());
  let activeFormat = $state<ClockFormat>(untrack(() => format));
  let paused = $state(false);

  let instance: WmepInstance<Clock> | null = null;
  let unsubs: Array<() => void> = [];

  function formatTime(t: number, f: ClockFormat): string {
    const d = new Date(t);
    const hours24 = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    if (f === "24h") {
      const h = hours24.toString().padStart(2, "0");
      return `${h}:${m}:${s}`;
    }
    const ampm = hours24 >= 12 ? "PM" : "AM";
    const h12 = ((hours24 + 11) % 12) + 1;
    return `${h12.toString().padStart(2, "0")}:${m}:${s} ${ampm}`;
  }

  onMount(() => {
    const inst = Clock(
      { logger: createLogger("@demo/clock") },
      { format, tickIntervalMs },
    );
    instance = inst;

    unsubs.push(
      inst.on("clock:tick", (e) => {
        ts = e.ts;
      }),
      inst.on("clock:formatChanged", (e) => {
        activeFormat = e.format;
        ts = Date.now();
      }),
      inst.on("clock:paused", () => {
        paused = true;
      }),
      inst.on("clock:resumed", () => {
        paused = false;
      }),
    );
  });

  onDestroy(() => {
    unsubs.forEach((fn) => fn());
    unsubs = [];
    const inst = instance;
    instance = null;
    if (inst) void inst.unmount("clock-view-disconnect");
  });

  const toggleFormat = (): void => {
    instance?.capabilities.setFormat({
      format: activeFormat === "24h" ? "12h" : "24h",
    });
  };
  const pause = (): void => {
    instance?.capabilities.pause();
  };
  const resume = (): void => {
    instance?.capabilities.resume();
  };
</script>

<section class="module-panel clock-panel">
  <header class="module-panel-header">
    <span class="module-panel-title">Clock</span>
    <span class="module-panel-subtitle">@demo/clock</span>
  </header>

  <div class="clock-display">
    <div class="clock-time">{formatTime(ts, activeFormat)}</div>
    <div class="clock-meta">
      format: {activeFormat} &middot; {paused ? "paused" : "running"}
    </div>
  </div>

  <div class="clock-controls">
    <button class="btn btn-ghost" onclick={toggleFormat}>Toggle format</button>
    {#if paused}
      <button class="btn btn-green" onclick={resume}>Resume</button>
    {:else}
      <button class="btn btn-red" onclick={pause}>Pause</button>
    {/if}
  </div>
</section>
