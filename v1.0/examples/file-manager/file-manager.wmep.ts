/**
 * @aurorah/wmep-file-manager — boundary file
 *
 * THE BOUNDARY FILE for the file-manager module.
 *
 * Outside code (any file outside the `file-manager/` directory)
 * MUST import the module from THIS file. It is the only legal
 * cross-module entry point.
 *
 * One symbol — `FileManager` — is exported. Declaration merging
 * makes it both the contract (TYPE space) and the factory
 * (VALUE space).
 */

import type { WmepFactory, WmepModule } from "../../src/core/index.js";

import { createFileManager } from "./file-manager.js";

// -----------------------------------------------------------------
// Domain types (shared at the boundary).
// -----------------------------------------------------------------
export type FsEntryType = "file" | "directory";
export type ViewMode = "tree" | "grid" | "list";

export interface FileEntry {
  name: string;
  path: string;
  type: FsEntryType;
  size: number;
  modifiedAt: string;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
}

export interface FileManagerState {
  rootPath: string;
  showHidden: boolean;
  viewMode: ViewMode;
  currentPath: string;
  selectedPath: string | null;
  selectedType: FsEntryType | null;
}

// -----------------------------------------------------------------
// The contract.
//
// Five slots, fixed order:
//   1) capabilities (HOST to MODULE)
//   2) events       (MODULE to HOST)
//   3) listeners    (HOST to MODULE)
//   4) requires     (MODULE to HOST)
//   5) config       (HOST to MODULE)
// -----------------------------------------------------------------
export interface FileManager extends WmepModule<
  // HOST to MODULE: capabilities
  {
    /** Snapshot of the current selection / view state. */
    getState(): FileManagerState;

    /** Navigate to a directory. Emits 'fs:selected'. */
    navigate(p: { path: string }): {
      currentPath: string;
      selectedPath: string | null;
      selectedType: FsEntryType | null;
    };

    /** Switch view mode (tree / grid / list). */
    setViewMode(p: { viewMode: ViewMode }): { viewMode: ViewMode };

    /** Mark an entry as selected. Emits 'fs:selected'. */
    selectEntry(p: { path: string; type: FsEntryType }): void;

    /** List a directory via the host's fs backend. */
    listDirectory(p?: {
      path?: string;
      recursive?: boolean;
    }): Promise<FileEntry[]>;

    /** Read a file via the host's fs backend. */
    readFile(p: { path: string }): Promise<FileContent>;

    /** Write a file via the host's fs backend. */
    writeFile(p: {
      path: string;
      content: string;
      createDirs?: boolean;
    }): Promise<void>;

    /** Delete a file or directory. Emits 'fs:deleted'. */
    deleteFile(p: { path: string; recursive?: boolean }): Promise<void>;

    /** Move/rename. Emits 'fs:renamed'. */
    moveFile(p: { from: string; to: string }): Promise<void>;

    /** Upload a Blob (optional — requires fs.upload). */
    uploadFile(p: { path: string; data: Blob }): Promise<void>;

    /** Download a file as a Blob (optional — requires fs.download). */
    downloadFile(p: { path: string }): Promise<Blob>;

    /** True if the host wired up fs.upload. */
    canUpload(): boolean;

    /** True if the host wired up fs.download. */
    canDownload(): boolean;
  },
  // MODULE to HOST: events
  {
    "fs:selected": { path: string; type: FsEntryType };
    "fs:renamed": { from: string; to: string };
    "fs:deleted": { path: string };
  },
  // HOST to MODULE: listeners
  {
    /** Host signals that some paths changed on its side. */
    "fs:externalChange": { reason?: string; paths?: string[] };
  },
  // MODULE to HOST: requires
  {
    /** Host-supplied audit logger. Every state-changing action
     *  funnels through this endpoint, mirroring the counter
     *  example's logging convention. */
    logger: { write(entry: { action: string; detail?: unknown }): void };

    fs: {
      list(p: { path: string; recursive?: boolean }): Promise<FileEntry[]>;
      read(p: { path: string }): Promise<FileContent>;
      write(p: {
        path: string;
        content: string;
        createDirs?: boolean;
      }): Promise<{ path: string; size: number; modifiedAt: string }>;
      delete(p: { path: string; recursive?: boolean }): Promise<void>;
      move(p: {
        from: string;
        to: string;
      }): Promise<{ from: string; to: string; modifiedAt: string }>;
      /** Optional — host may omit if uploads aren't supported. */
      upload?(p: {
        path: string;
        data: Blob;
      }): Promise<{ path: string; size: number; modifiedAt: string }>;
      /** Optional — host may omit if downloads aren't supported. */
      download?(p: { path: string }): Promise<Blob>;
    };
  },
  // HOST to MODULE: config
  {
    rootPath?: string;
    showHidden?: boolean;
    viewMode?: ViewMode;
  }
> {
  /** Identity of this module — overrides the base default. */
  module: { name: "@aurorah/wmep-file-manager"; version: "1.0.0" };
}

export const FileManager: WmepFactory<FileManager> = createFileManager;
