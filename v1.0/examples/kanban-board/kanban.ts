/**
 * @aurorah/wmep-kanban-board — internal implementation
 *
 * INTERNAL implementation of the kanban-board module.
 *
 * This file is private to the `kanban-board/` directory; outside
 * code must import from `kanban.wmep.ts` instead.
 *
 * All event/listener plumbing lives in `createWmepModule`.
 */

import { createWmepModule } from "../../src/core/index.js";
import type { Board, BoardWatchChunk, Card, Kanban } from "./kanban.wmep.js";

// Single source of truth for "give back a deep clone so the host
// can't accidentally mutate our state".
function cloneBoard(board: Board): Board {
  return structuredClone(board);
}

// `createWmepModule<Kanban>(setup)` returns a fully-formed
// `WmepFactory<Kanban>`.
export const createKanban = createWmepModule<Kanban>(
  ({ requires, config, emit }) => {
    // ---------------------------------------------------------------
    // Private state. Captured by the closures below.
    // ---------------------------------------------------------------
    let board: Board | null = null;

    // ---------------------------------------------------------------
    // Internal helpers — never crossed the boundary.
    // ---------------------------------------------------------------
    const requireBoard = (): Board => {
      if (!board) throw new Error("No board loaded");
      return board;
    };

    const findCard = (cardId: string): Card | undefined => {
      if (!board) return undefined;
      for (const col of board.columns) {
        const c = col.cards.find((x) => x.id === cardId);
        if (c) return c;
      }
      return undefined;
    };

    const locateColumnId = (cardId: string): string | undefined => {
      if (!board) return undefined;
      for (const col of board.columns) {
        if (col.cards.some((c) => c.id === cardId)) return col.id;
      }
      return undefined;
    };

    // ---------------------------------------------------------------
    // Source tag for the structured logger.
    //
    // Every state-changing action funnels through requires.logger
    // with a `source` discriminator, mirroring the counter
    // example's `bump | reset | reset-on-request | interval-tick`.
    // ---------------------------------------------------------------
    type KanbanSource =
      | "loadBoard"
      | "createCard"
      | "moveCard"
      | "deleteCard"
      | "consumeWatch"
      | "board:externalUpdate";

    const log = (
      action: string,
      source: KanbanSource,
      extra?: Record<string, unknown>,
    ): void => {
      requires.logger.write({
        action,
        detail: { source, ...extra },
      });
    };

    // ---------------------------------------------------------------
    // performMove encapsulates the full event/host-call sequence
    // for moving a card so both `moveCard()` and a future hook
    // can reuse it.
    // ---------------------------------------------------------------
    const performMove = async (
      args: {
        cardId: string;
        fromColumnId?: string;
        targetColumnId: string;
        position?: number;
      },
      source: KanbanSource,
    ): Promise<void> => {
      const b = requireBoard();

      const fromColumnId =
        args.fromColumnId ?? locateColumnId(args.cardId) ?? "";

      // MODULE to HOST (events): tell the host the drag has begun
      // BEFORE we make the host-side mutation.
      emit("card:dragged", {
        cardId: args.cardId,
        fromColumnId,
      });

      // MODULE to HOST (requires): persist on the host's side.
      await requires.card.move({
        cardId: args.cardId,
        targetColumnId: args.targetColumnId,
        position: args.position,
      });

      // Now sync our local state and emit the post-drop events.
      const targetCol = b.columns.find((c) => c.id === args.targetColumnId);
      if (!targetCol) {
        throw new Error(`Column not found: ${args.targetColumnId}`);
      }

      let card: Card | undefined;
      for (const col of b.columns) {
        const idx = col.cards.findIndex((c) => c.id === args.cardId);
        if (idx !== -1) {
          [card] = col.cards.splice(idx, 1);
          break;
        }
      }
      if (!card) throw new Error(`Card not found: ${args.cardId}`);

      card.columnId = targetCol.id;
      const pos = args.position ?? targetCol.cards.length;
      targetCol.cards.splice(pos, 0, card);

      log("kanban:moveCard", source, {
        cardId: args.cardId,
        fromColumnId,
        toColumnId: args.targetColumnId,
        position: pos,
      });

      emit("card:dropped", {
        cardId: args.cardId,
        toColumnId: args.targetColumnId,
        position: pos,
      });
      emit("board:changed", { action: "move", cardId: args.cardId });
    };

    return {
      // HOST to MODULE: capabilities.
      capabilities: {
        loadBoard: async ({ boardId }) => {
          board = await requires.board.load({ boardId });
          log("kanban:loadBoard", "loadBoard", {
            boardId,
            columns: board.columns.length,
          });
          return cloneBoard(board);
        },

        getBoard: () => cloneBoard(requireBoard()),

        getCard: ({ cardId }) => {
          const c = findCard(cardId);
          if (!c) throw new Error(`Card not found: ${cardId}`);
          return { ...c };
        },

        createCard: async ({ columnId, title, description, assignee }) => {
          const b = requireBoard();
          const card = await requires.card.create({
            boardId: b.id,
            columnId,
            title,
            description,
            assignee,
          });
          const col = b.columns.find((c) => c.id === columnId);
          if (col) col.cards.push({ ...card });
          log("kanban:createCard", "createCard", {
            cardId: card.id,
            columnId,
            title,
          });
          emit("board:changed", { action: "create", cardId: card.id });
          return { ...card };
        },

        moveCard: (p) => performMove(p, "moveCard"),

        deleteCard: async ({ cardId }) => {
          const b = requireBoard();
          await requires.card.delete({ cardId });
          for (const col of b.columns) {
            const idx = col.cards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              col.cards.splice(idx, 1);
              break;
            }
          }
          log("kanban:deleteCard", "deleteCard", { cardId });
          emit("board:changed", { action: "delete", cardId });
        },

        consumeWatch: async ({ boardId }) => {
          if (!requires.board.watch) {
            throw new Error("board.watch is not bound");
          }
          const chunks: BoardWatchChunk[] = [];
          for await (const chunk of requires.board.watch({ boardId })) {
            chunks.push(chunk);
          }
          log("kanban:consumeWatch", "consumeWatch", {
            boardId,
            chunks: chunks.length,
          });
          return chunks;
        },
      },

      // HOST to MODULE: listener handlers.
      listeners: {
        "board:externalUpdate": ({ board: next }) => {
          board = cloneBoard(next);
          log("kanban:externalUpdate", "board:externalUpdate", {
            boardId: board.id,
          });
          emit("board:changed", { action: "external", cardId: "" });
        },
      },

      // ---------------------------------------------------------------
      // Lifecycle.
      //
      // Nothing to set up beyond logging the config. We don't
      // pre-load a board — the host calls `loadBoard` when ready.
      // ---------------------------------------------------------------
      onMount: () => {
        requires.logger.write({
          action: "kanban:mount",
          detail: {
            columns: config.columns,
            swimlanes: config.swimlanes,
            assignees: config.assignees,
          },
        });
        return () => {
          requires.logger.write({ action: "kanban:unmount" });
        };
      },
    };
  },
);
