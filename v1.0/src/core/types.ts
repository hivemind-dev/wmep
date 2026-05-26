/**
 * wMEP — Web Module Export Protocol
 * Core type definitions
 *
 * wMEP is the file/module-level micro-protocol of wMCP. A module
 * describes its public surface as a single TypeScript interface
 * (the contract), and the runtime in this package supplies the
 * small amount of plumbing that delivers outbound events, routes
 * inbound listener notifications, and runs lifecycle effects.
 *
 * Five communication slots exist in every wMEP module. Each
 * slot has a fixed direction so the contract is unambiguous:
 *
 *   capabilities   HOST to MODULE   host calls them on the module
 *   events         MODULE to HOST   module emits, host listens
 *   listeners      HOST to MODULE   host pushes, module reacts
 *   requires       MODULE to HOST   module calls them on the host
 *   config         HOST to MODULE   host hands them in at build time
 *
 * Nothing else crosses the module boundary. Anything imported
 * from outside a module must come from that module's *.wmep.ts
 * boundary file.
 */

// ============================================
// Reserved Events (auto-emitted by createWmepModule)
// ============================================

/**
 * MODULE to HOST: lifecycle events every wMEP module exposes,
 * regardless of what the author declares in `events`.
 *
 *   wmep:mounted    fires once after the onMount effect resolves
 *   wmep:unmounted  fires once after the cleanup function resolves
 */
export type WmepReservedEvents = {
  "wmep:mounted": void;
  "wmep:unmounted": { reason?: string };
};

// ============================================
// Lifecycle Effect (React useEffect-shaped)
// ============================================

/** Cleanup function returned by the mount effect. Runs on unmount. */
export type WmepCleanup = () => void | Promise<void>;

/**
 * Mount effect. Runs once after construction. May optionally
 * return a cleanup function (sync or async) — exactly like the
 * function passed to React's `useEffect(..., [])`.
 */
export type WmepEffect = () => void | WmepCleanup | Promise<void | WmepCleanup>;

// ============================================
// Module Contract
// ============================================

/**
 * WmepModule is the SHAPE every module's contract must extend.
 *
 * Each generic slot is one direction of traffic across the
 * module/host boundary. They are intentionally separated so
 * static analysis and AI tooling can reason about each slot
 * in isolation.
 *
 *   C  capabilities   (HOST to MODULE)
 *   E  events         (MODULE to HOST)
 *   L  listeners      (HOST to MODULE)
 *   R  requires       (MODULE to HOST)
 *   K  config         (HOST to MODULE)
 *
 * Modules with no traffic in a given slot leave it at the
 * default `{}` so the contract stays compact.
 */
export interface WmepModule<C = {}, E = {}, L = {}, R = {}, K = {}> {
  /** Stable identity of the module. Used for diagnostics. */
  module: { name: string; version: string };

  /** HOST to MODULE: callable methods the host invokes on the module. */
  capabilities: C;

  /** MODULE to HOST: outbound notifications the module emits. */
  events: E;

  /** HOST to MODULE: inbound notifications the module subscribes to. */
  listeners: L;

  /** MODULE to HOST: host-implemented methods the module invokes. */
  requires: R;

  /** HOST to MODULE: typed configuration handed in at construction. */
  config: K;
}

// ============================================
// Constructed Instance
// ============================================

/**
 * WmepInstance is what `createWmepModule(...)` returns — i.e. the
 * shape every constructed module exposes to the host.
 *
 * The host receives four things and four things only:
 *
 *   - capabilities   (HOST to MODULE: invoke methods)
 *   - on(...)        (MODULE to HOST: subscribe to events,
 *                     including reserved 'wmep:mounted' /
 *                     'wmep:unmounted' lifecycle events)
 *   - notify(...)    (HOST to MODULE: send listener events,
 *                     buffered FIFO until mount completes)
 *   - unmount(...)   (HOST to MODULE: trigger cleanup, idempotent)
 *
 * Everything else (private state, internal subscribers, the
 * pending-listener buffer, the cleanup closure) stays sealed
 * inside the factory closure.
 */
