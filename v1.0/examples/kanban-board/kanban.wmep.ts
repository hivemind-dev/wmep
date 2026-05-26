/**
 * @aurorah/wmep-kanban-board — boundary file
 *
 * THE BOUNDARY FILE for the kanban-board module.
 *
 * One symbol — `Kanban` — exported. Declaration merging makes
 * it both the contract (TYPE space) and the factory (VALUE
 * space).
 */

import type { WmepFactory, WmepModule } from "../../src/core/index.js";

import { createKanban } from "./kanban.js";

// -----------------------------------------------------------------
// Domain types (shared at the boundary).
// -----------------------------------------------------------------
export interface Card {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  labels?: string[];
  columnId: string;
}

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];
}

export interface BoardWatchChunk {
  type: "snapshot" | "delta";
  boardId: string;
  data: unknown;
  userId: string;
  timestamp: number;
}

export type BoardChangeAction = "create" | "move" | "delete" | "external";

// -----------------------------------------------------------------
// The contract.
// -----------------------------------------------------------------
export interface Kanban extends WmepModule<
  // HOST to MODULE: capabilities
  {
    /** Load a board by id. Stores it as the current board. */
    loadBoard(p: { boardId: string }): Promise<Board>;

    /** Return a deep clone of the current board state. */
    getBoard(): Board;

    /** Look up one card by id. */
    getCard(p: { cardId: string }): Card;

    /** Create a card. Emits 'board:changed'. */
    createCard(p: {
      columnId: string;
      title: string;
      description?: string;
      assignee?: string;
    }): Promise<Card>;

    /**
     * Move a card. Emits 'card:dragged' before the host call
     * and 'card:dropped' + 'board:changed' after.
     */
    moveCard(p: {
      cardId: string;
      fromColumnId?: string;
      targetColumnId: string;
      position?: number;
    }): Promise<void>;

    /** Delete a card. Emits 'board:changed'. */
    deleteCard(p: { cardId: string }): Promise<void>;

    /** Drain board:watch from the host (one snapshot or many). */
    consumeWatch(p: { boardId: string }): Promise<BoardWatchChunk[]>;
  },
  // MODULE to HOST: events
  {
    "board:changed": { action: BoardChangeAction; cardId: string };
    "card:dragged": { cardId: string; fromColumnId: string };
    "card:dropped": {
      cardId: string;
      toColumnId: string;
      position: number;
    };
  },
  // HOST to MODULE: listeners
  {
    /** Host pushes an externally-mutated board snapshot. */
    "board:externalUpdate": { board: Board };
  },
  // MODULE to HOST: requires
  {
    /** Host-supplied audit logger. Every state-changing action
     *  funnels through this endpoint, mirroring the counter
     *  example's logging convention. */
    logger: { write(entry: { action: string; detail?: unknown }): void };

    board: {
      load(p: { boardId: string }): Promise<Board>;
      /** Optional — AsyncIterable feed of board updates. */
      watch?(p: { boardId: string }): AsyncIterable<BoardWatchChunk>;
    };
    card: {
      create(p: {
        boardId: string;
        columnId: string;
        title: string;
        description?: string;
        assignee?: string;
      }): Promise<Card>;
      update(p: {
        cardId: string;
        title?: string;
        description?: string;
        assignee?: string;
      }): Promise<Card>;
      move(p: {
        cardId: string;
        targetColumnId: string;
        position?: number;
      }): Promise<void>;
      delete(p: { cardId: string }): Promise<void>;
    };
  },
  // HOST to MODULE: config
  {
    columns?: string[];
    swimlanes?: boolean;
    assignees?: string[];
  }
> {
  /** Identity of this module — overrides the base default. */
  module: { name: "@aurorah/wmep-kanban-board"; version: "1.0.0" };
}

export const Kanban: WmepFactory<Kanban> = createKanban;
