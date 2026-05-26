/**
 * wMEP Orchestration Host
 * =======================
 *
 * A single host that composes six independent wMEP modules into
 * one cohesive "workspace" application:
 *
 *   - Counter      (counter)
 *   - Dashboard    (analytics-dashboard)
 *   - FileManager  (file-manager)
 *   - Kanban       (kanban-board)
 *   - Player       (media-player)
 *   - Editor       (rich-text-editor)
 *
 * Each module is imported ONLY from its boundary file
 * (`*.wmep.ts`). The host:
 *
 *   1) Mounts all six modules with shared backends supplied
 *      through each module's `requires` slot.
 *   2) Subscribes to every module's events plus the reserved
 *      `wmep:mounted` / `wmep:unmounted` lifecycle.
 *   3) Demonstrates cross-module orchestration:
 *
 *        - Editor saves a doc      ->  Dashboard receives
 *                                       `data:invalidated`
 *                                       (host-driven listener)
 *        - FileManager deletes a   ->  Kanban deletes the
 *          path that maps to a         matching card via
 *          kanban card                  notify-driven workflow
 *        - Player playback ticks   ->  Dashboard reports them
 *                                       as click events for
 *                                       audit metrics
 *        - Counter ticks / bumps   ->  Dashboard reports them
 *                                       as click events too
 *
 *   4) Cleanly tears every module down in parallel with
 *      `await Promise.all([...unmount()])`.
 *
 * Run:
 *   npx tsx examples/orchestration-host-app.ts
 */

import { Counter } from "./counter/counter.wmep.js";

import { Dashboard } from "./analytics-dashboard/dashboard.wmep.js";
import type {
  AggregateResult,
  LiveUpdate,
  MetricPoint,
} from "./analytics-dashboard/dashboard.wmep.js";

import { FileManager } from "./file-manager/file-manager.wmep.js";
import type { FileEntry } from "./file-manager/file-manager.wmep.js";

import { Kanban } from "./kanban-board/kanban.wmep.js";
import type {
  Board,
  BoardWatchChunk,
  Card,
} from "./kanban-board/kanban.wmep.js";

import { Player } from "./media-player/player.wmep.js";
import type { StreamChunk, Track } from "./media-player/player.wmep.js";

import { Editor } from "./rich-text-editor/editor.wmep.js";
import type {
  EditorDocument,
  ExportFormat,
} from "./rich-text-editor/editor.wmep.js";

// =================================================================
// 1) Shared host-side infrastructure.
//
//    These backends are owned BY THE HOST and shared across the
//    five modules' `requires` slots. Nothing here is part of any
//    module — it is the host's private internal state.
// =================================================================

// -----------------------------------------------------------------
// Mock metrics backend (consumed by Dashboard).
// -----------------------------------------------------------------
function generateTimeSeries(metric: string, days: number): MetricPoint[] {
  const out: MetricPoint[] = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    out.push({
      timestamp: new Date(now - i * 86_400_000).toISOString(),
      value: Math.floor(Math.random() * 1000),
      label: metric,
    });
  }
  return out.reverse();
}

// -----------------------------------------------------------------
// Mock filesystem backend (consumed by FileManager).
// -----------------------------------------------------------------
interface MockFile {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  content: string;
  modifiedAt: string;
}