export interface WmepInstance<M extends WmepModule> {
  /** HOST to MODULE: methods the host calls on the module. */
  capabilities: M["capabilities"];

  /**
   * MODULE to HOST: subscribe to an outbound event by name.
   * Accepts both author-declared `M['events']` keys and the
   * reserved lifecycle event keys in `WmepReservedEvents`.
   * Returns an unsubscribe function so the host can clean up.
   */
  on<N extends keyof (M["events"] & WmepReservedEvents)>(
    name: N,
    cb: (data: (M["events"] & WmepReservedEvents)[N]) => void,
  ): () => void;

  /**
   * HOST to MODULE: push a listener event into the module.
   * If called before the mount effect resolves, the call is
   * buffered FIFO and replayed once mount completes.
   * After unmount(), notify() is a silent no-op.
   */
  notify<N extends keyof M["listeners"]>(
    name: N,
    data: M["listeners"][N],
  ): void;

  /**
   * Trigger module teardown. Awaits any in-flight mount effect,
   * runs the cleanup function returned by onMount (if any), and
   * emits the reserved `wmep:unmounted` event. Idempotent.
   */
  unmount(reason?: string): Promise<void>;
}

// ============================================
// Factory & Setup
// ============================================

/**
 * WmepFactory is the conventional public type for a module's
 * `createXxx()` function. The boundary `.wmep.ts` file exports
 * a value of this type so the host can construct an instance.
 */
export type WmepFactory<M extends WmepModule> = (
  requires: M["requires"], // HOST to MODULE
  config: M["config"], // HOST to MODULE
) => WmepInstance<M>;

/**
 * WmepSetup is the function authors actually write inside the
 * module's INTERNAL implementation file.
 *
 * The author receives a small typed context:
 *
 *   - requires  resolved host endpoints (MODULE to HOST)
 *   - config    resolved config values  (HOST to MODULE)
 *   - emit      a typed emitter         (MODULE to HOST dispatch)
 *
 * and returns:
 *
 *   - capabilities  the methods the host will call
 *   - listeners     handlers for HOST to MODULE notifications
 *   - onMount       OPTIONAL React useEffect-shaped lifecycle:
 *                   the function runs on mount, and any cleanup
 *                   it returns runs on unmount()
 *
 * Note: the author never manages a subscriber Set, never writes
 * an on()/notify() function, never sees raw event plumbing, and
 * never touches the mount-pending buffer. That is wMEP's job and
 * lives in `createWmepModule`.
 */
export type WmepSetup<M extends WmepModule> = (ctx: {
  /** MODULE to HOST: resolved host-implemented endpoints. */
  requires: M["requires"];

  /** HOST to MODULE: resolved configuration values. */
  config: M["config"];

  /**
   * MODULE to HOST: type-safe emit for outbound events.
   *
   * The `name` argument is restricted to keys of `M['events']`,
   * and `data` is the matching payload type for that key, so
   * a typo or wrong payload is a compile error.
   */
  emit: <N extends keyof M["events"]>(name: N, data: M["events"][N]) => void;
}) => {
  /** HOST to MODULE: the implementations of every capability. */
  capabilities: M["capabilities"];

  /**
   * HOST to MODULE: a declarative map of listener handlers.
   * Each handler receives the typed payload for its event name.
   * `createWmepModule` routes `notify(name, data)` calls to these.
   */
  listeners?: {
    [N in keyof M["listeners"]]?: (data: M["listeners"][N]) => void;
  };

  /**
   * Lifecycle effect, useEffect-shaped:
   *
   *   onMount: () => {
   *     // setup work
   *     return () => {
   *       // cleanup runs on unmount()
   *     };
   *   }
   *
   * Sync or async. If the returned cleanup is omitted, unmount()
   * still works and just emits 'wmep:unmounted'.
   */
  onMount?: WmepEffect;
};
