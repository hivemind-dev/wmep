<!--
  @demo/counter — module-owned UI (Svelte 5)
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";

  import type { WmepInstance } from "@aurorah/wmep";

  import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
  import { createLogger } from "../../lib/host";

  import { Counter } from "./counter.wmep";

  import "./counter.scss";

  type Props = {
    initial?: number;
    step?: number;
  };

  let {
    initial = DEFAULT_CONFIG.counter.initial,
    step = DEFAULT_CONFIG.counter.step,
  }: Props = $props();

  let value = $state(untrack(() => initial));
  let lastSource = $state("(initial)");

  let instance: WmepInstance<Counter> | null = null;
  let unsubs: Array<() => void> = [];

  onMount(() => {
    const inst = Counter(
      { logger: createLogger("@demo/counter") },
      { initial, step },
    );
    instance = inst;

    unsubs.push(
      inst.on("counter:changed", (e) => {
        value = e.value;
        lastSource = e.source;
      }),
    );
  });

  onDestroy(() => {
    unsubs.forEach((fn) => fn());
    unsubs = [];
    const inst = instance;
    instance = null;
    if (inst) void inst.unmount("counter-view-disconnect");
  });

  const bump = (amount?: number): void => {
    instance?.capabilities.bump(
      amount !== undefined ? { amount } : undefined,
    );
  };
  const decrement = (): void => {
    instance?.capabilities.decrement();
  };
  const reset = (): void => {
    instance?.capabilities.reset();
  };
  const requestReset = (): void => {
    instance?.notify("counter:reset-request", undefined);
  };
</script>

<section class="module-panel counter-panel">
  <header class="module-panel-header">
    <span class="module-panel-title">Counter</span>
    <span class="module-panel-subtitle">@demo/counter</span>
  </header>

  <div class="counter-display">
    <div class="counter-value">{value}</div>
    <div class="counter-source">last source: {lastSource}</div>
  </div>

  <div class="counter-buttons">
    <button class="btn btn-red" onclick={decrement}>- {step}</button>
    <button class="btn btn-gray" onclick={reset}>Reset</button>
    <button class="btn btn-green" onclick={() => bump()}>+ {step}</button>
  </div>

  <div class="counter-extra-buttons">
    <button class="btn btn-ghost" onclick={() => bump(5)}>+5</button>
    <button class="btn btn-ghost" onclick={() => bump(10)}>+10</button>
    <button class="btn btn-ghost" onclick={requestReset}>
      notify reset-request
    </button>
  </div>
</section>
