<!--
  Activity log panel — host-side widget (NOT a wMEP module).

  Subscribes to the host's in-memory log buffer and renders entries
  as they arrive. Style lives in src/styles/page.scss.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import {
    type LogEntry,
    clearLogBuffer,
    getLogBuffer,
    subscribeLog,
  } from "./lib/host";

  let entries = $state<LogEntry[]>([...getLogBuffer()]);
  let unsubLog: (() => void) | null = null;

  onMount(() => {
    unsubLog = subscribeLog(() => {
      entries = [...getLogBuffer()];
    });
  });

  onDestroy(() => {
    unsubLog?.();
    unsubLog = null;
  });
</script>

<section class="module-panel info-panel">
  <header class="module-panel-header">
    <span class="module-panel-title">Activity log</span>
    <div class="module-panel-header-right">
      <span class="module-panel-subtitle">
        host logger &middot; {entries.length}
      </span>
      <button
        class="btn btn-ghost btn-sm"
        disabled={entries.length === 0}
        title="Clear activity log"
        onclick={() => clearLogBuffer()}
      >
        Clear
      </button>
    </div>
  </header>

  <div class="info-panel-help">
    <p>
      Each panel is a wMEP module in its own directory under
      <code>src/modules/</code>. They communicate through the protocol:
    </p>
    <ul>
      <li><strong>capabilities</strong> &mdash; host calls module</li>
      <li><strong>events</strong> &mdash; module emits to host</li>
      <li><strong>listeners</strong> &mdash; host notifies module</li>
      <li><strong>requires</strong> &mdash; module calls host</li>
      <li><strong>config</strong> &mdash; values at construction</li>
    </ul>
  </div>

  <ol class="log-list">
    {#if entries.length === 0}
      <li class="log-empty">waiting for events...</li>
    {:else}
      {#each entries.slice().reverse() as e, i (`${e.ts}-${i}`)}
        <li class="log-item">
          <span class="log-time">
            {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
          </span>
          <span class="log-module">{e.module}</span>
          <span class="log-action">{e.action}</span>
        </li>
      {/each}
    {/if}
  </ol>
</section>
