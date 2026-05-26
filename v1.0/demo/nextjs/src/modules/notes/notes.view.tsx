/**
 * @demo/notes — module-owned UI
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Notes, type Note } from "./notes.wmep";

import "./notes.scss";

export interface NotesViewProps {
  maxNotes?: number;
}

export function NotesView({
  maxNotes = DEFAULT_CONFIG.notes.maxNotes,
}: NotesViewProps): React.ReactElement {
  const [list, setList] = useState<Note[]>([]);
  const [draft, setDraft] = useState<string>("");
  const instanceRef = useRef<ReturnType<typeof Notes> | null>(null);

  useEffect(() => {
    const notes = Notes(
      { logger: createLogger("@demo/notes") },
      { maxNotes, seed: [] },
    );
    instanceRef.current = notes;

    const refresh = () => setList(notes.capabilities.getAll());

    const off = [
      notes.on("note:added", refresh),
      notes.on("note:edited", refresh),
      notes.on("note:removed", refresh),
      notes.on("notes:cleared", refresh),
      notes.on("wmep:mounted", refresh),
    ];

    return () => {
      off.forEach((fn) => fn());
      void notes.unmount("notes-view-unmount");
    };
  }, [maxNotes]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    instanceRef.current?.capabilities.add({ text });
    setDraft("");
  };

  return (
    <section className="module-panel notes-panel">
      <header className="module-panel-header">
        <span className="module-panel-title">Notes</span>
        <span className="module-panel-subtitle">
          @demo/notes &middot; {list.length} / {maxNotes}
        </span>
      </header>

      <div className="notes-composer">
        <input
          className="notes-input"
          value={draft}
          placeholder="Type a note and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className="btn btn-green" onClick={submit}>
          Add
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => instanceRef.current?.capabilities.clear()}
        >
          Clear
        </button>
      </div>

      <ul className="notes-list">
        {list.length === 0 ? (
          <li className="notes-empty">No notes yet.</li>
        ) : (
          list.map((n) => (
            <li key={n.id} className="notes-item">
              <span className="notes-item-text">{n.text}</span>
              <div className="notes-item-actions">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    const next = prompt("Edit note", n.text);
                    if (next != null && next.trim()) {
                      instanceRef.current?.capabilities.edit({
                        id: n.id,
                        text: next.trim(),
                      });
                    }
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-red btn-xs"
                  onClick={() =>
                    instanceRef.current?.capabilities.remove({ id: n.id })
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
