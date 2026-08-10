# ADR 0019: Extension-Based Dependency Injection for `defineComponent()`

## Status

✅ Accepted

## Context

[ADR 0016](0016-element-internals-for-form-association-and-states.md) added `formAssociated: true` as a `ComponentOptions` flag, `defineComponent`'s third parameter. Because `component.ts`'s core class body branched on that boolean directly, it had to statically import `installFormAssociatedMembers` / `MANAGED_FORM_MEMBERS` from `helpers/form.ts` (as it was located at the time) unconditionally — no bundler can prove that import unreachable, so **every** consumer paid for ElementInternals support (~1.2 kB gzipped) whether they used it or not.

Two more features want the same third-parameter slot:

- **Attribute-driven reactivity** ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) explicitly reserved this: "it can be added as an optional third parameter to `defineComponent` in a future release." [REQUIREMENTS.md X1](../REQUIREMENTS.md#x1-observedattributes--attributechangedcallback-for-reactive-state) names interop with frameworks that set DOM attributes rather than properties — chiefly React — as the motivating case.)
- **Per-instance debug instrumentation** ([REQUIREMENTS.md N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance), nice-to-have, not implemented by this ADR — the mechanism only needs to accommodate it later).

A single boolean flag doesn't generalize to multiple independent, tree-shakable features. This ADR replaces it with a dependency-injection array.

## Decision

`defineComponent`'s third parameter becomes `extensions?: readonly ComponentExtension[]`, replacing `ComponentOptions`. `ComponentExtension` (`src/extension.ts`) is a plain data/function bundle:

```ts
type ComponentExtension = {
	name: string
	staticProps?: Record<string, unknown>
	observedAttributes?: readonly string[]
	reservedMembers?: ReadonlySet<string>
	installOnPrototype?: (proto: HTMLElement) => void
	onConnect?: (instance, internals) => FactoryResult | Falsy | void
	onAttributeChanged?: (instance, name, oldValue, newValue) => void
}
```

`component.ts` only ever references this generic shape at the value level — never a concrete feature module. The one place a feature-specific type crosses into `component.ts` is `import type { FormAssociatedExtension, FormAssociatedCheckboxExtension } from './extensions/form'`, type-only imports that erase at compile time and add no runtime import. A consumer who never calls `formAssociated()` or `formAssociatedCheckbox()` never causes their bundler to reach `extensions/form.ts` at all.

`formAssociated()` (`src/extensions/form.ts`), `formAssociatedCheckbox()` (also `src/extensions/form.ts`, added after this ADR first shipped — see below), and `observedAttributes()` (`src/extensions/attributes.ts`) are the extensions shipped by this ADR, assembled from the existing form-association logic (ADR 0016) and a new post-connect attribute-to-property re-parse (reusing the retained-`Parser` mechanism ADR 0016 introduced for `formResetCallback`, generalized below). Bundled extensions live in a dedicated `src/extensions/` directory, separate from `src/helpers/` (which holds core-adjacent utilities like `dom.ts`/`events.ts`/`context.ts` that `component.ts` *does* import at the value level) — the directory boundary makes "never imported by core" a structural property of the codebase, not just a convention to remember. Bundled extensions are the intended norm — a "standard library" shipped with and tree-shaken from the library itself; user-authored extensions are supported by the same public type but are the exception.

**`formAssociatedCheckbox()`: the checkbox-shaped variant.** `formAssociated()`'s managed convention is keyed on a single reactive `value: string | number` prop, synced unconditionally via `internals.setFormValue(String(value))`. That doesn't fit checkbox-shaped controls (`form-checkbox`, and any future switch/toggle — a switch is not a distinct native form control, just a styled checkbox): their primary state is `checked: boolean`, and native checkboxes submit *nothing* when unchecked, unlike the always-on value-style sync. `<input type="radio">` and `<option selected>` don't need a third variant — a radio group's or listbox's selection already aggregates into one string `value` on the *container* (`form-radiogroup`, `form-listbox`), which is exactly `formAssociated()`'s existing shape; the boolean state belongs to the group, not a lone control.

`formAssociatedCheckbox()` shares everything shape-agnostic with `formAssociated()` — the host contract (`form`, `name`, `labels`, `validity`, ...), `resolveAnchor`, `managedSetCustomValidity`, `createManagedDisabledProperty`, `formDisabledCallback` — and only differs in the value-sync/reset/state-restore triad:

- **Sync**: `internals.setFormValue(checked ? submitValue : null)`, where `submitValue` is read once from the host's own `value` attribute at connect (`?? 'on'`, matching native `<input type="checkbox">`) — deliberately *not* a reactive `expose()`'d prop, since native checkbox `.value` is a static identifier, not the commit signal.
- **Reset**: the same retained-initializer mechanism as `formAssociated()`, now generalized into a `prop`-parameterized `makeResetCallback(prop)` shared by both (`'value'` for `formAssociated()`, `'checked'` for `formAssociatedCheckbox()`) rather than duplicated.
- **State restore**: `checked = typeof state === 'string'` — the browser restores whatever `setFormValue` submitted, so a string means it was checked, `null` means it wasn't.

Both extensions declare the same `staticProps: { formAssociated: true }` (the static class flag the browser needs regardless of which prop drives it), so combining `formAssociated()` and `formAssociatedCheckbox()` on one component throws `ExtensionCollisionError` in DEV_MODE via the existing collision check below — no new guard needed. Verified tree-shaking independence empirically: `test/fixtures/core-checkbox-entry.ts` (checkbox-only) measures close to `core-form-entry.ts` (value-only), not their sum, confirming co-location in one file doesn't defeat per-export shaking (see Bundle-size verification).

A styled checkbox must not reflect its live `checked` state onto its own `checked` *attribute* for CSS hooks (e.g. `host.toggleAttribute('checked', checked)`) — that attribute is what `formResetCallback` re-parses as the default, so reflecting the live state onto it corrupts the reset target (confirmed as a real bug while migrating `form-checkbox`: after checking and calling `form.reset()`, the "restored" value was whatever the checkbox currently was, not its original default). Native `:checked` never applies to the custom element itself, only to the descendant `<input>` directly — so the fix needs no JS reflection at all: `.checkbox:has(input:checked)` (and similarly `.todo`, `.toggle`) reads the real native input's state straight from CSS. (A `:state(checked)` + `bindState(internals, 'checked')` custom-state hook, per ADR 0016 §8, was tried first and works too, but is strictly more machinery than necessary here — it's the right tool when no literal native descendant carries the state, not when one already does.)

