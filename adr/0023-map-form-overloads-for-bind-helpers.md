# ADR 0023: Map-Form Overloads for `bindStyle`/`bindAttribute`/`bindClass`/`bindProperty`/`bindState`

## Status

✅ Accepted

## Context

`bindStyle`, `bindAttribute`, `bindClass`, `bindProperty`, and `bindState` (`src/bindings.ts`) each hard-code a single target: `bindStyle(el, prop)` sets one CSS property, `bindAttribute(el, name)` one attribute, `bindClass(el, token)` one class token, `bindProperty(obj, key)` one object property, `bindState(internals, token)` one `ElementInternals` custom state. A component whose one computed value drives several of these at once currently has to choose between N independent `watch()` calls sharing the same underlying computed source (awkward, and loses the "one update, several DOM writes" atomicity) or an arbitrary callback body that none of the `bind*` helpers support.

Confirmed against real usage in `examples/`:

- **`examples/basic/gauge/basic-gauge.ts`** — the `value` watch sets both `meter.value` and `host.style` `--basic-gauge-degree` from one value; the threshold-lookup watch sets `labelEl.textContent` and `host.style` `--basic-gauge-color` from one qualification lookup. Both bypass `bindStyle` today and call `host.style.setProperty` directly inside the watch body, precisely because `bindStyle` cannot target two properties from one handler.
- **`examples/form/colorgraph/form-colorgraph.ts`** — `setStepPosition()` sets four style properties (`background-color`, `border-color`, `left`, `top`) from one `Oklch` color, called per swatch step in a loop; the knob-position watch sets `top`, `left`, `--color-border` from one computed `{ l, c, size }`; the thumb-position watch sets `left`, `--color-border` from one computed `{ hue, l, tw }`. All three hand-roll `element.style.setProperty()` calls inside the watch body for the same reason.
- **`examples/module/todo/module-todo.ts`** — two separate `watch()` calls each re-derive a boolean from the same `filter.value` read (`(filter.value || 'all') === 'active'` and `=== 'completed'`) to drive `bindState(internals, 'filter-active')` and `bindState(internals, 'filter-completed')` independently. One source, two states — the same shape as the `bindStyle`/`bindClass` cases above, just for custom states instead of styles/classes.

(`examples/module/scrollarea/module-scrollarea.ts` also calls `bindState` three times, but each call is driven by a genuinely independent signal — `hasOverflow`, `overflowStart`, `overflowEnd` are not derived from one shared source — so it is not a map-form candidate; included here for completeness, not as a counter-example.)

Both `basic-gauge` and `form-colorgraph` would switch to the map-form `bindStyle` once available, replacing their hand-rolled `style.setProperty()` sequences with a single `watch(source, bindStyle(el, [...]))` call and regaining `nil`-driven cleanup. `module-todo` would switch to the map-form `bindState`, collapsing its two `watch()` calls into one.

This was first raised scoped to `bindStyle` alone while investigating a related gauge-component question (tracked as LT-028), then broadened once `bindClass`/`bindAttribute`/`bindProperty` were recognized to have the identical single-target shape. `bindState` was identified in API review as having the same shape but was missed in the initial implementation (LT-029); it is folded into this ADR rather than tracked separately, and the design below extends uniformly to all five helpers. It surfaced independently again during work on a separate, unpublished server-component compiler branch, whose generated code has the same one-computed-many-targets shape (see Consequences) — that branch is not a dependency of this decision and this ADR does not describe or rely on it.

Related: [REQUIREMENTS.md M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects) (the `bind*` helper set).

## Decision

Add a second overload to each of the five helpers, keyed on the target parameter being a `readonly string[]` instead of a bare `string`. The existing single-target signature is untouched — purely additive, non-breaking:

```ts
bindStyle<P extends string>(element, props: readonly P[]): SingleMatchHandlers<Partial<Record<P, string | null>>>
bindAttribute<N extends string>(element, names: readonly N[], allowUnsafe?): SingleMatchHandlers<Partial<Record<N, string | boolean>>>
bindClass<Tk extends string>(element, tokens: readonly Tk[]): (value: Partial<Record<Tk, boolean>>) => void
bindProperty<O, K extends keyof O & string>(object, keys: readonly K[]): (value: Partial<Pick<O, K>>) => void
bindState<Tk extends string>(internals: ElementInternals | null, tokens: readonly Tk[]): (value: Partial<Record<Tk, boolean>>) => void
```

