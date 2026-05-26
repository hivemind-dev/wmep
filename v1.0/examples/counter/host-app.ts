/**
 * Counter example — Host-side integration
 *
 * Demonstrates every direction of the wMEP protocol, including
 * the reserved lifecycle events:
 *
 *   HOST to MODULE   construction        Counter(requires, config)
 *   HOST to MODULE   capabilities        counter.capabilities.bump(...)
 *   MODULE to HOST   events              counter.on('counter:changed', cb)
 *   MODULE to HOST   lifecycle           counter.on('wmep:mounted', cb)
 *                                        counter.on('wmep:unmounted', cb)
 *   HOST to MODULE   listeners           counter.notify('counter:reset-request')
 *   HOST to MODULE   teardown            await counter.unmount('reason')
 *   MODULE to HOST   requires            requires.logger.write(...) inside
 *
 * IMPORTANT: the host imports the module from `counter.wmep.ts`
 * and from nowhere else. One symbol `Counter` carries both the
 * type (the full contract) and the factory (the constructor).
 *
 * Run:
 *   npx tsx examples/counter/host-app.ts
 */

import { Counter } from "./counter.wmep.js";

async function run(): Promise<void> {
  console.log("=== wMEP Counter Example ===\n");

  // ---------------------------------------------------------------
  // `Counter` used as a TYPE — the full contract for static checks.
  // ---------------------------------------------------------------
  type CounterCaps = Counter["capabilities"];
  const _typeCheck: keyof CounterCaps extends "state" | "bump" | "reset"
    ? true
    : never = true;
  void _typeCheck;

  // ---------------------------------------------------------------
  // HOST to MODULE: construction.
  //
  // Host supplies:
  //   - requires (Counter['requires']): MODULE to HOST endpoints the
  //     counter will call back into. Here, a logger whose `write`
  //     simply prints to the console.
  //   - config (Counter['config']): HOST to MODULE values handed
  //     in once at build time.
  // ---------------------------------------------------------------
  const counter = Counter(
    {
      logger: {
        write: (entry) =>
          console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
      },
    },
    { initial: 0, step: 1 },
  );

  // ---------------------------------------------------------------
  // MODULE to HOST: subscribe to lifecycle events.
  //
  // The reserved events 'wmep:mounted' / 'wmep:unmounted' are
  // available on every wMEP instance without being declared in
  // the Counter contract. They flow through the same on() path
  // as author-declared events.
  // ---------------------------------------------------------------
  counter.on("wmep:mounted", () => {
    console.log("[Host] wmep:mounted -> module is ready");
  });

  counter.on("wmep:unmounted", ({ reason }) => {
    console.log(`[Host] wmep:unmounted -> reason=${reason ?? "(none)"}`);
  });

  // ---------------------------------------------------------------
  // MODULE to HOST: subscribe to an author-declared event.
  //
  // `on` is supplied by wMEP's createWmepModule. The name and the
  // payload type are checked against Counter['events'].
  // ---------------------------------------------------------------
  const unsubscribe = counter.on("counter:changed", (e) => {
    console.log(
      `[Host] counter:changed -> value=${e.value} (source=${e.source})`,
    );
  });

  // ---------------------------------------------------------------
  // HOST to MODULE: notify is safe even before mount finishes —
  // wMEP buffers it FIFO and replays it after onMount resolves.
  // ---------------------------------------------------------------
  console.log(
    "-- notify counter:reset-request (pre-mount; will buffer, be displayed after onMount resolves) --",
  );
  counter.notify("counter:reset-request", undefined);

  // ---------------------------------------------------------------
  // HOST to MODULE: call capabilities.
  //
  // Capability calls are NOT gated by mount. They run synchronously
  // through the typed surface declared in Counter['capabilities'].
  // ---------------------------------------------------------------
  console.log("-- bump by 5 --");
  counter.capabilities.bump({ amount: 5 });

  console.log("-- bump by default step --");
  counter.capabilities.bump();

  console.log("-- state --");
  console.log("[Host] state =", counter.capabilities.state());

  // ---------------------------------------------------------------
  // Let the interval started inside onMount tick at least once
  // before we tear the module down.
  // ---------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 1100));

  // ---------------------------------------------------------------
  // HOST to MODULE: teardown.
  //
  // unmount() runs the cleanup function returned by onMount
  // (clearing the interval) and emits 'wmep:unmounted'.
  // ---------------------------------------------------------------
  console.log("-- unmount --");
  await counter.unmount("demo-finished");
  unsubscribe();

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
