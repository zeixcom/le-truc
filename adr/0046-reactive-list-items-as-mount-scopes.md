# ADR 0046: Reactive-List Items as Mount Scopes — Signal Items, a Keyed `map`, Recursive Emission

## Status

✅ Accepted (owner, design session 2026-10-04) — amends [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s5, [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s2 and [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) s5.

## Context

A reactive list lowered to a slot-fill contract (one slot for the bare item, plus per-item listeners), enough for a list of strings with a remove button. The components ported from real projects need more per item: `pass()` into child components, reactive attributes, key-derived `id`/`for`, composed children, nested lists, conditions and setup code. The compiler refused each of these, except for two silent failures: a composed child was dropped from the template, and an object item rendered as `[object Object]`. Meanwhile the conditional's arms ([ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md)) already ran the full effect emission in a cloned template, by another path. ADR 0024 s1 (full expressiveness; [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format)) requires every pattern to be expressible on every surface ([ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6).

## Decision

A reactive-list item is a **Mount Scope**: like the host and an arm, it is an element subtree with its own mount and its own `first`, bound to its root. Item content lowers through the same emission as arm content, and that emission recurses.

1. **Recursive emission.** Every construct (element effects, `truc:pass`, events, compose-site handler args ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10 — client code, so they may read the item and key, unlike server args), arm sets, lists, server-data loops, composed-child references) emits into the mount of its nearest enclosing Mount Scope and uses that scope's `first`. Nesting composes by recursion, and the slot-fill path retires. What remains refused: an item or arm with other than exactly one root element (the key lives on the root); a reactive condition directly in a list's container (the list removes children it did not place); and a host-level `first()` into a scope (its elements are recreated).

2. **Addressing is proved, never searched.** An element bound in a scope uses a selector that the structural proof ([ADR 0045](0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md)) shows matches nothing in any nested scope's possible content (every arm of a nested set, every nested item shape). When no class, role or `data-*` separates the elements, a `:scope >` child path is synthesized. Failure is a build error whose fix is a unique class. A selector in a scope may name **the scope root itself**: the compiler resolves it and emits the root parameter. This has no runtime counterpart, because `querySelector` searches descendants only, and it is preferred over a reserved name appearing from nowhere. A list's template is stamped `data-list="N"`, where N is a compile-time, document-order index per component. Every list template is a direct child of the host, after its rendered content, and is queried from the host as `:scope > template[data-list="N"]`, whatever the nesting depth. A container can then be any element, a scope root included (`<tbody>`, `<optgroup>`), and it holds only its items. The direct-child step keeps other components' markup from answering, and repeated instances need no page-unique id. A hoisted template renders with every enclosing scope's bindings unbound; a mount writes an enclosing scope's values at adopt and clone. Arm templates stay beside their arm ([ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md)), because the arm form anchors on them. A server-data loop inside a scope lowers to a scoped static query, because its items are fixed for the life of the clone.

3. **Items are signals.** In client positions the item is the signal the List hands out: a `MutableStore<T>` under `createItem: createStore`, otherwise the item's own signal. It is read with `.get()` in arrows and written with `.set()`. Server args are values, and client reactivity is visible as thunks, host props and signal reads. That is Le Truc's model, and a list item gets no exception. `.tsrx`'s bare `{item}` remains as its signal shorthand. The Value Harness follows exactly: lists iterate cells, and a store's fields are cells.

4. **A keyed `map` on lists.** Cause & Effect lists, both mutable and derived, gain `map((item, key) => R): R[]` and `forEach`. Each callback receives the item signal and its stable string key. `map` returns a plain array and tracks the list's structure only, never item values. The precedent is `Map.prototype.forEach((value, key))`: a list is created from an array but is keyed like a `Map`. `.tsx` spells a reactive loop as `items.map((item, k) => …)` over a declared `createList` or `deriveList`, while `.map((item, i))` over an Array keeps the index. tsc tells them apart by the receiver's type. `.tsrx` keeps `@for (const item of items; key k)`.

5. **Per-item setup.** The block body of the `map` callback (or statements in an `@for` body) is classified by the component-setup rules, with the item and key as known names. Client-only statements run in the item's mount and are disposed with it. A list declared there is a loop source. `createSensor` is a recognized signal constructor whose seed is its server value. An imported function is a known name in a setup side effect, so shared client-only helpers are callable. Arms carry no setup statements until a component needs them.

6. **Text positions take primitives, through TypeScript.** Every text sink the compiler emits, on the server and the client, accepts `string | number`. Nil keeps the last value, and a boolean is an error. The emit-then-check pass ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s6) reports an object in a text position at its authored line.