**Collision policy.** Only `staticProps` keys can collide (`reservedMembers` and `observedAttributes` are unions across extensions, never conflicts). In DEV_MODE, a repeated key throws `ExtensionCollisionError`; in production, the first extension to declare a key wins and later ones are silently ignored.

**Ordering.** Extensions run in array order for every hook (`installOnPrototype`, `onConnect`, `onAttributeChanged`).

**Typing.** `defineComponent` keeps overloads (as before ADR 0016 shipped), now keyed on the extensions array shape instead of an options flag — a third overload for `formAssociatedCheckbox()` was added alongside the original two once that extension shipped:

```ts
function defineComponent<P extends ComponentProps & { value: string | number }>(
	name: string,
	factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void,
	extensions: readonly [FormAssociatedExtension, ...ComponentExtension[]],
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps & { checked: boolean }>(
	name: string,
	factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void,
	extensions: readonly [FormAssociatedCheckboxExtension, ...ComponentExtension[]],
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
	extensions?: readonly ComponentExtension[],
): CustomElementConstructor | undefined
```

`FormFactoryContext<P>` itself is generic over `P` — the `value`/`checked` shape constraint lives only in the overload signatures, not in the context type — so the checkbox overload needed no new context type, just a new brand tag and a matching `P` bound.

A single generic function with a `const`-modified type parameter over the extensions array (inferring `FormFactoryContext` vs. `FactoryContext` via `Extract<Exts[number], FormAssociatedTag>`) was tried and rejected: TypeScript's partial-explicit-type-argument inference falls back to a type parameter's default rather than inferring it from the corresponding call argument whenever an earlier type parameter is given explicitly — confirmed empirically against this codebase's established convention of always annotating `P` (`defineComponent<Props>(...)`). The overload form sidesteps this because each overload has only one type parameter. **Consequence:** `formAssociated()`/`formAssociatedCheckbox()`, when used, must be the first element of the `extensions` array — that is what selects the widened `FormFactoryContext` overload. This is a real, order-dependent constraint, not a cosmetic one.