The key design constraint that resolves what would otherwise be an open question — whether `nil`/an absent key should clear all previously-set targets or only currently-absent ones — is that the array of keys is declared statically at the call site, not accumulated dynamically. There is no "previously set" history to track; the array itself is always the complete key set for that binding:

- **`bindStyle`/`bindAttribute`** (map form; "unset" is a real DOM operation): `ok(map)` — for every key in the declared array, present → `setProperty`/`setAttribute` (or `toggleAttribute`); absent or `null`/`undefined` → `removeProperty`/`removeAttribute`. `nil()` — removes every declared key.
- **`bindClass`/`bindState`** (map form): `ok(map)` — for every declared token, `classList.toggle(token, Boolean(map[token]))` (`bindClass`) or `internals.states.add(token)`/`.delete(token)` per `Boolean(map[token])` (`bindState`) — same coercion the single-target form already uses (absent = falsy = off). No separate `nil` handler is needed — an empty map already clears everything via the same toggle loop. `bindState`'s existing `internals === null` no-op degradation is preserved unchanged in the map form.
- **`bindProperty`** (map form): different in kind — arbitrary object properties have no "remove" operation, so this is a partial patch, not a clear/set pair. `ok(map)` assigns only the keys present in `map`, skipping absent ones. Stays a plain setter (no `SingleMatchHandlers`), consistent with the single-key form today.

## Alternatives Considered

- **N independent `watch()` calls per target, sharing one computed source** — the status quo. Rejected as the default recommendation: loses "one update, several DOM writes" atomicity (a consumer watching `--basic-gauge-color` mid-update could observe it out of sync with `--basic-gauge-degree`), and duplicates the same derivation N times.
- **An arbitrary-callback `bind*` variant** (`bindStyle(el, (value) => { ... })`) — rejected. Reintroduces the imperative-callback shape `bind*` exists to avoid; loses the declarative "here are the exact keys this binding owns" contract that both the map form and `SingleMatchHandlers`' `nil` cleanup depend on.
- **`nil`/absent-key clears only currently-absent keys, tracked dynamically across calls** — rejected once the array was recognized as statically declared at the call site rather than accumulated. Tracking "previously set" state would be extra bookkeeping for a case that can't occur.
- **Scoping the change to `bindStyle` only** (as originally raised) — rejected after discussion surfaced that `bindClass`/`bindAttribute`/`bindProperty`/`bindState` have the identical single-target shape and the identical multi-target use case; doing some and not others would leave an inconsistent API.
- **Tracking `bindState` as a separate follow-up ADR instead of folding it into this one** — rejected: it is the same decision (same overload shape, same static-array rationale, same `bindClass`-style toggle-loop semantics) applied to a fifth helper that was simply missed during LT-029's implementation, not a distinct design question.

## Consequences

- Additive to all five helpers' public signatures — no migration required for existing single-target call sites; overload resolution picks the array form only when the target argument is an array.
- `examples/basic/gauge/basic-gauge.ts` and `examples/form/colorgraph/form-colorgraph.ts` can each replace their hand-rolled `style.setProperty()` sequences with a single `watch(source, bindStyle(el, [...]))` call once this lands; `examples/module/todo/module-todo.ts` can collapse its two `filter-active`/`filter-completed` `watch()` calls into one `bindState(internals, [...])` call. Not required by this ADR — tracked as follow-up cleanup opportunities (see TODO.md), not dependencies.
- A separate, unpublished server-component compiler branch (docs/server-components) independently arrived at the same need for its generated `class={{ }}` lowering (today: N separate `watch()` + `bindClass(el, key)` calls per class map) and could collapse that generated code to one `watch()` call using the new `bindClass` map form. That branch is not referenced further here and this decision does not depend on it landing, in any order.
- New unit tests required per helper's map form: multiple targets set in one `ok`, an absent/`null` key cleared individually (style/attribute), `nil` clearing every declared style/attribute key, `bindClass`/`bindState`'s all-declared-tokens toggle, `bindProperty`'s partial-patch skip-absent behavior, `bindState`'s `internals === null` no-op preserved in the map form.
- No bundle-size concern: the array-form overload adds a runtime branch inside each existing helper, not new exports; tree-shaking behavior (M14) is unaffected. Confirmed for the four already-implemented helpers (LT-029): minimal bundle 8347B gzipped, well under the 9216B ceiling (`test/regression-bundle.test.ts`).

## Related

- Requirements: [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects)
- Architecture: [DOM Binding Helpers](../ARCHITECTURE.md#dom-binding-helpers)
