/**
 * @demo/clock — internal implementation
 *
 * Drives `clock:tick` events from a setInterval, configurable via
 * `config.tickIntervalMs`. The cleanup function returned by
 * onMount clears the interval on unmount.
 */

import { createWmepModule } from "@aurorah/wmep";
import type { Clock, ClockFormat } from "./clock.wmep";

export const createClock = createWmepModule<Clock>(
  ({ requires, config, emit }) => {
    let format: ClockFormat = config.format ?? "24h";
    const tickIntervalMs = config.tickIntervalMs ?? 1000;
    let paused = false;

    const log = (
      action: string,
      detail?: Record<string, unknown>,
    ): void => {
      requires.logger.write({ action, detail });
    };

    const snapshot = (): { ts: number; iso: string } => {
      const ts = Date.now();
      return { ts, iso: new Date(ts).toISOString() };
    };

    return {
      capabilities: {
        getNow: () => snapshot(),
        getFormat: () => ({ format }),
        setFormat: ({ format: next }) => {
          format = next;
          log("clock:setFormat", { format: next });
          emit("clock:formatChanged", { format: next });
          return { format: next };
        },
        pause: () => {
          if (paused) return;
          paused = true;
          log("clock:pause");
          emit("clock:paused", undefined);
        },
        resume: () => {
          if (!paused) return;
          paused = false;
          log("clock:resume");
          emit("clock:resumed", undefined);
        },
        isPaused: () => paused,
      },

      onMount: () => {
        log("clock:mount", { format, tickIntervalMs });

        const tick = setInterval(() => {
          if (paused) return;
          emit("clock:tick", snapshot());
        }, tickIntervalMs);

        emit("clock:tick", snapshot());

        return () => {
          clearInterval(tick);
          log("clock:unmount");
        };
      },
    };
  },
);
