/**
 * @demo/counter — boundary file
 *
 * Boundary for the Counter module. Outside code may import only
 * from THIS file. Exports the contract, the factory, and the
 * module-owned Lit custom element (per the "modules must have
 * their own UI" rule).
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createCounter } from "./counter";

export interface Counter
  extends WmepModule<
    {
      state(): { value: number };
      bump(p?: { amount?: number }): number;
      decrement(p?: { amount?: number }): number;
      reset(): void;
    },
    {
      "counter:changed": {
        value: number;
        source: "bump" | "decrement" | "reset" | "reset-on-request";
      };
    },
    {
      "counter:reset-request": void;
    },
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    {
      initial?: number;
      step?: number;
    }
  > {
  module: { name: "@demo/counter"; version: "1.0.0" };
}

export const Counter: WmepFactory<Counter> = createCounter;

export { CounterView } from "./counter.view";
