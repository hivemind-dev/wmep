# `clock.ts` — Canonical Rule

> This file is the canonical specification for the `clock` module.
> AI agents and contributors MUST read this file before editing any
> file under `src/modules/clock/**`, and MUST keep the module
> compliant with the **Canonical Rules** below.
>
> **Framework binding**: Next.js 16 + React 19.

## Description

- The live wall-clock module is laid out here. Anything time-related
  in the app — visible clock display, periodic heartbeats,
  timestamping — should flow through this module rather than reach
  for `Date` / `setInterval` directly elsewhere.

## Canonical Rules

- **Rule 1**: The clock must tick at a fixed, configurable interval
  of `T` milliseconds. `T` MUST be configurable (e.g., `T = 1000ms`),
  never hard-coded.
- **Rule 2**: The clock must be pause-able and resume-able by user
  action without losing its configured interval.
- **Rule 3**: The display format must support both 12-hour and
  24-hour modes, switchable at runtime.
- **Rule 4**: All initial values (interval, format) MUST come from
  the configuration module — never hard-coded inside this module.

## Provisions

- Time source: a single ticking heartbeat at interval `T`
- Display format: 12-hour, 24-hour
- Control: pause, resume
