# wMEP -- Web Module Export Protocol

wMEP is the file/module-level micro-protocol of [wMCP](https://github.com/z-order/wmcp). Each module exports exactly one TypeScript interface from its `*.wmep.ts` boundary file. That single interface fills five typed slots -- `capabilities`, `events`, `listeners`, `requires`, `config` -- and is the **only** symbol allowed to cross the module boundary. Inside a module, normal export/import is free.

Where wMCP is the JSON-manifest-driven protocol between a host application and a pluggable module, wMEP is the per-file contract that the same module uses to police its own public surface at compile time.

**Status:** Prototype / Proof of Concept

> **AI Agents:** wMEP modules are read top-down from a single `*.wmep.ts` file. That file declares the `interface` (the contract) and the same-named `const` (the factory). Outside code MUST import only from `*.wmep.ts`. Internal files (`*.ts` inside the module directory) are private and MUST NOT be referenced from outside the module.

## Quick links

| Document                                | Description                                       |
| --------------------------------------- | ------------------------------------------------- |
| [wMCP](https://github.com/z-order/wmcp) | Host/module connection layer                      |
| [`examples/`](./examples)               | Runnable host-app demos (six modules + host)      |
| [`demo/esm/`](./demo/esm)               | Browser composition demo — vanilla TS (ES module) |
| [`demo/lit3/`](./demo/lit3)             | Browser composition demo — Lit 3 (Web Components) |
| [`demo/nextjs/`](./demo/nextjs)         | Browser composition demo — Next.js 16 + React 19  |
| [`demo/svelte/`](./demo/svelte)         | Browser composition demo — Svelte 5               |

## Project structure

```
wmep-prototype/
├── src/
│   └── core/                # createWmepModule, types, factory helpers
├── examples/                # Runnable example modules and hosts
│   ├── counter/             # Reference implementation
│   ├── analytics-dashboard/
│   ├── file-manager/
│   ├── kanban-board/
│   ├── media-player/
│   ├── rich-text-editor/
│   └── orchestration-host-app.ts  # Single host mounting all six modules
├── demo/                    # Browser composition demos (same modules, four frameworks)
│   ├── esm/                 # Vanilla TypeScript (no UI framework, ES modules)
│   ├── lit3/                # Lit 3 (Web Components)
│   ├── nextjs/              # Next.js 16 + React 19
│   └── svelte/              # Svelte 5
└── package.json
```

## wMEP module convention (demo apps)

Every demo under `demo/*` follows the same wMEP project layout. AI agents and contributors editing any demo MUST keep the convention below; each module's own `*.rule.md` file declares the additional canonical rules for that module.

### Project structure (inside each demo)

```
demo/<framework>/src/
├── lib/        # The project libraries.
├── modules/    # The project modules that use the wMEP spec.
└── styles/     # Global styles for theme and components.
```

### Module convention

- A directory name under `src/modules/` IS the module name.
- Each module directory `src/modules/{module-name}/` contains:

| File                                              | Purpose                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `{module-name}.rule.md`                           | The module description, canonical rules, provisions.                       |
| `{module-name}.ts`                                | The internal implementation of the module that calls `createWmepModule()`. |
| `{module-name}.scss`                              | SCSS for the module.                                                       |
| `{module-name}.view.{ts \| tsx \| svelte \| ...}` | UI/UX for the module (extension follows the demo's framework).             |
| `{module-name}.wmep.ts`                           | wMEP for the module — the boundary file outside code MUST import from.     |
| (other files)                                     | And other files for the module as needed.                                  |

The same convention is published machine-readably under the `wmep` field of [`package.json`](./package.json) (`wmep.projectStructure`, `wmep.moduleStructure`).

### Example: `demo/nextjs/src/modules/layout/`

A complete wMEP module under the Next.js demo, showing the convention in practice. The module name is `layout` (the directory name), and every file follows the `{module-name}.{purpose}.{ext}` pattern.

```
src/modules/layout/
├── layout.rule.md      # Canonical rule (description, rules, provisions)
├── layout.ts           # Internal state machine (private; calls createWmepModule())
├── layout.scss         # Module styles
├── layout.view.tsx     # UI (React; private)
└── layout.wmep.tsx     # wMEP boundary — the only file outside code may import
```

**`layout.rule.md`** — the design contract every contributor MUST keep:

```md
# `layout.ts` — Canonical Rule

> This file is the canonical specification for the `layout` module.
> AI agents and contributors MUST read this file before editing any
> file under `src/modules/layout/**`, and MUST keep the module
> compliant with the **Canonical Rules** below.
>
> **Framework binding**: Next.js 16 + React 19.

## Description

- The Top-level UI/UX layout is laid out here. It has all the top-level
  UI/UX components: title, header, menus, body, side panels, toolbars,
  footer, status bar, and so on.

## Canonical Rules

- **Rule 1**: The layout must all be composed of the assembly of
  components, like Lego.
- **Rule 2**: The side panels must be resizable fully but has minimum
  width of `N`. (e.g., `N = 300px`)
- **Rule 3**: The side panels must be able to be hidden/shown by user
  action (e.g., toggle buttons).

## Provisions

- **Top bar**: left-side Title, center toolbar, right-side buttons
- **Side panel**: left-side panel, right-side panel
- **Page area**: page header, page toolbar, page body
- **Page header**: left-buttons, center switch-mode buttons,
  right-side buttons
```

**`layout.wmep.tsx`** — the boundary contract; the only file external code may import (header doc comment omitted for brevity):

```tsx
import type { WmepFactory, WmepModule } from "@aurorah/wmep";

import type { ModeKey, ModePreset } from "../configuration/configuration.wmep";

import { createLayout } from "./layout";
import { LayoutView as InternalView } from "./layout.view";

export type PanelSide = "left" | "right";

export interface PanelState {
  visible: boolean;
  width: number;
  minWidth: number;
}

export interface LayoutState {
  title: string;
  leftPanel: PanelState;
  rightPanel: PanelState;
  mode: ModeKey;
  modes: ModePreset[];
}

export interface Layout
  extends WmepModule<
    // HOST to MODULE: capabilities (the Lego pieces' control API)
    {
      getState(): LayoutState;

      /** Show/hide a side panel (Rule 3). */
      togglePanel(p: { side: PanelSide }): { visible: boolean };
      setPanelVisible(p: { side: PanelSide; visible: boolean }): void;

      /** Resize a panel — clamped to its minimum width (Rule 2). */
      setPanelWidth(p: { side: PanelSide; width: number }): { width: number };

      /** Set the minimum panel width (Rule 2 — N is configurable). */
      setPanelMinWidth(p: { side: PanelSide; minWidth: number }): {
        minWidth: number;
        width: number;
      };

      /** Switch the active page-body mode. */
      setMode(p: { mode: ModeKey }): { mode: ModeKey };

      /** Replace the title shown in the top bar. */
      setTitle(p: { title: string }): { title: string };
    },
    // MODULE to HOST: events
    {
      "layout:panelToggled": { side: PanelSide; visible: boolean };
      "layout:panelResized": { side: PanelSide; width: number };
      "layout:panelMinChanged": { side: PanelSide; minWidth: number };
      "layout:modeChanged": { mode: ModeKey };
      "layout:titleChanged": { title: string };
    },
    // HOST to MODULE: listeners
    {
      /** Sent by the host when @demo/configuration emits a change. */
      "config:changed": { path: string; value: unknown };
    },
    // MODULE to HOST: requires
    {
      logger: { write(entry: { action: string; detail?: unknown }): void };
    },
    // HOST to MODULE: config
    {
      title: string;
      modes: ModePreset[];
      initialMode: ModeKey;
      leftPanel: { visible: boolean; width: number; minWidth: number };
      rightPanel: { visible: boolean; width: number; minWidth: number };
    }
  > {
  module: { name: "@demo/layout"; version: "1.0.0" };
}

export const Layout: WmepFactory<Layout> = createLayout;

export const LayoutView = InternalView;
```

The internal files (`layout.ts`, `layout.view.tsx`) are private to the module directory; the host (`demo/nextjs/src/app/...`) imports only from `./layout.wmep` — never from `./layout` or `./layout.view`. Swapping the framework (Svelte / Lit 3 / vanilla ESM) only changes the `*.view.{ext}` file; the boundary, the rule, and the internal state machine stay identical.

## Quick start

```bash
npm install
```

Run the counter example:

```bash
npx tsx examples/counter/host-app.ts
```

Run the orchestration host (all six modules under one host):

```bash
npx tsx examples/orchestration-host-app.ts
```

Run the Next.js demo:

```bash
cd demo/nextjs && npm install && npm run dev
```

## Boundary contract

A wMEP module exports one symbol from its `*.wmep.ts` file. TypeScript declaration merging makes that symbol both the contract (TYPE space) and the factory (VALUE space):

```ts
import type { WmepFactory, WmepModule } from "@aurorah/wmep";
import { createCounter } from "./counter.js";

export interface Counter extends WmepModule<
  // capabilities (HOST -> MODULE)
  { state(): { value: number }; bump(p?: { amount?: number }): number; reset(): void },
  // events (MODULE -> HOST)
  { "counter:changed": { value: number; source: "bump" | "reset" | "interval-tick" } },
  // listeners (HOST -> MODULE)
  { "counter:reset-request": void },
  // requires (MODULE -> HOST)
  { logger: { write(entry: { action: string; detail?: unknown }): void } },
  // config (HOST -> MODULE)
  { initial?: number; step?: number }
> {
  module: { name: "@aurorah/wmep-counter"; version: "1.0.0" };
}

export const Counter: WmepFactory<Counter> = createCounter;
```

| Slot           | Direction          | Class analogy                  |
| -------------- | ------------------ | ------------------------------ |
| `capabilities` | HOST -> MODULE     | Concrete methods (callable)    |
| `events`       | MODULE -> HOST     | Observer callbacks             |
| `listeners`    | HOST -> MODULE     | Parent notifications           |
| `requires`     | MODULE -> HOST     | Abstract methods (host-impl.)  |
| `config`       | HOST -> MODULE     | Constructor args               |

Reserved lifecycle events `wmep:mounted` / `wmep:unmounted` are emitted automatically by `createWmepModule` -- the author never re-implements event plumbing, the FIFO listener buffer, or the mount/unmount runner.

## Host surface

`Counter(requires, config)` returns a `WmepInstance<Counter>` exposing exactly four members:

| Member          | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `capabilities`  | HOST -> MODULE method dispatch                                          |
| `on(name, cb)`  | MODULE -> HOST subscription (author events + reserved lifecycle events) |
| `notify(name)`  | HOST -> MODULE listener dispatch (FIFO-buffered until mount completes)  |
| `unmount(why)`  | HOST -> MODULE teardown (awaits onMount, runs cleanup, idempotent)      |

Everything else (subscriber Sets, pending buffer, cleanup closure) stays sealed inside the factory.

## Examples

| Example               | capabilities                                  | requires                                    |
| --------------------- | --------------------------------------------- | ------------------------------------------- |
| `counter`             | state, bump, reset                            | logger.write                                |
| `analytics-dashboard` | getFilters, setChart, refresh                 | metrics:query/aggregate/live                |
| `file-manager`        | getSelectedPath, navigate, setViewMode        | fs:list/read/write/delete/move              |
| `kanban-board`        | getBoard, getCard, moveCard                   | board:load, card:create/update/move/delete  |
| `media-player`        | play, pause, stop, getState, setVolume        | playlist:load/add/remove, track:info/stream |
| `rich-text-editor`    | getContent, setContent, format                | doc:load/save/list/export                   |

The `orchestration-host-app.ts` example wires all six modules into a single host and demonstrates cross-module flows (editor save -> dashboard invalidation, file delete -> kanban card delete, player ticks -> dashboard audit, etc.).

## Encapsulation

The boundary is enforced by import convention:

```
external code --> *.wmep.ts (TYPES + factory)
                       |
                       v
                  *.ts (internal -- NEVER imported from outside)
```

Internal files may freely import each other inside the module directory; outside code can only reach the single boundary file. ESLint or repo-wide CI checks can enforce "no import of `module/*.ts` from outside `module/`" if stricter guarantees are required.

## Relation to wMCP

| Layer | Concern                                | Source of truth                |
| ----- | -------------------------------------- | ------------------------------ |
| wMCP  | Host <-> module connection             | JSON manifest + runtime client |
| wMEP  | File-level public surface of a module  | One `interface` per module     |

Use wMEP standalone for in-process TypeScript modules where the boundary is a file, and combine it with wMCP when the same modules need to be mounted as remote / cross-process plugins.

## License

MIT