**Generalized retained initializers.** `internal.ts`'s `initialValueInitializers` (a `WeakMap<HTMLElement, unknown>` holding one retained initializer for `'value'` only, added by ADR 0016 for `formResetCallback`) becomes `retainedInitializers: WeakMap<HTMLElement, Record<string, unknown>>`, populated unconditionally in `#initSignals` for every exposed prop — not gated by which extension is active. This keeps `component.ts` generic: extensions read back only the keys they care about (`formAssociated()`'s `formResetCallback`/`formStateRestoreCallback` read `'value'`; `observedAttributes()` reads whichever prop name matches the mutated attribute).

[REQUIREMENTS.md §4](../REQUIREMENTS.md#4-non-functional-requirements) and the library-itself success metric are updated to describe this three-tier contract in place of the single 9/10 kB ceiling.

## Alternatives Considered

- **Separate factory function per feature** (e.g. `defineFormAssociatedComponent()` alongside `defineComponent()`). Achieves the same tree-shaking property (separate module/export boundary), but doesn't compose — a future component needing two independent extensions together would need a combinatorial function per combination, and adds a new public name per feature instead of one general mechanism.
- **Single generic `defineComponent` with a `const` type parameter and conditional context type.** Rejected per the Typing section above — breaks under this codebase's explicit-`P`-annotation convention.
- **Keep `ComponentOptions` boolean flags, add one per feature** (`formAssociated`, `observedAttrs`, ...). Rejected — each new flag would require `component.ts` to unconditionally import that feature's module, permanently defeating tree-shaking for every flag added, which is the exact problem this ADR fixes.
- **Parameterize `formAssociated()` for the checkbox-shaped case** (e.g. `formAssociated({ checked: true })`) instead of a sibling `formAssociatedCheckbox()`. Rejected — it would need its own type-level branch surfacing through `formAssociated()`'s return type depending on its argument, which then needs a *third* `defineComponent` overload anyway to catch that branch, at the same typing cost as a sibling function but with one extension now doing two conceptually different jobs. A sibling extension keeps each extension single-purpose, matching every other extension in this ADR.

## Consequences

**Good:**
- `formAssociated()` (and any future bundled extension) is tree-shaken away for consumers who don't use it — verified via the bundle test, not just asserted. `formAssociatedCheckbox()` proved this holds even for two extensions co-located in the same file.
- Generalizes past a single boolean to an arbitrary, composable set of features without further `defineComponent` signature churn.
- `retainedInitializers` generalization is reusable by any future extension needing "re-apply the original prop initializer later," not just the ones shipped here; `makeResetCallback(prop)` generalized the same way once a second consumer (`formAssociatedCheckbox()`) needed it.

**Bad:**
- Breaking API change for existing `{ formAssociated: true }` usage (migrated to `[formAssociated()]` across all examples and tests in this branch) — acceptable since ElementInternals support shipped only in `2.3.0-beta.1`, not a stable release.
- `formAssociated()`/`formAssociatedCheckbox()` must lead the `extensions` array for its context-widening overload to apply; this is an easy-to-miss constraint not enforced by any runtime check (only by which overload TypeScript happens to select).
- Collision detection is scoped to `staticProps` keys only — it does not detect two extensions' `installOnPrototype` clobbering the same prototype property, since that would require inspecting opaque callback bodies. This is a real, if narrow, gap: nothing but the (incidental) `staticProps.formAssociated` collision stops an author from combining `formAssociated()` and `formAssociatedCheckbox()` on one component, which would silently pick whichever is later in the array for reset/state-restore behavior in production.
- A component reflecting its own reactive state onto the same attribute a `formResetCallback` reparses as the default corrupts the reset target (discovered while migrating `form-checkbox`: reflecting live `checked` onto the `checked` attribute made reset "restore" to whatever the checkbox currently was). Not a flaw in the mechanism itself, but a footgun worth documenting: never reflect form-managed reactive state onto the attribute of the same name. Prefer reading a real native descendant's own state directly in CSS (`:has(input:checked)`) where one exists; fall back to `bindState(internals, ...)` custom states otherwise.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [X1](../REQUIREMENTS.md#x1-observedattributes--attributechangedcallback-for-reactive-state), [N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance), [§4](../REQUIREMENTS.md#4-non-functional-requirements)
- Amends: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (the "future third parameter" it anticipated), [ADR 0016](0016-element-internals-for-form-association-and-states.md) (`formAssociated` moves from a `ComponentOptions` flag to an extension)
- Supersedes: None
