# `notes.ts` — Canonical Rule

> This file is the canonical specification for the `notes` module.
> AI agents and contributors MUST read this file before editing any
> file under `src/modules/notes/**`, and MUST keep the module
> compliant with the **Canonical Rules** below.
>
> **Framework binding**: Next.js 16 + React 19.

## Description

- The in-memory notes store is laid out here. Anything in the app
  that needs ad-hoc, user-authored short text notes (add / edit /
  remove / list) should flow through this module rather than hold
  its own local list.

## Canonical Rules

- **Rule 1**: The store MUST enforce a configurable maximum number
  of notes `M`. Beyond `M`, addition MUST be refused (raised as an
  error) — never silently dropped. (e.g., `M = 50`)
- **Rule 2**: Every create / update / delete / clear MUST emit a
  matching event so other modules can stay in sync.
- **Rule 3**: Each note's identifier MUST be unique and stable for
  the note's full lifetime — editing a note MUST never change its
  identifier or its creation timestamp.
- **Rule 4**: Default seed list and maximum `M` MUST come from the
  configuration module — never hard-coded inside this module.

## Provisions

- Operations: add, edit, remove, clear, list
- Capacity: configurable maximum `M`
- Note shape: identifier, text, creation timestamp
