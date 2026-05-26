<!--
  NumberInput — commit on Enter / blur (NOT on every keystroke).
  Validates and clamps only when the user signals "I'm done".
  Escape reverts the draft.

  External state syncs into draft EXCEPT when the input is currently
  focused, so live updates (e.g. layout panel resize mirroring back
  into the width input) never overwrite the user's edit while the
  field still has focus (matches the Lit3 syncInput pattern).
-->
<script lang="ts">
  import { untrack } from "svelte";

  type Props = {
    id?: string;
    value: number;
    min?: number;
    onCommit: (next: number) => void;
  };

  let { id, value, min, onCommit }: Props = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let draft = $state(untrack(() => String(value)));

  $effect(() => {
    const next = String(value);
    if (typeof document !== "undefined" && inputEl === document.activeElement) {
      return;
    }
    draft = next;
  });

  const commit = (): void => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      draft = String(value);
      return;
    }
    const integer = Math.trunc(n);
    const clamped = min !== undefined ? Math.max(min, integer) : integer;
    draft = String(clamped);
    if (clamped !== value) onCommit(clamped);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      draft = String(value);
      (e.currentTarget as HTMLInputElement).blur();
    }
  };
</script>

<input
  bind:this={inputEl}
  {id}
  type="text"
  inputmode="numeric"
  class="config-input"
  bind:value={draft}
  onkeydown={onKeyDown}
  onblur={commit}
/>
