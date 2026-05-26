/**
 * @aurorah/wmep-rich-editor — boundary file
 *
 * THE BOUNDARY FILE for the rich-text-editor module.
 *
 * One symbol — `Editor` — exported. Declaration merging makes
 * it both the contract (TYPE space) and the factory (VALUE
 * space).
 */

import type { WmepFactory, WmepModule } from "../../src/core/index.js";

import { createEditor } from "./editor.js";

// -----------------------------------------------------------------
// Domain types (shared at the boundary).
// -----------------------------------------------------------------
export interface EditorDocument {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export type FormatKind = "bold" | "italic" | "heading";

export type ExportFormat = "pdf" | "html" | "markdown";

// -----------------------------------------------------------------
// The contract.
// -----------------------------------------------------------------
export interface Editor extends WmepModule<
  // HOST to MODULE: capabilities
  {
    /** Snapshot of the current document state. */
    getContent(): {
      content: string;
      docId: string | null;
      title: string | null;
      dirty: boolean;
      readOnly: boolean;
    };

    /**
     * Replace the document content. Throws when read-only.
     * Emits 'doc:modified' + 'selection:changed'.
     */
    setContent(p: { content: string }): { ok: true };

    /** Apply a format transformation. */
    format(p: { kind: FormatKind }): { content: string };

    /** Load a document by id from the host. */
    loadDocument(p: { docId: string }): Promise<EditorDocument>;

    /** Save the current document to the host. */
    saveDocument(): Promise<void>;

    /** Paginated list of documents. */
    listDocuments(p?: {
      page?: number;
      limit?: number;
    }): Promise<EditorDocument[]>;

    /** Export via host. Returns null if doc.export isn't bound. */
    exportDocument(p: { format: ExportFormat }): Promise<Blob | string | null>;
  },
  // MODULE to HOST: events
  {
    "doc:modified": { docId: string; dirty: boolean };
    "doc:saved": { docId: string; version: number };
    "selection:changed": { start: number; end: number; text: string };
  },
  // HOST to MODULE: listeners
  {
    /** Host tells the editor to switch themes. */
    "theme:changed": { theme: string };
  },
  // MODULE to HOST: requires
  {
    /** Host-supplied audit logger. Every state-changing action
     *  funnels through this endpoint, mirroring the counter
     *  example's logging convention. */
    logger: { write(entry: { action: string; detail?: unknown }): void };

    doc: {
      load(p: { docId: string }): Promise<EditorDocument>;
      save(p: {
        docId: string;
        title: string;
        content: string;
      }): Promise<{ id: string; updatedAt: string }>;
      list(p: { page: number; limit: number }): Promise<EditorDocument[]>;
      /** Optional — host may omit if export isn't supported. */
      export?(p: {
        docId: string;
        format: ExportFormat;
      }): Promise<Blob | string>;
    };
  },
  // HOST to MODULE: config
  {
    theme?: string;
    locale?: string;
    toolbar?: string[];
    readOnly?: boolean;
  }
> {
  /** Identity of this module — overrides the base default. */
  module: { name: "@aurorah/wmep-rich-editor"; version: "1.0.0" };
}

export const Editor: WmepFactory<Editor> = createEditor;
