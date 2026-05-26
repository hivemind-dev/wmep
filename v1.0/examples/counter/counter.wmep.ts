/**
 * @aurorah/wmep-counter — boundary file
 *
 * THE BOUNDARY FILE for the counter module.
 *
 * Outside code (any file outside the `counter/` directory) MUST
 * import the module from THIS file. It is the only legal
 * cross-module entry point.
 *
 * This file exports a SINGLE NAME: `Counter`.
 * Thanks to TypeScript declaration merging, the same name
 * carries two facets:
 *
 *   - `interface Counter` (TYPE space)  -> the contract
 *   - `const Counter`     (VALUE space) -> the factory
 *
 * So consumers write `import { Counter } from './counter.wmep'`
 * once and use it both for typing AND for construction.
 */

import type { WmepFactory, WmepModule } from "../../src/core/index.js";

// The implementation lives in an INTERNAL file. It is referenced
// here only to wire it into the boundary export below. External
// code can never reach `./counter` directly.
import { createCounter } from "./counter.js";

// -----------------------------------------------------------------
// The contract.
//
// `Counter` extends WmepModule<C, E, L, R, K>, filling each of the
// five slots with concrete types. The order is fixed by wMEP:
//   1) capabilities (HOST to MODULE)
//   2) events       (MODULE to HOST)
//   3) listeners    (HOST to MODULE)
//   4) requires     (MODULE to HOST)
//   5) config       (HOST to MODULE)
// -----------------------------------------------------------------
export interface Counter extends WmepModule<
  // HOST to MODULE: capabilities
  // The methods the host invokes on the counter.
  {
    /** Returns the current counter value. */
    state(): { value: number };

    /** Increments by `amount` (default 1) and returns the new value. */
    bump(p?: { amount?: number }): number;

    /** Resets the counter to zero. */
    reset(): void;
  },
  // MODULE to HOST: events
  // Outbound notifications the counter emits to the host.
  // Host subscribes via `counter.on('counter:changed', cb)`.
  {
    "counter:changed": {
      value: number;
      source: "bump" | "reset" | "reset-on-request" | "interval-tick";
    };
  },
  // HOST to MODULE: listeners
  // Inbound notifications the host pushes into the counter.
  // Host sends via `counter.notify('counter:reset-request')`.
  {
    "counter:reset-request": void;
  },
  // MODULE to HOST: requires
  // Capabilities the host must supply when constructing the
  // module. The counter calls these on the host directly.
  {
    logger: { write(entry: { action: string; detail?: unknown }): void };
  },
  // HOST to MODULE: config
  // Construction-time configuration. Passed as the second
  // argument to `Counter(requires, config)`.
  {
    initial?: number;
    step?: number;
  }
> {
  /** Identity of this module — overrides the base default. */
  module: { name: "@aurorah/wmep-counter"; version: "1.0.0" };
}

// -----------------------------------------------------------------
// The factory.
//
// `const Counter` lives in TypeScript's value space and is bound
// to the implementation imported from the internal file. Its
// declared type `WmepFactory<Counter>` (where `Counter` here
// refers to the interface above) ensures the implementation
// conforms to the contract — otherwise this assignment fails to
// compile, catching contract drift at the boundary.
// -----------------------------------------------------------------
export const Counter: WmepFactory<Counter> = createCounter;
