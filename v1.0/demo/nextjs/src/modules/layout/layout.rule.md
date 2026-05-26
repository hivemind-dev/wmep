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
