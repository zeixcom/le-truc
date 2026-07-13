# PLAN: `reconcile()` — Keyed Template-Clone Reconciliation for Lists

Status: decided — design questions settled 2026-07-14; ready to build.
Decision record: **ADR 0016**, suggested filename
`0016-keyed-template-clone-reconciliation-for-lists.md`, to be written before
implementation.

> ADR 0015 is reserved for the ElementInternals support feature (parallel
> branch); both land in v2.3.

This primitive is a precondition for the TSRX server-component exploration
(see PLAN-tsrx-server-components.md, "Precondition" section), but it is
justified standalone: the pattern already exists hand-written in
`examples/module/list/module-list.ts:40-99` and is too brittle to ask
authors to write.

## Goal

Generalize the hand-written reconciliation into a library primitive that
syncs a keyed reactive data source to a container's children: clone a
`<template>` for entering keys, remove leavers, move survivors with
DOM moves, and mount per-item bindings in keyed per-element scopes
(reusing the ownership discipline of ADR 0014's `keyedScopes`).

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
   `byKey(key): Signal | undefined`. The parameter is typed against the
   **branded** union, not a structural interface: `Store<T>` happens to
   satisfy the structural shape but is excluded because its items are not
   homomorphic (each property is its own signal), which the reconciler's
   per-item `bindItem` contract assumes. No `Memo<T[]>` support: that is
   `each()`'s domain.
4. **One-way sync: data → DOM, never the reverse.** `reconcile()` does not
   read item data back from the DOM. Users who want DOM-seeded state parse
   the DOM themselves and build the initial `List` from it before wiring
   `reconcile()` — where the `List` gets its data is not the primitive's
   business. On the first effect run, keyed children whose key is not in the
   source are **removed**. Event handlers that mutate the list (add, remove,
   reorder) are the legitimate path to change the DOM's structural state —
   they write to the list, `reconcile()` writes to the DOM.
5. **Template contract.** The author queries the `<template>` (e.g.
   `first('template', …)`) and passes it in. Exactly one root element inside
   the template is enforced (DEV_MODE error otherwise). `bindItem` does all
   content work — no default fill convention (replaces `module-list`'s
   one-off `querySelector('slot')?.replaceWith(…)` trick).
6. **Moves use `insertBefore()` only.** State-preserving `moveBefore()` is
   deferred to a later optimization (see #8): landing it later improves UX
   for all users as browser support solidifies, without requiring a DOM API
   migration. Nodes are always reused on reorder, never recreated.
7. **Deferred optimizations.** No built-in empty-state handling (compose
   `watch(…, bindVisible(fallback))` on the source's length/keys), no view
   transitions, no RAF batching via `schedule()`, no `moveBefore()`, no
   nested-reconciler support guidance. Revisit with evidence.
8. **`data-unreconciled` opt-out.** Children carrying `data-unreconciled`
   are exempt from reconciliation: never removed, never repositioned.
   `reconcile()` pretends they don't exist for structural purposes. This is
   a public SSR contract (server templates emit it to exempt streamed-in
   content) and is permanent once shipped — recorded in ADR 0016 as a
   first-class decision. Use case: a drag-and-drop marker, or a
   server-streamed item arriving while the user is mid-interaction, must not
   be yanked by a reconcile re-run. Keyed children are positioned
   **relative to the keyed subset**, not absolute child index, so unmanaged
   elements interspersed in the container do not drift keyed positions.
9. **Internal bookkeeping via `WeakMap<Element, string>`.** Runtime
   key→element matching uses a WeakMap (replaces the `Map<E, dispose>` shape
   from `keyedScopes`). `data-key` is retained on cloned/adopted elements
   as the DOM-facing attribute for two purposes: **SSR adoption harvest**
   (server emits `data-key` so the first run can match existing children to
   source keys) and **event-delegation ergonomics** (e.g. `module-list`'s
   click handler reads `item.dataset.key`). WeakMap is internal, `data-key`
   is DOM-facing — they are complementary, not either/or.

## API sketch

```ts
reconcile<T>(
	container: Element,
	template: HTMLTemplateElement,
	source: List<T> | Collection<T>,
	bindItem: (element: HTMLElement, item: Signal<T>, key: string) => MaybeCleanup,
): Effect
```

`bindItem` follows the `keyedScopes` mount contract: called once per
entering element inside a root-keyed scope; a returned cleanup registers on
that scope. It runs for **adopted** server-rendered elements too, not only
cloned ones — reactive content bindings must attach either way. The
`bindItem` implementation is responsible for idempotency on first run
against server-rendered content (skip, augment, or overwrite — the user's
choice); `reconcile()` itself is idempotent: re-running against a DOM that
already matches the source's keys is a no-op.

## Semantics

- **First run (adoption).** Harvest existing children carrying `data-key`.
  Keys present in the source: element adopted, `bindItem` mounted. Keys
  absent from the source: element removed (DEV_MODE warning). Children
  carrying `data-unreconciled` are exempt (kept as-is, no `bindItem`). All
  other unkeyed children are removed (self-cleaning container).
- **Entering key.** Clone `template.content`, take the single root element,
  set `data-key`, mount `bindItem` in a new root-keyed scope, insert at the
  target position (keyed-relative: after the previous keyed sibling, or at
  the head if first, ignoring any `data-unreconciled` elements in between).
- **Leaving key.** Dispose the element's scope, then remove the element
  (teardown-before-setup ordering as in `keyedScopes`).
- **Reorder.** Position keyed elements to match source key order using
  `insertBefore()`, keyed-relative to the previous keyed sibling.
  `data-unreconciled` elements are neither removed nor repositioned.
- **Reactivity split.** The effect tracks *structural* changes only (the
  source's keys, read via `source.keys()` inside the `createEffect`).
  Per-item value changes flow through the `byKey` signal passed to
  `bindItem` and never trigger structural work.
- **Ownership.** Carries over the two load-bearing details documented on
  `keyedScopes` (src/helpers/reactive.ts): per-item scopes are created with
  `{ root: true }` so effect re-runs don't dispose them wholesale, and an
  outer `createScope` registers the teardown-all cleanup on the component
  scope for disconnect.
- **`each()` / `all()` interaction.** `reconcile()` behaves like the
  existing `watch(() => Array.from(list.keys()), …)` block — same reactive
  subscription, same DOM-mutation timing. `all()`'s lazy MutationObserver
  fires the same way when `reconcile()` adds/removes elements, so
  `each()`-mounted scopes on reconciled descendants dispose correctly.
  Worth a verification test during implementation but not a design blocker.

## Implementation steps

1. **ADR 0016** (via adr-keeper): decision, alternatives considered
   (`each()` overload, `Memo<T[]>` + key function, two-way DOM seeding,
   structural `KeyedSignals<T>`), consequences — including that this is Le
   Truc's first data-driven DOM creation, the `data-unreconciled` SSR
   contract, and the keyed-relative positioning rule.
2. **Implement** in `src/helpers/reactive.ts` next to `each()`/
   `keyedScopes`; export from `index.ts`; JSDoc with `@since 2.3`. Internal
   bookkeeping via `WeakMap<Element, string>`; `data-key` on DOM;
   `data-unreconciled` opt-out; keyed-relative positioning; `insertBefore()`
   only.
3. **Unit tests** (`src/tests`, existing conventions): first-run adoption;
   removal of unmatched keyed AND unkeyed children (self-cleaning);
   `data-unreconciled` elements untouched (not removed, not repositioned);
   enter/leave/move sequences; node reuse on reorder; keyed-relative
   positioning with interspersed unmanaged elements; scope disposal on
   disconnect; `Collection<T>` as source; template-root validation error
   (`TypeError`, following `src/errors.ts` conventions — named
   `InvalidTemplateError` or similar).
4. **Migrate `module-list`** to `reconcile()`, deleting the hand-written
   `watch()` block; existing Playwright spec stays green.
5. **Migrate `module-todo`** (in scope): delete the hand-written
   `watch()` block; refactor DnD so `moveItem()` mutates the list (not the
   DOM directly) and `reconcile()` is the sole writer to the container's
   structural children. Transient DnD state (marker, `dragging` class,
   inline position styles) is owned by the event handlers imperatively —
   the marker carries `data-unreconciled` so a mid-drag reconcile re-run
   (e.g. server-streamed item) does not yank it. The event handlers are
   responsible for cleaning up transient state on drop/cancel. Existing
   Playwright spec stays green.
6. **Docs & tooling passes:** ARCHITECTURE.md (helpers table + ADR link),
   docs-src example page, changelog entry (changelog-keeper), le-truc /
   le-truc-dev skill files (tech-writer).

## DnD boundary (module-todo refactor guidance)

- **`reconcile()` owns structural children** — which keyed element exists
  at which position in source order.
- **DnD owns transient decoration** — marker insertion, `dragging` class,
  inline position styles. No list mutation happens during the drag, so
  `reconcile()` doesn't re-run mid-drag and won't fight in-flight visuals.
- **On `pointerup`**, commit the reorder via `list.update()` → `reconcile()`
  moves the real element → marker/cleanup happens separately.
- **`data-unreconciled` on the marker and dragged item** protects them if a
  list mutation fires mid-drag from another path (server stream, concurrent
  edit). Strip the attribute on drop/cancel before committing.

## Open implementation details (settle during implementation, not blockers)

- Error class name for template validation, following `src/errors.ts`
  conventions (`TypeError` subclass, `elementName` context — pattern matches
  `InvalidSelectorError`). `bindItem` parameter order is locked:
  `(element, item, key)`.
