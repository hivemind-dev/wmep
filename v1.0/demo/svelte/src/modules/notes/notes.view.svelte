<!--
  @demo/notes — module-owned UI (Svelte 5)
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import type { WmepInstance } from "@aurorah/wmep";

  import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
  import { createLogger } from "../../lib/host";

  import { Notes, type Note } from "./notes.wmep";

  import "./notes.scss";

  type Props = {
    maxNotes?: number;
  };

  let { maxNotes = DEFAULT_CONFIG.notes.maxNotes }: Props = $props();

  let list = $state<Note[]>([]);
  let draft = $state("");

  let instance: WmepInstance<Notes> | null = null;
  let unsubs: Array<() => void> = [];

  onMount(() => {
    const inst = Notes(
      { logger: createLogger("@demo/notes") },
      { maxNotes, seed: [] },
    );
    instance = inst;

    const refresh = () => {
      list = inst.capabilities.getAll();
    };

    unsubs.push(
      inst.on("note:added", refresh),
      inst.on("note:edited", refresh),
      inst.on("note:removed", refresh),
      inst.on("notes:cleared", refresh),
      inst.on("wmep:mounted", refresh),
    );
  });

  onDestroy(() => {
    unsubs.forEach((fn) => fn());
    unsubs = [];
    const inst = instance;
    instance = null;
    if (inst) void inst.unmount("notes-view-disconnect");
  });

  const submit = (): void => {
    const text = draft.trim();
    if (!text) return;
    try {
      instance?.capabilities.add({ text });
      draft = "";
    } catch (err) {
      console.warn(err);
    }
  };

  const editNote = (n: Note): void => {
    const next = prompt("Edit note", n.text);
    if (next != null && next.trim()) {
      instance?.capabilities.edit({ id: n.id, text: next.trim() });
    }
  };

  const removeNote = (id: string): void => {
    instance?.capabilities.remove({ id });
  };

  const clearAll = (): void => {
    instance?.capabilities.clear();
  };

  const onInputKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") submit();
  };
</script>

<section class="module-panel notes-panel">
  <header class="module-panel-header">
    <span class="module-panel-title">Notes</span>
    <span class="module-panel-subtitle">
      @demo/notes &middot; {list.length} / {maxNotes}
    </span>
  </header>

  <div class="notes-composer">
    <input
      class="notes-input"
      type="text"
      placeholder="Type a note and press Enter"
      bind:value={draft}
      onkeydown={onInputKeydown}
    />
    <button class="btn btn-green" onclick={submit}>Add</button>
    <button class="btn btn-ghost" onclick={clearAll}>Clear</button>
  </div>

  <ul class="notes-list">
    {#if list.length === 0}
      <li class="notes-empty">No notes yet.</li>
    {:else}
      {#each list as n (n.id)}
        <li class="notes-item">
          <span class="notes-item-text">{n.text}</span>
          <div class="notes-item-actions">
            <button class="btn btn-ghost btn-xs" onclick={() => editNote(n)}>
              Edit
            </button>
            <button class="btn btn-red btn-xs" onclick={() => removeNote(n.id)}>
              Delete
            </button>
          </div>
        </li>
      {/each}
    {/if}
  </ul>
</section>
