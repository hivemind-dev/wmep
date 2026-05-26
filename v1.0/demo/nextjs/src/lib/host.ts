/**
 * Shared host services
 *
 * Centralised host-side implementations of MODULE-to-HOST `requires`
 * endpoints that several modules use (currently only a logger).
 *
 * Each wMEP module receives a logger via its `requires.logger` slot.
 * The host implementation here pushes log entries into both the
 * browser console AND a small in-memory ring buffer that the UI can
 * subscribe to for live display.
 */

export type LogEntry = {
  ts: number;
  module: string;
  action: string;
  detail?: unknown;
};

type Listener = (entry: LogEntry) => void;

const MAX_ENTRIES = 200;
const buffer: LogEntry[] = [];
const listeners = new Set<Listener>();

function push(entry: LogEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  listeners.forEach((cb) => cb(entry));
}

export function createLogger(moduleTag: string) {
  return {
    write: (entry: { action: string; detail?: unknown }): void => {
      const full: LogEntry = {
        ts: Date.now(),
        module: moduleTag,
        action: entry.action,
        detail: entry.detail,
      };
      if (typeof window !== "undefined") {
        console.log(`[${moduleTag}] ${entry.action}`, entry.detail ?? "");
      }
      push(full);
    },
  };
}

export function getLogBuffer(): readonly LogEntry[] {
  return buffer;
}

export function subscribeLog(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function clearLogBuffer(): void {
  buffer.length = 0;
  listeners.forEach((cb) =>
    cb({ ts: Date.now(), module: "@host", action: "log:cleared" }),
  );
}