7. **Per-field harvest.** An item of a list seeded from server args is harvested field by field, each field from its canonical render site within the adopted item. A field the key configuration returns verbatim comes from `data-key`. A formatted site needs a raw source. Every field of the item type needs a site, else the build fails: no phase delivers a value the markup does not carry ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md)). A field's parser is inferred from a same-file item type (`number` through `asNumber`: `String(n)` round-trips). A field it cannot resolve (an imported type, `Date`) is declared on the seed: `createList(harvest(items, { due: … }), …)`. `harvest()` is a compile-time marker ([ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1). An entry overrides inference, an optional field is always declared, and the generated item is checked against the item type, so a wrong parser is a tsc error at the authored line. A scalar seed declares its parser alike: `harvest(price, asNumber())`.

## Alternatives Considered

- **Extend the slot-fill path one channel at a time**: rebuilds the arm emission beside itself, and keeps two machines in step.
- **Items as values, rewritten to `.get()` by the compiler**: needs a source rewrite, writes need a separate route through the key, and tsc would see `T` while the runtime holds a signal.
- **The key as `entries()` pairs**: JSX consumes a `map` directly. **As `item.key`**: a signal does not know its key, and a stamped property collides with a field named `key`. **As a `truc:` intrinsic**: fails [ADR 0041](0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)'s bar.
- **A boundary-aware runtime `first`**: a walk per query, and `data-key` marks arm roots too.
- **Author-supplied template ids**: an id must be unique per page, and a component's markup repeats. **Templates inside the container, unreconciled**: structural pseudo-classes (`:last-child`, `:empty`) count them, and containers are where structural CSS lives.
- **Sub-components for per-item setup**: needs a per-item argument channel into composed children; it stays an authoring choice.
- **Inference only**: cannot express a `Date` field or an imported type. **An explicit parser map only**: restates the item type per list. **A `parse` option on `createList`**: Cause & Effect has no parsers and would carry a field it never reads. **Parsers annotated at render sites**: a field may render at several sites, and only the canonical one is read.
- **Compiler-stamped attributes for unrendered fields**: a per-item state payload under another name.
- **An LTC rule for non-primitive text**: the compiler has no type information, so a syntactic heuristic would catch less than tsc already proves.

## Consequences

**Good:**

- One emitter for every cloned subtree; nesting follows from it and needs no special case.
- Per-item wiring is fine-grained: a store field's change reaches its one binding.
- `.tsx` reactive lists typecheck, and the item-scoped action (`items.remove(k)`) has a spelling on both surfaces.
- The silent drop and the silent misrender become, respectively, a supported construct and a type error.

**Bad / accepted tradeoffs:**

- Hoisted list templates are trailing children of the host, so `:host > :last-child` and its kin see them; list containers stay template-free.
- The text rule speaks in tsc's wording, not curated copy.
- Deeper nesting makes the uniqueness proof refuse more often. The fix is cheap (a class), but authors meet it.
- `.map`'s second parameter is an index or a key depending on the receiver.
- Le Truc depends on a Cause & Effect minor that adds `map` and `forEach`.
- A seeded list whose item type is imported must list every field in `harvest()`.

## Related

- Requirements: [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects), [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass), [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking)
- Architecture: [List Reconciliation](../ARCHITECTURE.md#list-reconciliation)
- Amends: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s5, [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s2, [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) s5
- Related: [ADR 0047](0047-harvest-through-a-key-alias-witnessed-by-the-render.md) (s7 through a key alias), [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) (`reconcile()` unchanged), [ADR 0014](0014-keyed-per-element-scopes-for-memo-collections.md) (scope ownership), [ADR 0045](0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md) (the proof), [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (harvest)
