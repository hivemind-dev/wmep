/**
 * @aurorah/wmep-file-manager — internal implementation
 *
 * INTERNAL implementation of the file-manager module.
 *
 * This file is private to the `file-manager/` directory; outside
 * code must import from `file-manager.wmep.ts` instead.
 *
 * All event/listener plumbing lives in `createWmepModule`. The
 * code below is pure domain logic.
 */

import { createWmepModule } from "../../src/core/index.js";
import type {
  FileEntry,
  FileManager,
  FileManagerState,
  FsEntryType,
  ViewMode,
} from "./file-manager.wmep.js";

// `createWmepModule<FileManager>(setup)` returns a fully-formed
// `WmepFactory<FileManager>`. The setup function receives the
// resolved `requires`, `config`, and a typed `emit`.
export const createFileManager = createWmepModule<FileManager>(
  ({ requires, config, emit }) => {
    // ---------------------------------------------------------------
    // Internal helpers.
    //
    // Pure functions over paths. Kept private because they aren't
    // part of the FileManager contract.
    // ---------------------------------------------------------------
    const normalizeDirPath = (path: string): string => {
      let p = path.replace(/\/+/g, "/");
      if (!p.startsWith("/")) p = `/${p}`;
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
      return p;
    };

    // ---------------------------------------------------------------
    // Resolve initial config values.
    // ---------------------------------------------------------------
    const rootPath = config.rootPath ?? "/";
    const showHidden = config.showHidden ?? false;
    let viewMode: ViewMode = config.viewMode ?? "tree";
    let currentPath = normalizeDirPath(rootPath);
    let selectedPath: string | null = currentPath;
    let selectedType: FsEntryType | null = "directory";

    // ---------------------------------------------------------------
    // Snapshot helper.
    //
    // We never return live state references; everything that crosses
    // the boundary is a fresh value. This protects the module's
    // internal state from accidental mutation by the host.
    // ---------------------------------------------------------------
    const stateSnapshot = (): FileManagerState => ({
      rootPath,
      showHidden,
      viewMode,
      currentPath,
      selectedPath,
      selectedType,
    });

    const filterHidden = (entries: FileEntry[]): FileEntry[] =>
      showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));

    // ---------------------------------------------------------------
    // Source tag for the structured logger.
    //
    // Every state-changing action funnels through requires.logger
    // with a `source` discriminator, mirroring the counter
    // example's `bump | reset | reset-on-request | interval-tick`.
    // ---------------------------------------------------------------
    type FileManagerSource =
      | "navigate"
      | "setViewMode"
      | "selectEntry"
      | "listDirectory"
      | "readFile"
      | "writeFile"
      | "deleteFile"
      | "moveFile"
      | "uploadFile"
      | "downloadFile"
      | "fs:externalChange";

    const log = (
      action: string,
      source: FileManagerSource,
      extra?: Record<string, unknown>,
    ): void => {
      requires.logger.write({
        action,
        detail: { source, ...extra },
      });
    };

    return {
      // HOST to MODULE: capabilities.
      capabilities: {
        getState: () => stateSnapshot(),

        navigate: ({ path }) => {
          currentPath = normalizeDirPath(path);
          selectedPath = currentPath;
          selectedType = "directory";
          log("file-manager:navigate", "navigate", { path: currentPath });
          emit("fs:selected", { path: selectedPath, type: selectedType });
          return { currentPath, selectedPath, selectedType };
        },

        setViewMode: ({ viewMode: next }) => {
          viewMode = next;
          log("file-manager:setViewMode", "setViewMode", { viewMode });
          return { viewMode };
        },

        selectEntry: ({ path, type }) => {
          selectedPath = path;
          selectedType = type;
          log("file-manager:selectEntry", "selectEntry", { path, type });
          emit("fs:selected", { path, type });
        },

        listDirectory: async (p) => {
          const dir =
            p?.path !== undefined ? normalizeDirPath(p.path) : currentPath;
          const entries = await requires.fs.list({
            path: dir,
            recursive: p?.recursive ?? false,
          });
          const filtered = filterHidden(entries);
          log("file-manager:listDirectory", "listDirectory", {
            path: dir,
            count: filtered.length,
          });
          return filtered;
        },

        readFile: async ({ path }) => {
          const content = await requires.fs.read({ path });
          log("file-manager:readFile", "readFile", {
            path,
            size: content.size,
          });
          return content;
        },

        writeFile: async ({ path, content, createDirs }) => {
          await requires.fs.write({ path, content, createDirs });
          log("file-manager:writeFile", "writeFile", {
            path,
            size: content.length,
          });
        },

        deleteFile: async ({ path, recursive }) => {
          await requires.fs.delete({ path, recursive });
          log("file-manager:deleteFile", "deleteFile", { path, recursive });
          emit("fs:deleted", { path });
          if (selectedPath === path) {
            selectedPath = null;
            selectedType = null;
          }
        },

        moveFile: async ({ from, to }) => {
          await requires.fs.move({ from, to });
          log("file-manager:moveFile", "moveFile", { from, to });
          emit("fs:renamed", { from, to });
          if (selectedPath === from) {
            selectedPath = to;
            // selectedType stays the same — rename doesn't change kind
          }
        },

        uploadFile: async ({ path, data }) => {
          if (!requires.fs.upload) {
            throw new Error("fs.upload is not bound");
          }
          await requires.fs.upload({ path, data });
          log("file-manager:uploadFile", "uploadFile", { path });
        },

        downloadFile: async ({ path }) => {
          if (!requires.fs.download) {
            throw new Error("fs.download is not bound");
          }
          const blob = await requires.fs.download({ path });
          log("file-manager:downloadFile", "downloadFile", {
            path,
            size: blob.size,
          });
          return blob;
        },

        canUpload: () => requires.fs.upload !== undefined,
        canDownload: () => requires.fs.download !== undefined,
      },

      // HOST to MODULE: listener handlers.
      listeners: {
        "fs:externalChange": ({ reason, paths }) => {
          // The module's job is to react to host-side mutations.
          // Here, we just log; a richer module would invalidate
          // caches, re-list directories, etc.
          log("file-manager:externalChange", "fs:externalChange", {
            reason,
            paths,
          });
        },
      },

      // ---------------------------------------------------------------
      // Lifecycle.
      //
      // No timers or subscriptions are needed for this module, so
      // onMount just announces readiness. We still keep the hook so
      // 'wmep:mounted' fires AFTER the initial state has been
      // committed.
      // ---------------------------------------------------------------
      onMount: () => {
        requires.logger.write({
          action: "file-manager:mount",
          detail: { rootPath, currentPath, viewMode, showHidden },
        });
        return () => {
          requires.logger.write({ action: "file-manager:unmount" });
        };
      },
    };
  },
);
