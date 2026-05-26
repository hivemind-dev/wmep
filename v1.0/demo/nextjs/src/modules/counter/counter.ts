/**
 * @demo/counter — internal implementation
 *
 * Owns the counter's value state. Every state change funnels
 * through `change(...)` so the logger entry and the emitted
 * event stay in lockstep.
 */

import { createWmepModule } from "@aurorah/wmep";
import type { Counter } from "./counter.wmep";

export const createCounter = createWmepModule<Counter>(
  ({ requires, config, emit }) => {
    let value = config.initial ?? 0;
    const step = config.step ?? 1;

    const change = (
      next: number,
      source: "bump" | "decrement" | "reset" | "reset-on-request",
    ): void => {
      value = next;
      requires.logger.write({
        action: "counter:change",
        detail: { value, source },
      });
      emit("counter:changed", { value, source });
    };

    return {
      capabilities: {
        state: () => ({ value }),
        bump: (p) => {
          change(value + (p?.amount ?? step), "bump");
          return value;
        },
        decrement: (p) => {
          change(value - (p?.amount ?? step), "decrement");
          return value;
        },
        reset: () => change(0, "reset"),
      },

      listeners: {
        "counter:reset-request": () => change(0, "reset-on-request"),
      },

      onMount: () => {
        requires.logger.write({
          action: "counter:mount",
          detail: { value, step },
        });
        return () => {
          requires.logger.write({ action: "counter:unmount" });
        };
      },
    };
  },
);
