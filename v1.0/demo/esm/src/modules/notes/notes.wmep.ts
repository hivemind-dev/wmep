/**
 * @demo/notes — boundary file
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createNotes } from "./notes";
import { createNotesView as InternalView } from "./notes.view";

export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

export interface Notes
  extends WmepModule<
    // HOST to MODULE: capabilities
    {
      getAll(): Note[];
      add(p: { text: string }): Note;
      edit(p: { id: string; text: string }): Note | null;
      remove(p: { id: string }): boolean;
      clear(): number;
    },
    // MODULE to HOST: events
    {
      "note:added": { note: Note };
      "note:edited": { note: Note };
      "note:removed": { id: string };
      "notes:cleared": { count: number };
    },
    // HOST to MODULE: listeners
    Record<string, never>,
    // MODULE to HOST: requires
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    // HOST to MODULE: config
    {
      maxNotes?: number;
      seed?: Note[];
    }
  > {
  module: { name: "@demo/notes"; version: "1.0.0" };
}

export const Notes: WmepFactory<Notes> = createNotes;

export const createNotesView = InternalView;
