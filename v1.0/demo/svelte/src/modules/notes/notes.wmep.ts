/**
 * @demo/notes — boundary file
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createNotes } from "./notes";

export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

export interface Notes
  extends WmepModule<
    {
      getAll(): Note[];
      add(p: { text: string }): Note;
      edit(p: { id: string; text: string }): Note | null;
      remove(p: { id: string }): boolean;
      clear(): number;
    },
    {
      "note:added": { note: Note };
      "note:edited": { note: Note };
      "note:removed": { id: string };
      "notes:cleared": { count: number };
    },
    Record<string, never>,
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    {
      maxNotes?: number;
      seed?: Note[];
    }
  > {
  module: { name: "@demo/notes"; version: "1.0.0" };
}

export const Notes: WmepFactory<Notes> = createNotes;

export { default as NotesView } from "./notes.view.svelte";
