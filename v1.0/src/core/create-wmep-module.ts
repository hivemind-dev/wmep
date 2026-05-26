/**
 * wMEP — Web Module Export Protocol
 * createWmepModule helper
 *
 * createWmepModule turns a domain-only setup function into a full
 * WmepFactory<M>.
 *
 * All event/listener/lifecycle plumbing lives HERE, exactly once:
 *
 *   - the per-event `Set` of subscribers
 *   - the on() add/remove with cleanup function
 *   - the emit() dispatch loop over subscribers
 *   - the notify() routing into the declared listener map
 *   - the FIFO pending-listener buffer used while not yet mounted
 *   - the React-shaped onMount/cleanup runner
 *   - the idempotent unmount() that drains and tears down
 *
 * Module authors never re-implement any of this. Every module
 * gets identical, correct, type-safe behavior automatically.
 */

import type {
  WmepCleanup,
  WmepFactory,
  WmepModule,
  WmepReservedEvents,
  WmepSetup,
} from "./types.js";

export function createWmepModule<M extends WmepModule>(
  setup: WmepSetup<M>,
): WmepFactory<M> {
  // Return the host-facing factory. The host will call this
  // once with `requires` and `config` to construct the instance.
  return (requires, config) => {
    // -----------------------------------------------------------------
    // Internal event registry.
    //
    // For every outbound event name, we keep a Set of subscriber
    // callbacks. We use a Map keyed by event name so multiple
    // events stay isolated. Sets give O(1) add/remove and natural
    // de-duplication.
    //
    // The key type includes both author-declared events and the
    // reserved lifecycle events so we can dispatch both through
    // the same registry.
    // -----------------------------------------------------------------
    type EventKey = keyof (M["events"] & WmepReservedEvents);
    const subs = new Map<EventKey, Set<(d: unknown) => void>>();

    // -----------------------------------------------------------------
    // Per-instance lifecycle state.
    //
    // These locals live inside the closure produced by THIS factory
    // call, so every Counter(requires, config) invocation gets its
    // own independent flags and buffer. Multiple module instances
    // never share these.
    // -----------------------------------------------------------------
    let mounted = false;
    let unmounted = false;
    let cleanup: WmepCleanup | undefined;
    const pending: Array<{
      name: keyof M["listeners"];
      data: unknown;
    }> = [];

    // -----------------------------------------------------------------
    // Internal dispatch (shared by author code and reserved events).
    // -----------------------------------------------------------------
    const dispatch = <N extends EventKey>(name: N, data: unknown): void => {
      subs.get(name)?.forEach((cb) => cb(data));
    };

    // -----------------------------------------------------------------
    // emit (MODULE to HOST)
    //
    // The typed entry point passed into the author's setup. Only
    // author-declared event keys are valid here; reserved keys are
    // emitted internally below via `dispatch`.
    // -----------------------------------------------------------------
    const emit = <N extends keyof M["events"]>(
      name: N,
      data: M["events"][N],
    ): void => dispatch(name as EventKey, data);

    // -----------------------------------------------------------------
    // Run the author's setup ONCE, supplying the typed context.
    // We capture `capabilities`, `listeners`, and the optional
    // `onMount` lifecycle effect in this closure.
    // -----------------------------------------------------------------
    const { capabilities, listeners, onMount } = setup({
      requires,
      config,
      emit,
    });

    // -----------------------------------------------------------------
    // Mount phase.
    //
    // Scheduled on a microtask so the host can subscribe to
    // 'wmep:mounted' synchronously after construction without
    // missing the event. Pending notify() calls are drained in
    // FIFO order before 'wmep:mounted' fires.
    // -----------------------------------------------------------------
    const mountP = Promise.resolve().then(async () => {
      if (onMount) {
        const result = await onMount();
        if (typeof result === "function") cleanup = result;
      }
      mounted = true;

      const queue = pending.splice(0);
      for (const { name, data } of queue) {
        (listeners?.[name] as ((d: unknown) => void) | undefined)?.(data);
      }

      dispatch("wmep:mounted" as EventKey, undefined);
    });

    return {
      // HOST to MODULE: the host calls these.
      capabilities,

      // -----------------------------------------------------------------
      // on (MODULE to HOST subscription)
      //
      // One Map handles every event name. Author-declared events
      // (e.g. 'counter:changed') and reserved lifecycle events
      // ('wmep:mounted', 'wmep:unmounted') share the same registry,
      // the same lazy-create-Set logic, and the same unsubscribe
      // closure — there is no separate channel for lifecycle.
      // -----------------------------------------------------------------
      on: (name, cb) => {
        const key = name as EventKey;
        if (!subs.has(key)) subs.set(key, new Set());
        const bag = subs.get(key)!;
        bag.add(cb as (d: unknown) => void);
        return () => bag.delete(cb as (d: unknown) => void);
      },

      // -----------------------------------------------------------------
      // notify (HOST to MODULE listener dispatch)
      //
      // - Before mount completes: buffer FIFO and replay later.
      // - After unmount: silent no-op.
      // - Otherwise: route to the declared handler.
      //
      // If no handler was declared for a given name, the call is
      // a silent no-op (same as the original behaviour).
      // -----------------------------------------------------------------
      notify: (name, data) => {
        if (unmounted) return;
        if (!mounted) {
          pending.push({ name, data });
          return;
        }
        const handler = listeners?.[name];
        if (handler) (handler as (d: unknown) => void)(data);
      },

      // -----------------------------------------------------------------
      // unmount (HOST to MODULE teardown)
      //
      // Idempotent. Awaits any in-flight onMount so cleanup never
      // runs before the corresponding setup. Then runs the cleanup
      // function (if onMount returned one), emits 'wmep:unmounted',
      // and clears the subscriber registry and pending buffer.
      // -----------------------------------------------------------------
      unmount: async (reason) => {
        if (unmounted) return;
        unmounted = true;
        await mountP.catch(() => {});
        if (cleanup) await cleanup();
        dispatch("wmep:unmounted" as EventKey, { reason });
        subs.clear();
        pending.length = 0;
      },
    };
  };
}
