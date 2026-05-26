/**
 * Rich Text Editor example — Host-side integration
 *
 * Demonstrates wMEP with an editor that mutates content, emits
 * doc/selection events, and accepts a theme listener from the
 * host.
 *
 * Run:
 *   npx tsx examples/rich-text-editor/host-app.ts
 */

import { Editor } from "./editor.wmep.js";
import type { EditorDocument, ExportFormat } from "./editor.wmep.js";

async function run(): Promise<void> {
  console.log("=== wMEP Rich Text Editor Example ===\n");

  // ---------------------------------------------------------------
  // Host-side document store (mock persistence).
  // ---------------------------------------------------------------
  const docs = new Map<string, EditorDocument>();
  docs.set("doc-1", {
    id: "doc-1",
    title: "Getting Started with wMEP",
    content: "# wMEP\nA protocol for module-level interfaces.",
    updatedAt: new Date().toISOString(),
  });
  docs.set("doc-2", {
    id: "doc-2",
    title: "Architecture Overview",
    content: "# Architecture\nHost, module, capabilities.",
    updatedAt: new Date().toISOString(),
  });

  // ---------------------------------------------------------------
  // HOST to MODULE: construction.
  // ---------------------------------------------------------------
  const editor = Editor(
    {
      logger: {
        write: (entry) =>
          console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
      },
      doc: {
        load: async ({ docId }) => {
          const doc = docs.get(docId);
          if (!doc) throw new Error(`Document not found: ${docId}`);
          return { ...doc };
        },

        save: async ({ docId, title, content }) => {
          const existing = docs.get(docId);
          if (!existing) throw new Error(`Document not found: ${docId}`);
          existing.content = content;
          if (title) existing.title = title;
          existing.updatedAt = new Date().toISOString();
          return { id: docId, updatedAt: existing.updatedAt };
        },

        list: async ({ page, limit }) => {
          const all = Array.from(docs.values());
          return all.slice((page - 1) * limit, page * limit);
        },

        export: async ({
          docId,
          format,
        }: {
          docId: string;
          format: ExportFormat;
        }) => {
          const doc = docs.get(docId);
          if (!doc) throw new Error(`Document not found: ${docId}`);
          const text = `[${format}] ${doc.title}\n\n${doc.content}`;
          return new Blob([text], { type: "text/plain" });
        },
      },
    },
    {
      theme: "dark",
      locale: "en",
      toolbar: ["bold", "italic", "heading"],
      readOnly: false,
    },
  );

  // ---------------------------------------------------------------
  // MODULE to HOST: lifecycle + events.
  // ---------------------------------------------------------------
  editor.on("wmep:mounted", () =>
    console.log("[Host] wmep:mounted -> editor is ready"),
  );
  editor.on("wmep:unmounted", ({ reason }) =>
    console.log(`[Host] wmep:unmounted -> reason=${reason ?? "(none)"}`),
  );
  editor.on("doc:modified", (e) => console.log("[Host] doc:modified:", e));
  editor.on("doc:saved", (e) => console.log("[Host] doc:saved:", e));
  editor.on("selection:changed", (e) =>
    console.log("[Host] selection:changed:", e),
  );

  console.log("-- listDocuments --");
  const listed = await editor.capabilities.listDocuments();
  console.log(`[Host] ${listed.length} documents`);

  console.log("-- loadDocument doc-1 --");
  await editor.capabilities.loadDocument({ docId: "doc-1" });

  console.log("-- getContent --");
  const snap = editor.capabilities.getContent();
  console.log("[Host]", {
    docId: snap.docId,
    dirty: snap.dirty,
    preview: snap.content.slice(0, 40),
  });

  // Host-side input sanitisation can happen here, before we hand
  // the value to the module — analogous to the wMCP override.
  const userInput = "Hello <script>alert(1)</script> world";
  const sanitized = userInput.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  console.log("-- setContent (sanitized) --");
  editor.capabilities.setContent({ content: sanitized });

  console.log("-- format bold --");
  console.log("[Host]", editor.capabilities.format({ kind: "bold" }));

  console.log("-- saveDocument --");
  await editor.capabilities.saveDocument();

  console.log("-- notify theme:changed sepia --");
  editor.notify("theme:changed", { theme: "sepia" });

  console.log("-- exportDocument markdown --");
  const exported = await editor.capabilities.exportDocument({
    format: "markdown",
  });
  if (exported instanceof Blob) {
    console.log(`[Host] export blob size: ${exported.size}`);
  }

  console.log("-- unmount --");
  await editor.unmount("demo-finished");

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
