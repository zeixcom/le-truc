# ADR 0021: `query`/`queryAll` — Root-Parameterized Siblings of `first`/`all`

## Status

✅ Accepted

## Context

`reconcile()`'s `bindItem`, `each()`'s callback, and several factory bodies and free-standing helper functions all fall back to plain `element.querySelector<T>(selector)` / `.querySelectorAll<T>(selector)` on an arbitrary already-obtained `Element`. This loses the type-safe-query guarantees `first`/`all` provide at the host level: selector-to-type inference, `MissingElementError` on a required-but-absent child, and actionable error messages.

Confirmed against real usage across six components:

- **Per-item, inside `bindItem`/`each`:** `examples/module/calctable`, `examples/module/list`, `examples/module/todo`, `examples/module/ticker` — all hand-roll `element.querySelector` with manual `?.` chaining and no compile-time type inference.
- **Second-level, relative to an already-`first()`-obtained element, elsewhere in the factory or in free-standing helper functions:** `examples/card/blogmeta` (`author.querySelector('img')`), `examples/module/lazyload` (a lookup inside dynamically-injected `innerHTML`, relative to `contentEl = first('.content', ...)`), `examples/module/listnav` (`listbox.querySelector(...)` in helper functions that only receive the element, not the factory context), and `examples/module/todo`'s `getItemText`/`moveItem` — called from drag/keyboard handlers *after* `bindItem` has already returned, so a lookup bound only inside `bindItem`'s closure cannot reach them.
- **One-shot multi-element snapshot:** `examples/form/listbox`'s roving-tabindex focus management wants `listbox.querySelectorAll(...)` as a plain array, hand-rolled today because `all()` is unavoidably live/`Memo`-backed.

Gathered as [REQUIREMENTS.md §S6](../REQUIREMENTS.md#s6-typed-throwing-root-parameterized-element-lookup-queryqueryall).

## Decision

1. **New standalone exports: `query(root, selector, required?)` and `queryAll(root, selector, required?)`.** Same selector-to-type inference and `MissingElementError`-throwing/optional behavior as `first`/`all`, applied to an explicit `root` argument instead of a closed-over host. `queryAll()` returns a plain array, not a `Memo` — no `MutationObserver`, one-shot only. Neither collects dependencies for `resolveDependencies()`. This is the primary, general-purpose fix — usable anywhere an author already has an `Element` in hand, not just inside `bindItem`/`each`.

2. **`first()`/`all()` are implemented in terms of `query`/`queryAll`.** `makeElementQueries(host)` binds `query`/`queryAll` to `host.shadowRoot ?? host` and adds the dependency-collection step on top. No separate lookup implementation, no `makeFirstElement` factory — `query`/`queryAll` are the primitive; `first`/`all` are `query`/`queryAll` plus host-binding plus dependency tracking.

3. **`bindItem` and `each()`'s callback receive `first` pre-bound to the item's root**, as their last parameter — the 4th on `bindItem` (after `element`, `item`, `key`), the 2nd on `each()`'s callback (after `element`). Purely additive: existing callbacks that don't destructure the new parameter are unaffected. No v3/breaking-change gate needed.

4. **Naming: standalone exports are `query`/`queryAll`, deliberately distinct from `first`/`all`; the `bindItem`/`each` parameter is `first`, not `query`.** `query`/`queryAll` mirror the native `querySelector`/`querySelectorAll` relationship — they wrap exactly that, minus the dependency-tracking and liveness that make `first`/`all` special, and are meant for explicit-root, one-off calls. The `bindItem`/`each` parameter is a *pre-bound* lookup, same shape and role as host-level `first()` — both are single-element, throw-if-required, one-off relative to a fixed root; the only behavioral difference (no M8 dependency-resolution participation) is a documented asymmetry, not a naming concern. Naming it `first` also avoids an unrelated hazard: naming it `query` would shadow a same-scope `import { query } from '@zeix/le-truc'` — a real conflict, since `module-todo.ts`'s `reconcile()` call and its `getItemText`/`moveItem` helpers (which need standalone `query`, see LT-007) sit in the same file. `biome.json` has no `noShadow`-equivalent rule, so that shadow would be silent.

5. **No `all()` equivalent for the per-item case, no live tracking.** `bindItem`/`each`'s bound parameter is `first` only (no `all` equivalent bound to the item) — no current component needs a live *or* one-shot collection scoped to an item. Item subtrees are cloned once from the template and are static; a `MutationObserver` per reconciled row would be unwarranted cost at the 1000+-element scale target ([REQUIREMENTS.md §1 Success Criteria](../REQUIREMENTS.md#success-criteria)).

6. **No participation in M8 dependency resolution.** `query`/`queryAll`, and the `first` parameter bound from them, never defer for undefined custom elements, at the host level or item level. Rationale for the item-scoped case specifically: the host's one-time dependency wait happens once at connect, before `reconcile()`'s effect ever runs — items added later can never block the host's own effects, so there is nothing for a per-item deferral to protect. If an existing, not-yet-upgraded custom element must gate host effects, it is queried via the host-level `first`/`all` (which do participate), not the item-scoped `first` or the standalone `query`/`queryAll`. This is a real, accepted asymmetry, not an oversight.

7. **`MissingElementError` gets an optional 4th parameter, `contextLabel: string = 'component'`.** The item-scoped `first` call site passes `'item'`, producing `"Missing required element <selector> in item <tr.row>. ..."` instead of the misleading `"in component <tr.row>"`. `query`/`queryAll` called directly (not via `bindItem`/`each`) default to `'component'`, matching host-level `first`/`all`'s existing wording. Additive — existing 3-arg call sites are unaffected.

## Alternatives Considered

- **A scoped `first` parameter only, no standalone export** — rejected after the cross-check: it cannot serve `card-blogmeta`, `module-lazyload`, `module-listnav`, `module-todo`'s `getItemText`/`moveItem` (called outside `bindItem`'s scope entirely), or `form-listbox`'s snapshot case. A standalone root-parameterized function serves all of these plus the original `bindItem`/`each` need, with no duplicated logic.
- **A `{ query }` context object**, mirroring `FactoryContext`, instead of a bare positional function for the `bindItem`/`each` parameter — rejected. `element`/`item`/`key` are already delivered as bare positional parameters; a bare function stays consistent with that existing pattern.
- **Naming the `bindItem`/`each` parameter `query`**. – `query` shadows a same-scope `import { query }`; Other names avoid the shadow but break the direct pre-bound-lookup symmetry with host-level `first` for no compensating benefit, once the dependency-resolution asymmetry is documented explicitly rather than encoded in the name.
- **Live/`Memo`-backed `all` equivalent for `bindItem`/`each`** — rejected. No current component needs a live or one-shot collection scoped to an item, and per-item `MutationObserver`s don't fit the 1000+-element scale target.
- **Threading the owning host component through**, so the item-scoped error could read "in item `<tr>` of `<my-table>`" — rejected for now. No existing plumbing carries the host into `bindItem`'s scope machinery, and the item element's own `elementName()` (tag + id/class) is usually enough to identify the row. Can be added later without a breaking change.
- **Participating in M8 dependency resolution** — rejected as unnecessary complexity for a need no current component has; the host-level `first`/`all` remain the correct place to gate effects on undefined custom elements.

