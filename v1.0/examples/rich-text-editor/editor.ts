/**
 * @aurorah/wmep-rich-editor — internal implementation
 *
 * INTERNAL implementation of the rich-text-editor module.
 *
 * Owns editing state and dirty tracking. Calls the host's
 * `requires.doc.*` endpoints for persistence; emits
 * doc/selection events; respects theme:changed from the host.
 *
 * All event/listener plumbing lives in `createWmepModule`.
 */

import { createWmepModule } from "../../src/core/index.js";
import type { Editor, EditorDocument } from "./editor.wmep.js";

export const createEditor = createWmepModule<Editor>(
  ({ requires, config, emit }) => {
    // ---------------------------------------------------------------
    // Private state.
    // ---------------------------------------------------------------
    let currentDoc: EditorDocument | null = null;
    let dirty = false;
    let theme = config.theme ?? "light";
    const locale = config.locale ?? "en";
    const toolbar = config.toolbar ?? [];
    const readOnly = Boolean(config.readOnly);

    // ---------------------------------------------------------------
    // Source tag for the structured logger.
    //
    // Every state-changing action funnels through requires.logger
    // with a `source` discriminator, mirroring the counter
    // example's `bump | reset | reset-on-request | interval-tick`.
    // ---------------------------------------------------------------
    type EditorSource =
      | "loadDocument"
      | "setContent"
      | "format"
      | "saveDocument"
      | "listDocuments"
      | "exportDocument"
      | "theme:changed";

    const log = (
      action: string,
      source: EditorSource,
      extra?: Record<string, unknown>,
    ): void => {
      requires.logger.write({
        action,
        detail: { source, ...extra },
      });
    };

    // ---------------------------------------------------------------
    // Helpers.
    // ---------------------------------------------------------------
    const requireDoc = (): EditorDocument => {
      if (!currentDoc) throw new Error("No document loaded");
      return currentDoc;
    };

    const markModifiedAt = (content: string): void => {
      // After a mutation, the caret position is "end of content"
      // for the purposes of this minimal example.
      const doc = requireDoc();
      emit("doc:modified", { docId: doc.id, dirty: true });
      emit("selection:changed", {
        start: content.length,
        end: content.length,
        text: "",
      });
    };

    return {
      // HOST to MODULE: capabilities.
      capabilities: {
        getContent: () => ({
          content: currentDoc?.content ?? "",
          docId: currentDoc?.id ?? null,
          title: currentDoc?.title ?? null,
          dirty,
          readOnly,
        }),

        setContent: ({ content }) => {
          if (readOnly) throw new Error("Editor is read-only");
          const doc = requireDoc();
          doc.content = content;
          dirty = true;
          log("editor:setContent", "setContent", {
            docId: doc.id,
            length: content.length,
          });
          markModifiedAt(content);
          return { ok: true };
        },

        format: ({ kind }) => {
          if (readOnly) throw new Error("Editor is read-only");
          const doc = requireDoc();
          let c = doc.content;
          switch (kind) {
            case "bold":
              c =
                c.startsWith("**") && c.endsWith("**")
                  ? c.slice(2, -2)
                  : `**${c}**`;
              break;
            case "italic":
              c =
                c.startsWith("_") && c.endsWith("_")
                  ? c.slice(1, -1)
                  : `_${c}_`;
              break;
            case "heading":
              c = c.startsWith("# ") ? c.slice(2) : `# ${c}`;
              break;
          }
          doc.content = c;
          dirty = true;
          log("editor:format", "format", { docId: doc.id, kind });
          markModifiedAt(c);
          return { content: c };
        },

        loadDocument: async ({ docId }) => {
          const doc = await requires.doc.load({ docId });
          currentDoc = { ...doc };
          dirty = false;
          log("editor:loadDocument", "loadDocument", {
            docId,
            title: doc.title,
          });
          return currentDoc;
        },

        saveDocument: async () => {
          const doc = requireDoc();
          const result = await requires.doc.save({
            docId: doc.id,
            title: doc.title,
            content: doc.content,
          });
          doc.updatedAt = result.updatedAt;
          dirty = false;
          log("editor:saveDocument", "saveDocument", {
            docId: result.id,
            updatedAt: result.updatedAt,
          });
          emit("doc:saved", { docId: result.id, version: 1 });
        },

        listDocuments: async ({ page = 1, limit = 20 } = {}) => {
          const list = await requires.doc.list({ page, limit });
          log("editor:listDocuments", "listDocuments", {
            page,
            limit,
            count: list.length,
          });
          return list;
        },

        exportDocument: async ({ format }) => {
          const doc = requireDoc();
          if (!requires.doc.export) return null;
          const out = await requires.doc.export({ docId: doc.id, format });
          log("editor:exportDocument", "exportDocument", {
            docId: doc.id,
            format,
          });
          return out;
        },
      },

      // HOST to MODULE: listener handlers.
      listeners: {
        "theme:changed": ({ theme: next }) => {
          theme = next;
          log("editor:themeChanged", "theme:changed", { theme });
        },
      },

      // ---------------------------------------------------------------
      // Lifecycle.
      // ---------------------------------------------------------------
      onMount: () => {
        requires.logger.write({
          action: "editor:mount",
          detail: { theme, locale, readOnly, toolbar },
        });
        return () => {
          requires.logger.write({ action: "editor:unmount" });
        };
      },
    };
  },
);
