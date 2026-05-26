/**
 * @aurorah/wmep-counter — internal implementation
 *
 * INTERNAL implementation of the counter module.
 *
 * This file is private to the `counter/` directory:
 *   - it may freely export/import internal helpers
 *   - it is NEVER imported by any file outside `counter/`
 *   - it must satisfy `WmepFactory<Counter>` from the contract
 *
 * All event plumbing (subscriber Sets, emit dispatch, on/notify
 * wiring) is supplied by `createWmepModule` in @aurorah/wmep. The
 * code below is pure domain logic.
 */

import { createWmepModule } from "../../src/core/index.js";
import type { Counter } from "./counter.wmep.js";

// `createWmepModule<Counter>(setup)` returns a fully-formed factory
// of type `WmepFactory<Counter>`. The setup function receives
// resolved `requires`, resolved `config`, and a typed `emit`.
export const createCounter = createWmepModule<Counter>(
  ({ requires, config, emit }) => {
    // ---------------------------------------------------------------
    // Private module state.
    //
    // This variable is captured by the closure returned below. No
    // outside code can reach it; only the methods in `capabilities`
    // and the handlers in `listeners` can read or modify it.
    // ---------------------------------------------------------------
    let value = config.initial ?? 0;
    const step = config.step ?? 1;

    // ---------------------------------------------------------------
    // Helper that performs every state-changing operation.
    //
    // Single helper means single place for:
    //   - updating the value
    //   - reporting to the host's logger (MODULE to HOST: requires)
    //   - emitting the outbound event   (MODULE to HOST: events)
    //
    // Every capability that mutates state funnels through this.
    // ---------------------------------------------------------------
    const change = (
      next: number,
      source: "bump" | "reset" | "reset-on-request" | "interval-tick",
    ): void => {
      value = next;

      // MODULE to HOST (requires): call a capability the host gave us.
      requires.logger.write({
        action: "counter:change",
        detail: { value, source },
      });

      // MODULE to HOST (events): broadcast to anyone who subscribed
      // via counter.on('counter:changed', cb). The Set of callbacks
      // and the dispatch loop are managed by createWmepModule in wMEP;
      // we just call `emit` with a typed payload.
      emit("counter:changed", { value, source });
    };

    return {
      // HOST to MODULE: capabilities
      // Implementations of the methods declared in the Counter
      // contract. Each one matches the signature in
      // `Counter['capabilities']` exactly (or it would fail to
      // type-check at the boundary file).
      capabilities: {
        // HOST to MODULE: read current value.
        state: () => ({ value }),

        // HOST to MODULE: increment by p.amount or `step` from config.
        bump: (p) => {
          change(value + (p?.amount ?? step), "bump");
          return value;
        },

        // HOST to MODULE: reset to zero.
        reset: () => change(0, "reset"),
      },

      // HOST to MODULE: listener handlers
      // Declarative map of inbound notification handlers.
      // The host calls counter.notify('counter:reset-request')
      // and wMEP routes the call to the handler below.
      listeners: {
        "counter:reset-request": () => change(0, "reset-on-request"),
      },

      // ---------------------------------------------------------------
      // Lifecycle (React useEffect shape).
      //
      // The setup function runs once on mount. The function we
      // return runs on unmount. `tick` is captured by the cleanup
      // closure — we never need to hoist it to an outer `let`.
      //
      // While onMount is in flight, host -> module notify() calls
      // are buffered FIFO by createWmepModule and replayed after
      // this function resolves; the host then receives the
      // reserved 'wmep:mounted' event.
      // ---------------------------------------------------------------
      onMount: () => {
        requires.logger.write({ action: "counter:mount" });

        const tick = setInterval(() => {
          change(value + step, "interval-tick");
        }, 1000);

        return () => {
          clearInterval(tick);
          requires.logger.write({ action: "counter:unmount" });
        };
      },
    };
  },
);
