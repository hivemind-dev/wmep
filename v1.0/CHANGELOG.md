# Changelog

All notable changes to `@aurorah/wmep` are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-22

Initial release of the wMEP — Web Module Export Protocol, the file/module-level micro-protocol that pairs with [`@aurorah/wmcp`](https://github.com/z-order/wmcp).

### Added

- `createWmepModule()` — single helper that turns a domain-only `setup` function into a full `WmepFactory<M>`. All event/listener/lifecycle plumbing (per-event subscriber `Set`, `on()` add/remove with cleanup, `emit()` dispatch, `notify()` routing, FIFO pending-listener buffer, React-shaped `onMount`/cleanup runner, idempotent `unmount()`) lives in this helper exactly once — module authors never re-implement any of it.
- Public type exports from `@aurorah/wmep`: `WmepModule`, `WmepFactory`, `WmepInstance`, `WmepSetup`, `WmepEffect`, `WmepCleanup`, `WmepReservedEvents`.
- Five-slot boundary contract per module: `capabilities` (HOST → MODULE), `events` (MODULE → HOST), `listeners` (HOST → MODULE), `requires` (MODULE → HOST), `config` (HOST → MODULE).
- Reserved lifecycle events `wmep:mounted` / `wmep:unmounted` — emitted automatically by `createWmepModule`. Hosts subscribe via `instance.on("wmep:mounted", cb)` / `instance.on("wmep:unmounted", cb)`.
- Mount-phase FIFO buffering of `notify()` calls — `host.notify(name, data)` issued before the module finishes mounting is buffered in arrival order and replayed before `wmep:mounted` fires.
- Idempotent `unmount(reason)` — awaits any in-flight `onMount`, runs the author-returned cleanup function, emits `wmep:unmounted`, and clears the subscriber registry + pending buffer.
- `*.wmep.ts` boundary-file convention — each module exports exactly one `interface` (the contract) and one same-named `const` (the factory). Outside code MUST import only from `*.wmep.ts`; internal `*.ts` files in the module directory remain private.
- Per-module canonical-rule documentation convention — every module directory contains a `{module-name}.rule.md` file declaring the module's description, canonical rules, and provisions.
- Machine-readable structure declaration under the `wmep` field of `package.json` (`wmep.projectStructure`, `wmep.moduleStructure`) so AI agents and tooling can read the convention directly from the package.
- Six runnable example modules under `examples/` (`counter`, `analytics-dashboard`, `file-manager`, `kanban-board`, `media-player`, `rich-text-editor`) plus `examples/orchestration-host-app.ts` — a single host that mounts all six modules and demonstrates cross-module flows (editor save → dashboard invalidation, file delete → kanban card delete, player ticks → dashboard audit, …).
- Four browser composition demos under `demo/` reusing the same module set across frameworks: `demo/esm` (vanilla TS, ES modules), `demo/lit3` (Lit 3 / Web Components), `demo/nextjs` (Next.js 16 + React 19), `demo/svelte` (Svelte 5). Swapping framework only changes each module's `*.view.{ext}` file; the `*.wmep.ts` boundary, the `*.rule.md` contract, and the internal state machine stay identical.
- `deploy.sh` — build / login / publish / preview / install workflow for the `@aurorah/wmep` npm package.

### Notes

- **Relation to wMCP.** wMEP is the per-file public-surface contract a module uses to police its own exports at compile time; wMCP is the host ↔ module connection layer. Use wMEP standalone for in-process TypeScript modules where the boundary is a file, and combine it with wMCP when the same modules need to be mounted as remote / cross-process plugins.
- **Status.** Prototype / Proof of Concept.
