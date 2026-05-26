/**
 * @demo/notes — internal implementation
 */

import { createWmepModule } from "@aurorah/wmep";
import type { Note, Notes } from "./notes.wmep";

let counter = 0;
const nextId = (): string => `n${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const createNotes = createWmepModule<Notes>(
  ({ requires, config, emit }) => {
    const maxNotes = config.maxNotes ?? 50;
    const notes: Note[] = (config.seed ?? []).map((n) => ({ ...n }));

    const log = (
      action: string,
      detail?: Record<string, unknown>,
    ): void => {
      requires.logger.write({ action, detail });
    };

    const find = (id: string): { idx: number; note: Note } | null => {
      const idx = notes.findIndex((n) => n.id === id);
      if (idx < 0) return null;
      return { idx, note: notes[idx] };
    };

    return {
      capabilities: {
        getAll: () => notes.map((n) => ({ ...n })),

        add: ({ text }) => {
          if (notes.length >= maxNotes) {
            throw new Error(`Note limit reached (max=${maxNotes})`);
          }
          const note: Note = {
            id: nextId(),
            text,
            createdAt: Date.now(),
          };
          notes.push(note);
          log("notes:add", { id: note.id, text });
          emit("note:added", { note });
          return note;
        },

        edit: ({ id, text }) => {
          const hit = find(id);
          if (!hit) return null;
          hit.note.text = text;
          log("notes:edit", { id, text });
          emit("note:edited", { note: { ...hit.note } });
          return { ...hit.note };
        },

        remove: ({ id }) => {
          const hit = find(id);
          if (!hit) return false;
          notes.splice(hit.idx, 1);
          log("notes:remove", { id });
          emit("note:removed", { id });
          return true;
        },

        clear: () => {
          const n = notes.length;
          notes.length = 0;
          log("notes:clear", { count: n });
          emit("notes:cleared", { count: n });
          return n;
        },
      },

      onMount: () => {
        log("notes:mount", { count: notes.length, maxNotes });
        return () => {
          log("notes:unmount");
        };
      },
    };
  },
);
