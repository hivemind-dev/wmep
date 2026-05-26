/**
 * @demo/clock — boundary file
 */

import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import { createClock } from "./clock";
import { ClockView as InternalView } from "./clock.view";

export type ClockFormat = "12h" | "24h";

export interface Clock
  extends WmepModule<
    // HOST to MODULE: capabilities
    {
      getNow(): { ts: number; iso: string };
      getFormat(): { format: ClockFormat };
      setFormat(p: { format: ClockFormat }): { format: ClockFormat };
      pause(): void;
      resume(): void;
      isPaused(): boolean;
    },
    // MODULE to HOST: events
    {
      "clock:tick": { ts: number; iso: string };
      "clock:formatChanged": { format: ClockFormat };
      "clock:paused": void;
      "clock:resumed": void;
    },
    // HOST to MODULE: listeners
    Record<string, never>,
    // MODULE to HOST: requires
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    // HOST to MODULE: config
    {
      format?: ClockFormat;
      tickIntervalMs?: number;
    }
  > {
  module: { name: "@demo/clock"; version: "1.0.0" };
}

export const Clock: WmepFactory<Clock> = createClock;

export const ClockView = InternalView;
