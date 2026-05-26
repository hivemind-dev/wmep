<!--
  TextInput — commit on Enter / blur (NOT on every keystroke).
  Escape reverts the draft.

  External state syncs into draft EXCEPT when the input is currently
  focused, so the user's in-progress edit is never overwritten by an
  outside config change (matches the Lit3 syncInput pattern).
-->
<script lang="ts">
  import { untrack } from "svelte";

  type Props = {
    id?: string;
    value: string;
    onCommit: (next: string) => void;
  };

  let { id, value, onCommit }: Props = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let draft = $state(untrack(() => value));

  $effect(() => {
    const next = value;
    if (typeof document !== "undefined" && inputEl === document.activeElement) {
      return;
    }
    draft = next;
  });

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      draft = value;
      (e.currentTarget as HTMLInputElement).blur();
    }
  };
</script>

<input
  bind:this={inputEl}
  {id}
  type="text"
  class="config-input"
  bind:value={draft}
  onkeydown={onKeyDown}
  onblur={commit}
/>
