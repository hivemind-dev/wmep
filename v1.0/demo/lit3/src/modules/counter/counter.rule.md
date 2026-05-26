# `counter.ts` — Canonical Rule

> This file is the canonical specification for the `counter` module.
> AI agents and contributors MUST read this file before editing any
> file under `src/modules/counter/**`, and MUST keep the module
> compliant with the **Canonical Rules** below.
>
> **Framework binding**: Lit 3 (Web Components).

## Description

- The integer-counter module is laid out here. Anything in the app
  that needs an incrementable / decrementable / resettable integer
  state should flow through this module rather than keep its own
  ad-hoc number.

## Canonical Rules

- **Rule 1**: The counter's value MUST be mutated only through this
  module's public operations — never by external code mutating
  internal state directly.
- **Rule 2**: Every value change MUST produce both an audit log
  entry and a "value-changed" event in the same step, so the log
  and the event stream never drift apart.
- **Rule 3**: The starting value and step size MUST come from the
  configuration module — never hard-coded inside this module.
- **Rule 4**: External resets MUST be requestable by event from any
  other module, without requiring a direct handle to this one.

## Provisions

- Operations: increment, decrement, reset
- Read state: current value
- External reset: requestable by cross-module event
