/**
 * File Manager example — Host-side integration
 *
 * Demonstrates the wMEP protocol with an optional-requires
 * surface (fs.upload / fs.download). The module checks
 * `requires.fs.upload !== undefined` to gate features.
 *
 * Run:
 *   npx tsx examples/file-manager/host-app.ts
 */

import { FileManager } from "./file-manager.wmep.js";
import type { FileEntry } from "./file-manager.wmep.js";

// ---------------------------------------------------------------
// Mock filesystem state held by the host.
// ---------------------------------------------------------------
interface MockFile {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  content: string;
  modifiedAt: string;
}

function isDirectChild(dirPath: string, path: string): boolean {
  if (path === dirPath) return false;
  if (dirPath === "/") return /^\/[^/]+$/.test(path);
  const prefix = `${dirPath.replace(/\/$/, "")}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/");
}

function directChildren(
  files: Map<string, MockFile>,
  dirPath: string,
): FileEntry[] {
  const out: FileEntry[] = [];
  for (const f of files.values()) {
    if (!isDirectChild(dirPath, f.path)) continue;
    out.push({
      name: f.name,
      path: f.path,
      type: f.type,
      size: f.size,
      modifiedAt: f.modifiedAt,
    });
  }
  return out;
}

function listRecursive(
  files: Map<string, MockFile>,
  dirPath: string,
): FileEntry[] {
  const base = dirPath === "/" ? "/" : `${dirPath.replace(/\/$/, "")}/`;
  const out: FileEntry[] = [];
  for (const f of files.values()) {
    if (f.path === dirPath) continue;
    const under =
      dirPath === "/"
        ? f.path.startsWith("/") && f.path.length > 1
        : f.path.startsWith(base);
    if (!under) continue;
    out.push({
      name: f.name,
      path: f.path,
      type: f.type,
      size: f.size,
      modifiedAt: f.modifiedAt,
    });
  }
  return out;
}

async function run(): Promise<void> {
  console.log("=== wMEP File Manager Example ===\n");

  const files = new Map<string, MockFile>();
  const now = () => new Date().toISOString();
  files.set("/docs", {
    name: "docs",
    path: "/docs",
    type: "directory",
    size: 0,
    content: "",
    modifiedAt: now(),
  });
  files.set("/docs/readme.md", {
    name: "readme.md",
    path: "/docs/readme.md",
    type: "file",
    size: 12,
    content: "# Hello wMEP",
    modifiedAt: now(),
  });
  files.set("/docs/spec.md", {
    name: "spec.md",
    path: "/docs/spec.md",
    type: "file",
    size: 20,
    content: "# wMEP Specification",
    modifiedAt: now(),
  });
  files.set("/src", {
    name: "src",
    path: "/src",
    type: "directory",
    size: 0,
    content: "",
    modifiedAt: now(),
  });
  files.set("/src/index.ts", {
    name: "index.ts",
    path: "/src/index.ts",
    type: "file",
    size: 11,
    content: "export {}",
    modifiedAt: now(),
  });

  // ---------------------------------------------------------------
  // HOST to MODULE: construction.
  //
  // The `requires` object supplies the host's fs backend. Upload
  // and download are intentionally provided so the example can
  // show how the module gates optional features behind a
  // simple presence check.
  // ---------------------------------------------------------------
  const fm = FileManager(
    {
      logger: {
        write: (entry) =>
          console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
      },
      fs: {
        list: async ({ path, recursive }) =>
          recursive ? listRecursive(files, path) : directChildren(files, path),

        read: async ({ path }) => {
          const f = files.get(path);
          if (!f || f.type !== "file")
            throw new Error(`File not found: ${path}`);
          return {
            path: f.path,
            content: f.content,
            encoding: "utf-8",
            size: f.size,
          };
        },

        write: async ({ path, content }) => {
          const name = path.split("/").pop() ?? "";
          const ts = now();
          files.set(path, {
            name,
            path,
            type: "file",
            size: content.length,
            content,
            modifiedAt: ts,
          });
          return { path, size: content.length, modifiedAt: ts };
        },

        delete: async ({ path, recursive }) => {
          if (recursive) {
            for (const p of [...files.keys()]) {
              if (p === path || p.startsWith(path === "/" ? "/" : `${path}/`)) {
                files.delete(p);
              }
            }
          } else {
            files.delete(path);
          }
        },

        move: async ({ from, to }) => {
          const f = files.get(from);
          if (!f) throw new Error(`Not found: ${from}`);
          files.delete(from);
          f.path = to;
          f.name = to.split("/").pop() ?? "";
          f.modifiedAt = now();
          files.set(to, f);
          return { from, to, modifiedAt: f.modifiedAt };
        },

        upload: async ({ path, data }) => {
          const content = await data.text();
          const name = path.split("/").pop() ?? "";
          const ts = now();
          files.set(path, {
            name,
            path,
            type: "file",
            size: content.length,
            content,
            modifiedAt: ts,
          });
          return { path, size: content.length, modifiedAt: ts };
        },

        download: async ({ path }) => {
          const f = files.get(path);
          if (!f || f.type !== "file")
            throw new Error(`File not found: ${path}`);
          return new Blob([f.content], {
            type: "application/octet-stream",
          });
        },
      },
    },
    { rootPath: "/", viewMode: "tree", showHidden: false },
  );

  // ---------------------------------------------------------------
  // MODULE to HOST: subscribe to events + lifecycle.
  // ---------------------------------------------------------------
  fm.on("wmep:mounted", () =>
    console.log("[Host] wmep:mounted -> file-manager is ready"),
  );
  fm.on("wmep:unmounted", ({ reason }) =>
    console.log(`[Host] wmep:unmounted -> reason=${reason ?? "(none)"}`),
  );
  fm.on("fs:selected", (e) => console.log("[Host] fs:selected:", e));
  fm.on("fs:renamed", (e) => console.log("[Host] fs:renamed:", e));
  fm.on("fs:deleted", (e) => console.log("[Host] fs:deleted:", e));

  console.log(`[Host] canUpload: ${fm.capabilities.canUpload()}`);
  console.log(`[Host] canDownload: ${fm.capabilities.canDownload()}`);

  // ---------------------------------------------------------------
  // HOST to MODULE: navigate.
  // ---------------------------------------------------------------
  console.log("-- navigate /docs --");
  console.log("[Host]", fm.capabilities.navigate({ path: "/docs" }));

  // ---------------------------------------------------------------
  // HOST to MODULE: listener notification.
  //
  // wMEP buffers this until after mount if it arrives early.
  // ---------------------------------------------------------------
  fm.notify("fs:externalChange", { reason: "mock-sync", paths: ["/docs"] });

  console.log("-- listDirectory / --");
  const root = await fm.capabilities.listDirectory({ path: "/" });
  console.log(
    "[Host] root entries:",
    root.map((e) => e.name),
  );

  console.log("-- listDirectory /docs --");
  const docs = await fm.capabilities.listDirectory({ path: "/docs" });
  console.log(
    "[Host] /docs entries:",
    docs.map((e) => e.name),
  );

  console.log("-- selectEntry readme --");
  fm.capabilities.selectEntry({ path: "/docs/readme.md", type: "file" });

  console.log("-- readFile readme --");
  const readme = await fm.capabilities.readFile({ path: "/docs/readme.md" });
  console.log(`[Host] readme content: "${readme.content}"`);

  console.log("-- writeFile new-file.md --");
  await fm.capabilities.writeFile({
    path: "/docs/new-file.md",
    content: "# New File\nCreated via wMEP",
  });

  console.log("-- moveFile new-file.md -> renamed-file.md --");
  await fm.capabilities.moveFile({
    from: "/docs/new-file.md",
    to: "/docs/renamed-file.md",
  });

  console.log("-- deleteFile renamed-file.md --");
  await fm.capabilities.deleteFile({ path: "/docs/renamed-file.md" });

  console.log("-- setViewMode list --");
  console.log("[Host]", fm.capabilities.setViewMode({ viewMode: "list" }));
  console.log("[Host] state:", fm.capabilities.getState());

  console.log("-- unmount --");
  await fm.unmount("demo-finished");

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
