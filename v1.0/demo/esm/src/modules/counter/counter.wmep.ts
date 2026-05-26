/**
 * @demo/counter — boundary file
 *
 * Boundary for the Counter module. Outside code may import only
 * from THIS file. Exports the contract, the factory, and the
 * module-owned vanilla-DOM view (per the "modules must have their
 * own UI" rule).
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createCounter } from "./counter";
import { createCounterView as InternalView } from "./counter.view";

export interface Counter
  extends WmepModule<
    // HOST to MODULE: capabilities
    {
      state(): { value: number };
      bump(p?: { amount?: number }): number;
      decrement(p?: { amount?: number }): number;
      reset(): void;
    },
    // MODULE to HOST: events
    {
      "counter:changed": {
        value: number;
        source: "bump" | "decrement" | "reset" | "reset-on-request";
      };
    },
    // HOST to MODULE: listeners
    {
      "counter:reset-request": void;
    },
    // MODULE to HOST: requires
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    // HOST to MODULE: config — defaults come from @demo/configuration
    {
      initial?: number;
      step?: number;
    }
  > {
  module: { name: "@demo/counter"; version: "1.0.0" };
}

export const Counter: WmepFactory<Counter> = createCounter;

export const createCounterView = InternalView;