function directChildren(
  files: Map<string, MockFile>,
  dirPath: string,
): FileEntry[] {
  const out: FileEntry[] = [];
  const isDirect = (p: string): boolean => {
    if (p === dirPath) return false;
    if (dirPath === "/") return /^\/[^/]+$/.test(p);
    const prefix = `${dirPath.replace(/\/$/, "")}/`;
    if (!p.startsWith(prefix)) return false;
    const rest = p.slice(prefix.length);
    return rest.length > 0 && !rest.includes("/");
  };
  for (const f of files.values()) {
    if (!isDirect(f.path)) continue;
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

// -----------------------------------------------------------------
// Mock kanban/track/doc backends.
// -----------------------------------------------------------------
interface KanbanState {
  nextCardId: number;
  columns: Map<string, { id: string; name: string; cards: Card[] }>;
}

interface TrackDb {
  tracks: Map<string, Track>;
  playlists: Map<string, { id: string; name: string; trackIds: string[] }>;
}

// =================================================================
// 2) Orchestration: build the host, wire all five modules, run
//    cross-module flows, then unmount cleanly.
// =================================================================

async function run(): Promise<void> {
  console.log("=== wMEP Orchestration Host ===\n");

  // ---------------------------------------------------------------
  // Shared mutable state.
  // ---------------------------------------------------------------
  const now = (): string => new Date().toISOString();
  const auditLog: string[] = [];
  const audit = (line: string): void => {
    auditLog.push(line);
    console.log(`[Host:audit] ${line}`);
  };

  // -----------------------------------------------------------
  // Shared module-side logger.
  //
  // Every module's `requires.logger` points at this single sink
  // so the host gets a unified action stream across all 5
  // modules. Same shape as the counter example's logger.
  // -----------------------------------------------------------
  const logger = {
    write: (entry: { action: string; detail?: unknown }): void =>
      console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
  };

  // ── Filesystem ─────────────────────────────────────────────────
  const files = new Map<string, MockFile>();
  files.set("/notes", {
    name: "notes",
    path: "/notes",
    type: "directory",
    size: 0,
    content: "",
    modifiedAt: now(),
  });
  files.set("/notes/release-plan.md", {
    name: "release-plan.md",
    path: "/notes/release-plan.md",
    type: "file",
    size: 24,
    content: "# Release Plan\n- ship",
    modifiedAt: now(),
  });

  // ── Kanban ─────────────────────────────────────────────────────
  const kanbanState: KanbanState = {
    nextCardId: 1,
    columns: new Map([
      ["col-todo", { id: "col-todo", name: "To Do", cards: [] }],
      ["col-doing", { id: "col-doing", name: "Doing", cards: [] }],
      ["col-done", { id: "col-done", name: "Done", cards: [] }],
    ]),
  };

  const kanbanSnapshot = (): Board => ({
    id: "board-workspace",
    name: "Workspace Board",
    columns: Array.from(kanbanState.columns.values()).map((c) => ({
      id: c.id,
      name: c.name,
      cards: c.cards.map((card) => ({ ...card })),
    })),
  });

  // -----------------------------------------------------------
  // Mapping table from filesystem path -> kanban card id.
  // Lets a "delete file" event also delete the matching card,
  // which is the cross-module flow we want to demonstrate.
  // -----------------------------------------------------------
  const pathToCardId = new Map<string, string>();

  // ── Media ──────────────────────────────────────────────────────
  const media: TrackDb = {
    tracks: new Map<string, Track>([
      [
        "t-1",
        {
          id: "t-1",
          title: "Focus Mode",
          artist: "Ambient Labs",
          duration: 120,
          format: "mp3",
        },
      ],
      [
        "t-2",
        {
          id: "t-2",
          title: "Deep Work",
          artist: "Ambient Labs",
          duration: 90,
          format: "mp3",
        },
      ],
    ]),
    playlists: new Map([
      ["focus", { id: "focus", name: "Focus Loop", trackIds: ["t-1", "t-2"] }],
    ]),
  };

  // ── Docs ───────────────────────────────────────────────────────
  const docs = new Map<string, EditorDocument>([
    [
      "doc-spec",
      {
        id: "doc-spec",
        title: "wMEP Spec",
        content: "# wMEP\nOne interface per module.",
        updatedAt: now(),
      },
    ],
  ]);

  // ---------------------------------------------------------------
  // 3) Construct every module. Each gets its OWN `requires` object
  //    pointing at the relevant slice of shared host state above.
  // ---------------------------------------------------------------

  // ── Dashboard ──────────────────────────────────────────────────
  const dashboard = Dashboard(
    {
      logger,
      metrics: {
        query: async ({ metric }) => generateTimeSeries(metric, 7),
        aggregate: async ({ metrics }) => {
          const out: AggregateResult = {};
          for (const m of metrics) {
            const values = generateTimeSeries(m, 30).map((p) => p.value);
            const total = values.reduce((a, b) => a + b, 0);
            out[m] = {
              total,
              avg: Math.round(total / values.length),
              min: Math.min(...values),
              max: Math.max(...values),
            };
          }
          return out;
        },
        live: async function* (): AsyncIterable<LiveUpdate> {
          // Empty stream — orchestration host doesn't push live
          // updates here; consumers can extend this.
        },
      },
    },
    {
      chartType: "area",
      refreshInterval: 0,
      primaryMetric: "card-throughput",
      dateRange: { start: "2026-04-01", end: "2026-04-30" },
    },
  );

  // ── FileManager ────────────────────────────────────────────────
  const fm = FileManager(
    {
      logger,
      fs: {
        list: async ({ path }) => directChildren(files, path),
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
        delete: async ({ path }) => {
          files.delete(path);
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
      },
    },
    { rootPath: "/", viewMode: "list", showHidden: false },
  );

  // ── Kanban ─────────────────────────────────────────────────────
  const kanban = Kanban(
    {
      logger,
      board: {
        load: async ({ boardId }) => ({ ...kanbanSnapshot(), id: boardId }),
        watch: async function* ({ boardId }): AsyncIterable<BoardWatchChunk> {
          yield {
            type: "snapshot",
            boardId,
            data: kanbanSnapshot(),
            userId: "host",
            timestamp: Date.now(),
          };
        },
      },
      card: {
        create: async ({ columnId, title, description, assignee }) => {
          const id = `card-${kanbanState.nextCardId++}`;
          const card: Card = { id, title, description, assignee, columnId };
          kanbanState.columns.get(columnId)?.cards.push(card);
          return card;
        },
        update: async ({ cardId, title, description, assignee }) => {
          for (const col of kanbanState.columns.values()) {
            const c = col.cards.find((x) => x.id === cardId);
            if (c) {
              if (title !== undefined) c.title = title;
              if (description !== undefined) c.description = description;
              if (assignee !== undefined) c.assignee = assignee;
              return { ...c };
            }
          }
          throw new Error(`Card not found: ${cardId}`);
        },
        move: async ({ cardId, targetColumnId, position }) => {
          const targetCol = kanbanState.columns.get(targetColumnId);
          if (!targetCol)
            throw new Error(`Column not found: ${targetColumnId}`);
          for (const col of kanbanState.columns.values()) {
            const idx = col.cards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              const [card] = col.cards.splice(idx, 1);
              card.columnId = targetCol.id;
              const pos = position ?? targetCol.cards.length;
              targetCol.cards.splice(pos, 0, card);
              return;
            }
          }
          throw new Error(`Card not found: ${cardId}`);
        },
        delete: async ({ cardId }) => {
          for (const col of kanbanState.columns.values()) {
            const idx = col.cards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              col.cards.splice(idx, 1);
              return;
            }
          }
        },
      },
    },
    { columns: ["To Do", "Doing", "Done"], swimlanes: false },
  );

  // ── Player ─────────────────────────────────────────────────────
  const player = Player(
    {
      logger,
      playlist: {
        load: async ({ playlistId }) => {
          const pl = media.playlists.get(playlistId);
          if (!pl) throw new Error(`Playlist not found: ${playlistId}`);
          return {
            id: pl.id,
            name: pl.name,
            tracks: pl.trackIds
              .map((id) => media.tracks.get(id))
              .filter((t): t is Track => Boolean(t)),
          };
        },
        add: async ({ playlistId, trackId }) => {
          const pl = media.playlists.get(playlistId);
          if (!pl) throw new Error(`Playlist not found: ${playlistId}`);
          pl.trackIds.push(trackId);
          return {
            id: pl.id,
            name: pl.name,
            tracks: pl.trackIds
              .map((id) => media.tracks.get(id))
              .filter((t): t is Track => Boolean(t)),
          };
        },
        remove: async ({ playlistId, trackId }) => {
          const pl = media.playlists.get(playlistId);
          if (!pl) throw new Error(`Playlist not found: ${playlistId}`);
          pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
        },
      },
      track: {
        info: async ({ trackId }) => {
          const t = media.tracks.get(trackId);
          if (!t) throw new Error(`Track not found: ${trackId}`);
          return t;
        },
        stream: async function* ({ trackId }): AsyncIterable<StreamChunk> {
          for (let i = 0; i < 3; i++) {
            yield { chunk: i, bytes: 32_768, trackId };
          }
        },
      },
    },
    { volume: 0.6, autoplay: false, repeat: "off", shuffle: false },
  );

  // ── Counter ────────────────────────────────────────────────────
  //
  // The counter has no domain backend — its only `requires`
  // endpoint is the shared `logger`. Its onMount starts a
  // 1s self-ticking interval, so the host should keep the
  // demo short or unmount before too many ticks land.
  const counter = Counter(
    { logger },
    { initial: 0, step: 1 },
  );

  // ── Editor ─────────────────────────────────────────────────────
  const editor = Editor(
    {
      logger,
      doc: {
        load: async ({ docId }) => {
          const d = docs.get(docId);
          if (!d) throw new Error(`Document not found: ${docId}`);
          return { ...d };
        },
        save: async ({ docId, title, content }) => {
          const d = docs.get(docId);
          if (!d) throw new Error(`Document not found: ${docId}`);
          d.content = content;
          if (title) d.title = title;
          d.updatedAt = now();
          return { id: docId, updatedAt: d.updatedAt };
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
          const d = docs.get(docId);
          if (!d) throw new Error(`Document not found: ${docId}`);
          return new Blob([`[${format}] ${d.title}\n\n${d.content}`], {
            type: "text/plain",
          });
        },
      },
    },
    { theme: "light", locale: "en", toolbar: ["bold", "italic", "heading"] },
  );

  // ---------------------------------------------------------------
  // 4) Wire up MODULE-to-HOST event subscriptions.
  //
  //    The host listens to each module's outbound events. Some
  //    of these subscriptions form the cross-module flows by
  //    pushing notifications into OTHER modules via `notify(...)`.
  // ---------------------------------------------------------------

  // ── Lifecycle (reserved events on every module) ────────────────
  const announceMount = (name: string) => (): void => {
    audit(`mount: ${name}`);
  };
  const announceUnmount =
    (name: string) =>
    (event: { reason?: string }): void => {
      audit(`unmount: ${name} reason=${event?.reason ?? "(none)"}`);
    };
  counter.on("wmep:mounted", announceMount("counter"));
  counter.on("wmep:unmounted", announceUnmount("counter"));
  dashboard.on("wmep:mounted", announceMount("dashboard"));
  dashboard.on("wmep:unmounted", announceUnmount("dashboard"));
  fm.on("wmep:mounted", announceMount("file-manager"));
  fm.on("wmep:unmounted", announceUnmount("file-manager"));
  kanban.on("wmep:mounted", announceMount("kanban"));
  kanban.on("wmep:unmounted", announceUnmount("kanban"));
  player.on("wmep:mounted", announceMount("player"));
  player.on("wmep:unmounted", announceUnmount("player"));
  editor.on("wmep:mounted", announceMount("editor"));
  editor.on("wmep:unmounted", announceUnmount("editor"));

  // ── Counter events ─────────────────────────────────────────────
  // CROSS-MODULE: every counter change is reported to the
  // dashboard as a click-style audit metric, the same way
  // player progress is reported below. This shows two
  // independently authored modules cooperating via the host.
  counter.on("counter:changed", (e) => {
    audit(`counter: value=${e.value} source=${e.source}`);
    dashboard.capabilities.reportClick({
      metric: `counter:${e.source}`,
      value: e.value,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Dashboard events ───────────────────────────────────────────
  dashboard.on("chart:clicked", (e) =>
    audit(`dashboard: chart-click metric=${e.metric} value=${e.value}`),
  );
  dashboard.on("filter:changed", () => audit("dashboard: filters changed"));

  // ── File manager events ────────────────────────────────────────
  fm.on("fs:selected", (e) => audit(`fm: selected ${e.path}`));
  fm.on("fs:renamed", (e) => audit(`fm: renamed ${e.from} -> ${e.to}`));
  // CROSS-MODULE: a deleted file may correspond to a kanban card.
  fm.on("fs:deleted", (e) => {
    audit(`fm: deleted ${e.path}`);
    const cardId = pathToCardId.get(e.path);
    if (cardId) {
      pathToCardId.delete(e.path);
      void kanban.capabilities.deleteCard({ cardId }).catch(() => {});
    }
  });

  // ── Kanban events ──────────────────────────────────────────────
  kanban.on("board:changed", (e) => {
    audit(`kanban: ${e.action} cardId=${e.cardId}`);
    // CROSS-MODULE: every board change "invalidates" dashboard data.
    dashboard.notify("data:invalidated", { reason: `kanban:${e.action}` });
  });
  kanban.on("card:dragged", (e) => audit(`kanban: drag ${e.cardId}`));
  kanban.on("card:dropped", (e) =>
    audit(`kanban: drop ${e.cardId} -> ${e.toColumnId}`),
  );

  // ── Player events ──────────────────────────────────────────────
  player.on("playback:stateChanged", (e) =>
    audit(`player: state=${e.state} track=${e.trackId}`),
  );
  // CROSS-MODULE: report playback ticks as low-volume analytics.
  player.on("playback:progress", (e) => {
    if (e.percentage % 33 === 0 || e.percentage === 100) {
      dashboard.capabilities.reportClick({
        metric: `playback:${e.trackId}`,
        value: e.percentage,
        timestamp: new Date().toISOString(),
      });
    }
  });
  player.on("track:ended", (e) => audit(`player: ended ${e.trackId}`));

  // ── Editor events ──────────────────────────────────────────────
  editor.on("doc:modified", (e) => audit(`editor: modified ${e.docId}`));
  // CROSS-MODULE: a save bumps an analytics refresh.
  editor.on("doc:saved", (e) => {
    audit(`editor: saved ${e.docId} v${e.version}`);
    dashboard.notify("data:invalidated", { reason: "editor:save" });
  });

  // ---------------------------------------------------------------
  // 5) Drive a small end-to-end scenario across the modules.
  //
  //    These are sequenced for the demo. The point is to show
  //    that capabilities, events, listeners, and requires from
  //    five independent modules compose cleanly under one host.
  // ---------------------------------------------------------------

  console.log("\n--- bootstrap: load board + playlist + doc ---");
  await kanban.capabilities.loadBoard({ boardId: "board-workspace" });
  await player.capabilities.loadPlaylist({ playlistId: "focus" });
  await editor.capabilities.loadDocument({ docId: "doc-spec" });

  console.log("\n--- counter: bump + reset-request ---");
  counter.capabilities.bump({ amount: 5 });
  counter.capabilities.bump();
  // HOST to MODULE: notify reaches the listener and triggers a
  // reset with source 'reset-on-request'. Buffering would apply
  // here too if the call were made pre-mount.
  counter.notify("counter:reset-request", undefined);
  console.log("[Host] counter state:", counter.capabilities.state());

  console.log("\n--- file-manager: create note for new feature ---");
  const featurePath = "/notes/feature-x.md";
  await fm.capabilities.writeFile({
    path: featurePath,
    content: "# Feature X\nDesign doc.",
  });

  console.log("\n--- kanban: create a card mirroring the note ---");
  const card = await kanban.capabilities.createCard({
    columnId: "col-todo",
    title: "Feature X",
    description: featurePath,
    assignee: "Alice",
  });
  pathToCardId.set(featurePath, card.id);

  console.log("\n--- kanban: move the card across the board ---");
  await kanban.capabilities.moveCard({
    cardId: card.id,
    fromColumnId: "col-todo",
    targetColumnId: "col-doing",
  });
  await kanban.capabilities.moveCard({
    cardId: card.id,
    fromColumnId: "col-doing",
    targetColumnId: "col-done",
  });

  console.log("\n--- player: kick off background audio ---");
  await player.capabilities.play({ trackIndex: 0 });
  // Give the playback session a few ticks; events arrive async.
  await new Promise((r) => setTimeout(r, 50));

  console.log("\n--- editor: edit + save (will notify dashboard) ---");
  editor.capabilities.setContent({
    content:
      "# wMEP\nOne interface per module.\nUpdated by orchestration host.",
  });
  await editor.capabilities.saveDocument();

  console.log("\n--- dashboard: refresh + click report ---");
  console.log("[Host]", await dashboard.capabilities.refresh());
  dashboard.capabilities.setFilters({
    filters: { workspace: "demo" },
  });

  console.log("\n--- file-manager: delete the note (cascades to kanban) ---");
  await fm.capabilities.deleteFile({ path: featurePath });
  // Allow the cross-module deleteCard call to settle.
  await new Promise((r) => setTimeout(r, 20));

  console.log("\n--- final kanban board snapshot ---");
  const finalBoard = kanban.capabilities.getBoard();
  for (const col of finalBoard.columns) {
    console.log(`  ${col.name}: [${col.cards.map((c) => c.title).join(", ")}]`);
  }

  // ---------------------------------------------------------------
  // 6) Teardown — unmount EVERY module in parallel so cleanup
  //    closures run concurrently. `unmount()` is idempotent.
  // ---------------------------------------------------------------
  console.log("\n--- teardown ---");
  await Promise.all([
    counter.unmount("workspace-shutdown"),
    dashboard.unmount("workspace-shutdown"),
    fm.unmount("workspace-shutdown"),
    kanban.unmount("workspace-shutdown"),
    player.unmount("workspace-shutdown"),
    editor.unmount("workspace-shutdown"),
  ]);

  console.log("\n=== Done ===");
  console.log(`[Host] audit entries: ${auditLog.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