## Consequences

- `first`/`all` and `FactoryContext` are completely unchanged in behavior — zero migration cost for existing consumers, though their internal implementation is refactored to sit on top of `query`/`queryAll`.
- Two new top-level exports, `query`/`queryAll`, tree-shakeable per M14 if unused. Bundle cost is small: the compile-time selector→type inference is pure TypeScript generics (zero runtime bytes), and `queryAll` needs no `Memo`/`MutationObserver` machinery.
- `reconcile()`'s and `each()`'s callback signatures each grow by one optional-to-use trailing parameter (`first`, pre-bound to the item's root).
- Component authors get a documented, narrow limitation: `query`/`queryAll` cannot gate host effects on undefined custom elements, at any scope; that must go through the host-level `first`/`all`.
- `examples/module/calctable`, `examples/module/list`, `examples/module/todo`, `examples/module/ticker`, `examples/card/blogmeta`, `examples/module/lazyload`, `examples/module/listnav`, and `examples/form/listbox` can all drop their hand-rolled `querySelector`/`querySelectorAll` calls in favor of `query`/`queryAll`, regaining type inference and actionable missing-element errors.

## Related

- Requirements: [S6](../REQUIREMENTS.md#s6-typed-throwing-root-parameterized-element-lookup-queryqueryall), [M4](../REQUIREMENTS.md#m4-type-safe-dom-queries), [M8](../REQUIREMENTS.md#m8-dependency-resolution-for-nested-custom-elements), [M14](../REQUIREMENTS.md#m14-tree-shakeable-exports)
- Architecture: [Query System](../ARCHITECTURE.md#query-system), [List Reconciliation](../ARCHITECTURE.md#list-reconciliation), [Naming Conventions](../ARCHITECTURE.md#naming-conventions)
