# PLAN: `reconcile()` — Keyed Template-Clone Reconciliation for Lists

Status: decided — design questions settled 2026-07-13; ready to build.
Decision record: **ADR 0017**, suggested filename
`0017-keyed-template-clone-reconciliation-for-lists.md`, to be written before
implementation.

This primitive is a precondition for the TSRX server-component exploration
(see PLAN-tsrx-server-components.md, "Precondition" section), but it is
justified standalone: the pattern already exists hand-written in
`examples/module/list/module-list.ts:40-99` and is too brittle to ask
authors to write.

## Goal

Generalize the hand-written reconciliation into a library primitive that
syncs a keyed reactive data source to a container's children: clone a
`<template>` for entering keys, remove leavers, move survivors with
state-preserving DOM moves, and mount per-item bindings in keyed per-element
scopes (reusing the ownership discipline of ADR 0014's `keyedScopes`).

## Settled decisions

1. **Separate primitive, not an `each()` overload.** `each()` enhances DOM
   the component doesn't own (`Memo<Element[]>`, DOM-driven); `reconcile()`
   owns the container's children (data-driven). Same placement as `each()`:
   top-level export from the package (`import { reconcile } from
   '@zeix/le-truc'`), returning an effect descriptor (ADR 0007).
2. **Name: `reconcile()`.** Plain verb per the factory-helper naming
   convention; it doesn't fit `bind*` (those are pure setters — this manages
   scopes and cleanup).
3. **Data contract: `List<T> | Collection<T>`.** Both already share the read
   interface the reconciler needs — `keys(): IterableIterator<string>` and
   `byKey(key): Signal | undefined` — so the parameter is typed against that
   structural interface. No `Memo<T[]>` support: that is `each()`'s domain.
4. **One-way sync: data → DOM, never the reverse.** `reconcile()` does not
   read item data back from the DOM. Users who want DOM-seeded state parse
   the DOM themselves and build the initial `List` from it before wiring
   `reconcile()` — where the `List` gets its data is not the primitive's
   business. On the first effect run, keyed children whose key is not in the
   source are **removed**.
5. **Template contract.** The author queries the `<template>` (e.g.
   `first('template', …)`) and passes it in. Exactly one root element inside
   the template is enforced (DEV_MODE error otherwise). `bindItem` does all
   content work — no default fill convention (replaces `module-list`'s
   one-off `querySelector('slot')?.replaceWith(…)` trick).
6. **Moves use `moveBefore()`** (state-preserving: focus, animations, iframe
   state) with an `insertBefore` fallback, feature-detected once. Nodes are
   always reused on reorder, never recreated.
7. **Deferred optimizations.** No built-in empty-state handling (compose
   `watch(…, bindVisible(fallback))` on the source's length/keys), no view
   transitions, no RAF batching via `schedule()`, no nested-reconciler
   support guidance. Revisit with evidence.

## API sketch

```ts
// Shared read interface — satisfied by List<T> and Collection<T>
type KeyedSignals<T> = {
	keys(): IterableIterator<string>
	byKey(key: string): Signal<T> | undefined
}

reconcile<T>(
	container: Element,
	template: HTMLTemplateElement,
	source: KeyedSignals<T>,
	bindItem: (element: HTMLElement, item: Signal<T>, key: string) => MaybeCleanup,
): Effect
```

`bindItem` follows the `keyedScopes` mount contract: called once per
entering element inside a root-keyed scope; a returned cleanup registers on
that scope. It runs for **adopted** server-rendered elements too, not only
cloned ones — reactive content bindings must attach either way.

## Semantics

- **First run (adoption).** Harvest existing children carrying `data-key`.
  Keys present in the source: element adopted, `bindItem` mounted. Keys
  absent from the source: element removed (DEV_MODE warning).
- **Entering key.** Clone `template.content`, take the single root element,
  set `data-key`, mount `bindItem` in a new root-keyed scope, insert at the
  target position.
- **Leaving key.** Dispose the element's scope, then remove the element
  (teardown-before-setup ordering as in `keyedScopes`).
- **Reorder.** Position keyed elements to match source key order using
  `moveBefore()`/`insertBefore`.
- **Reactivity split.** The effect tracks *structural* changes only (the
  source's keys). Per-item value changes flow through the `byKey` signal
  passed to `bindItem` and never trigger structural work.
- **Ownership.** Carries over the two load-bearing details documented on
  `keyedScopes` (src/helpers/reactive.ts): per-item scopes are created with
  `{ root: true }` so effect re-runs don't dispose them wholesale, and an
  outer `createScope` registers the teardown-all cleanup on the component
  scope for disconnect.

## Implementation steps

1. **ADR 0017** (via adr-keeper): decision, alternatives considered
   (`each()` overload, `Memo<T[]>` + key function, two-way DOM seeding),
   consequences — including that this is Le Truc's first data-driven DOM
   creation.
2. **Implement** in `src/helpers/reactive.ts` next to `each()`/
   `keyedScopes`; export from `index.ts`; JSDoc with `@since 2.3`.
3. **Unit tests** (`src/tests`, existing conventions): first-run adoption;
   removal of unmatched keyed AND unkeyed children;
   enter/leave/move sequences; node reuse on reorder; focus preservation
   where `moveBefore()` is available; scope disposal on disconnect;
   `Collection<T>` as source; template-root validation error.
4. **Migrate `module-list`** to `reconcile()`, deleting the hand-written
   `watch()` block; existing Playwright spec stays green. Check whether
   `module-todo` should migrate too.
5. **Docs & tooling passes:** ARCHITECTURE.md (helpers table + ADR link),
   docs-src example page, changelog entry (changelog-keeper), le-truc /
   le-truc-dev skill files (tech-writer).

## Open implementation details (settle during implementation, not blockers)

- Exact `bindItem` parameter order — align with whatever `each()`'s mount
  callback style reads best next to.
- Error type/name for template validation, following `src/errors.ts`
  conventions.
