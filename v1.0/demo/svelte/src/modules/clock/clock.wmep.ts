/**
 * @demo/clock — boundary file
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createClock } from "./clock";

export type ClockFormat = "12h" | "24h";

export interface Clock
  extends WmepModule<
    {
      getNow(): { ts: number; iso: string };
      getFormat(): { format: ClockFormat };
      setFormat(p: { format: ClockFormat }): { format: ClockFormat };
      pause(): void;
      resume(): void;
      isPaused(): boolean;
    },
    {
      "clock:tick": { ts: number; iso: string };
      "clock:formatChanged": { format: ClockFormat };
      "clock:paused": void;
      "clock:resumed": void;
    },
    Record<string, never>,
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    {
      format?: ClockFormat;
      tickIntervalMs?: number;
    }
  > {
  module: { name: "@demo/clock"; version: "1.0.0" };
}

export const Clock: WmepFactory<Clock> = createClock;

export { default as ClockView } from "./clock.view.svelte";
