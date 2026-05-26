/**
 * @demo/notes — module-owned UI (vanilla DOM)
 */

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";
import { h, replaceChildren } from "../../lib/dom";

import { Notes, type Note } from "./notes.wmep";

import "./notes.scss";

export interface NotesViewProps {
  maxNotes?: number;
}

export interface NotesViewHandle {
  el: HTMLElement;
  instance: WmepInstance<Notes>;
  destroy(): Promise<void>;
}

export function createNotesView(
  props: NotesViewProps = {},
): NotesViewHandle {
  const maxNotes = props.maxNotes ?? DEFAULT_CONFIG.notes.maxNotes;

  const instance = Notes(
    { logger: createLogger("@demo/notes") },
    { maxNotes, seed: [] },
  );

  const subtitle = h(
    "span",
    { className: "module-panel-subtitle" },
    `@demo/notes · 0 / ${maxNotes}`,
  );

  const input = h("input", {
    className: "notes-input",
    type: "text",
    placeholder: "Type a note and press Enter",
  });

  const submit = (): void => {
    const text = input.value.trim();
    if (!text) return;
    try {
      instance.capabilities.add({ text });
      input.value = "";
    } catch (err) {
      console.warn(err);
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  const addBtn = h(
    "button",
    { className: "btn btn-green", onClick: submit },
    "Add",
  );
  const clearBtn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => instance.capabilities.clear(),
    },
    "Clear",
  );

  const list = h("ul", { className: "notes-list" });

  const root = h(
    "section",
    { className: "module-panel notes-panel" },
    h(
      "header",
      { className: "module-panel-header" },
      h("span", { className: "module-panel-title" }, "Notes"),
      subtitle,
    ),
    h("div", { className: "notes-composer" }, input, addBtn, clearBtn),
    list,
  );

  const renderList = (items: Note[]): void => {
    subtitle.textContent = `@demo/notes · ${items.length} / ${maxNotes}`;
    if (items.length === 0) {
      replaceChildren(list, h("li", { className: "notes-empty" }, "No notes yet."));
      return;
    }
    const children: HTMLElement[] = items.map((n) =>
      h(
        "li",
        { className: "notes-item" },
        h("span", { className: "notes-item-text" }, n.text),
        h(
          "div",
          { className: "notes-item-actions" },
          h(
            "button",
            {
              className: "btn btn-ghost btn-xs",
              onClick: () => {
                const next = prompt("Edit note", n.text);
                if (next != null && next.trim()) {
                  instance.capabilities.edit({
                    id: n.id,
                    text: next.trim(),
                  });
                }
              },
            },
            "Edit",
          ),
          h(
            "button",
            {
              className: "btn btn-red btn-xs",
              onClick: () => instance.capabilities.remove({ id: n.id }),
            },
            "Delete",
          ),
        ),
      ),
    );
    replaceChildren(list, ...children);
  };

  const refresh = () => renderList(instance.capabilities.getAll());

  const off = [
    instance.on("note:added", refresh),
    instance.on("note:edited", refresh),
    instance.on("note:removed", refresh),
    instance.on("notes:cleared", refresh),
    instance.on("wmep:mounted", refresh),
  ];

  renderList([]);

  return {
    el: root,
    instance,
    destroy: async () => {
      off.forEach((fn) => fn());
      await instance.unmount("notes-view-unmount");
    },
  };
}
