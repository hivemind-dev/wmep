/**
 * Kanban Board example — Host-side integration
 *
 * Demonstrates wMEP with a richer event surface — drag/drop
 * lifecycle, host-driven external updates, and an optional
 * AsyncIterable `board.watch` feed.
 *
 * Run:
 *   npx tsx examples/kanban-board/host-app.ts
 */

import { Kanban } from "./kanban.wmep.js";
import type { Board, BoardWatchChunk, Card } from "./kanban.wmep.js";

async function run(): Promise<void> {
  console.log("=== wMEP Kanban Board Example ===\n");

  // ---------------------------------------------------------------
  // Host-side board state (mock persistence).
  // ---------------------------------------------------------------
  let nextCardId = 1;
  const columns = new Map<
    string,
    { id: string; name: string; cards: Card[] }
  >();
  columns.set("col-todo", { id: "col-todo", name: "To Do", cards: [] });
  columns.set("col-progress", {
    id: "col-progress",
    name: "In Progress",
    cards: [],
  });
  columns.set("col-done", { id: "col-done", name: "Done", cards: [] });

  const snapshotBoard = (): Board => ({
    id: "board-1",
    name: "Sprint Board",
    columns: Array.from(columns.values()).map((c) => ({
      id: c.id,
      name: c.name,
      cards: c.cards.map((card) => ({ ...card })),
    })),
  });

  // ---------------------------------------------------------------
  // HOST to MODULE: construction.
  // ---------------------------------------------------------------
  const kanban = Kanban(
    {
      logger: {
        write: (entry) =>
          console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
      },
      board: {
        load: async ({ boardId }) => ({ ...snapshotBoard(), id: boardId }),

        watch: async function* ({ boardId }): AsyncIterable<BoardWatchChunk> {
          yield {
            type: "snapshot",
            boardId,
            data: snapshotBoard(),
            userId: "mock",
            timestamp: Date.now(),
          };
        },
      },

      card: {
        create: async ({ columnId, title, description, assignee }) => {
          const id = `card-${nextCardId++}`;
          const card: Card = {
            id,
            title,
            description,
            assignee,
            columnId,
          };
          columns.get(columnId)?.cards.push(card);
          return card;
        },

        update: async (p) => {
          for (const col of columns.values()) {
            const card = col.cards.find((c) => c.id === p.cardId);
            if (card) {
              if (p.title !== undefined) card.title = p.title;
              if (p.description !== undefined) card.description = p.description;
              if (p.assignee !== undefined) card.assignee = p.assignee;
              return { ...card };
            }
          }
          throw new Error(`Card not found: ${p.cardId}`);
        },

        move: async ({ cardId, targetColumnId, position }) => {
          const targetCol = columns.get(targetColumnId);
          if (!targetCol) {
            throw new Error(`Column not found: ${targetColumnId}`);
          }
          for (const col of columns.values()) {
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
          for (const col of columns.values()) {
            const idx = col.cards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              col.cards.splice(idx, 1);
              return;
            }
          }
        },
      },
    },
    {
      columns: ["To Do", "In Progress", "Done"],
      swimlanes: false,
      assignees: ["Alice", "Bob"],
    },
  );

  // ---------------------------------------------------------------
  // MODULE to HOST: lifecycle + events.
  // ---------------------------------------------------------------
  kanban.on("wmep:mounted", () =>
    console.log("[Host] wmep:mounted -> kanban is ready"),
  );
  kanban.on("wmep:unmounted", ({ reason }) =>
    console.log(`[Host] wmep:unmounted -> reason=${reason ?? "(none)"}`),
  );
  kanban.on("board:changed", (e) => console.log("[Host] board:changed:", e));
  kanban.on("card:dragged", (e) => console.log("[Host] card:dragged:", e));
  kanban.on("card:dropped", (e) => console.log("[Host] card:dropped:", e));

  console.log("-- loadBoard board-1 --");
  await kanban.capabilities.loadBoard({ boardId: "board-1" });

  console.log("-- createCard #1 / #2 --");
  const card1 = await kanban.capabilities.createCard({
    columnId: "col-todo",
    title: "Implement wMEP runtime",
    description: "Core protocol",
    assignee: "Alice",
  });
  await kanban.capabilities.createCard({
    columnId: "col-todo",
    title: "Write documentation",
    assignee: "Bob",
  });

  console.log("-- getBoard columns --");
  const snap = kanban.capabilities.getBoard();
  console.log("[Host] columns:", snap.columns.map((c) => c.name).join(", "));

  console.log("-- moveCard #1 -> in-progress --");
  await kanban.capabilities.moveCard({
    cardId: card1.id,
    fromColumnId: "col-todo",
    targetColumnId: "col-progress",
  });

  console.log("-- moveCard #1 -> done --");
  await kanban.capabilities.moveCard({
    cardId: card1.id,
    fromColumnId: "col-progress",
    targetColumnId: "col-done",
  });

  console.log("-- getCard #1 --");
  console.log("[Host]", kanban.capabilities.getCard({ cardId: card1.id }));

  // HOST to MODULE: external board change notification.
  console.log("-- notify board:externalUpdate --");
  kanban.notify("board:externalUpdate", { board: snapshotBoard() });

  console.log("-- consumeWatch --");
  const chunks = await kanban.capabilities.consumeWatch({
    boardId: "board-1",
  });
  console.log(`[Host] watch chunks received: ${chunks.length}`);

  console.log("\n[Host] Final board state:");
  for (const col of columns.values()) {
    console.log(`  ${col.name}: [${col.cards.map((c) => c.title).join(", ")}]`);
  }

  console.log("-- unmount --");
  await kanban.unmount("demo-finished");

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
