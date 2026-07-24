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

`component.ts` only ever references this generic shape at the value level — never a concrete feature module. The one place a feature-specific type crosses into `component.ts` is `import type { FormAssociatedExtension } from './extensions/form'`, a type-only import that erases at compile time and adds no runtime import. A consumer who never calls `formAssociated()` never causes their bundler to reach `extensions/form.ts` at all.

`formAssociated()` (`src/extensions/form.ts`) and `observedAttributes()` (new: `src/extensions/attributes.ts`) are the two extensions shipped by this ADR, assembled from the existing form-association logic (ADR 0016) and a new post-connect attribute-to-property re-parse (reusing the retained-`Parser` mechanism ADR 0016 introduced for `formResetCallback`, generalized below). Bundled extensions live in a dedicated `src/extensions/` directory, separate from `src/helpers/` (which holds core-adjacent utilities like `dom.ts`/`events.ts`/`context.ts` that `component.ts` *does* import at the value level) — the directory boundary makes "never imported by core" a structural property of the codebase, not just a convention to remember. Bundled extensions are the intended norm — a "standard library" shipped with and tree-shaken from the library itself; user-authored extensions are supported by the same public type but are the exception.

**Collision policy.** Only `staticProps` keys can collide (`reservedMembers` and `observedAttributes` are unions across extensions, never conflicts). In DEV_MODE, a repeated key throws `ExtensionCollisionError`; in production, the first extension to declare a key wins and later ones are silently ignored.

**Ordering.** Extensions run in array order for every hook (`installOnPrototype`, `onConnect`, `onAttributeChanged`).

**Typing.** `defineComponent` keeps two overloads (as before ADR 0016 shipped), now keyed on the extensions array shape instead of an options flag:

```ts
function defineComponent<P extends ComponentProps & { value: string | number }>(
	name: string,
	factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void,
	extensions: readonly [FormAssociatedExtension, ...ComponentExtension[]],
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
	extensions?: readonly ComponentExtension[],
): CustomElementConstructor | undefined
```

A single generic function with a `const`-modified type parameter over the extensions array (inferring `FormFactoryContext` vs. `FactoryContext` via `Extract<Exts[number], FormAssociatedTag>`) was tried and rejected: TypeScript's partial-explicit-type-argument inference falls back to a type parameter's default rather than inferring it from the corresponding call argument whenever an earlier type parameter is given explicitly — confirmed empirically against this codebase's established convention of always annotating `P` (`defineComponent<Props>(...)`). The two-overload form sidesteps this because each overload has only one type parameter. **Consequence:** `formAssociated()`, when used, must be the first element of the `extensions` array — that is what selects the widened `FormFactoryContext` overload. This is a real, order-dependent constraint, not a cosmetic one.

**Generalized retained initializers.** `internal.ts`'s `initialValueInitializers` (a `WeakMap<HTMLElement, unknown>` holding one retained initializer for `'value'` only, added by ADR 0016 for `formResetCallback`) becomes `retainedInitializers: WeakMap<HTMLElement, Record<string, unknown>>`, populated unconditionally in `#initSignals` for every exposed prop — not gated by which extension is active. This keeps `component.ts` generic: extensions read back only the keys they care about (`formAssociated()`'s `formResetCallback`/`formStateRestoreCallback` read `'value'`; `observedAttributes()` reads whichever prop name matches the mutated attribute).

**Bundle-size verification.** `test/regression-bundle.test.ts` is restructured into three tiers, reflecting that the full barrel is no longer a realistic consumer surface once extensions are opt-in:

- `test/fixtures/minimal-entry.ts` (`defineComponent`, no extensions) — hard-asserted ≤8 kB gzipped. Measured: 7.3 kB.
- `test/fixtures/core-form-entry.ts` (`defineComponent` + `formAssociated()`) — warns (not fails) above 14 kB. Measured: 8.1 kB.
- The full `index.ts` barrel (every export, including every bundled extension) — reported only, not asserted. Measured: 14.65 kB.

[REQUIREMENTS.md §4](../REQUIREMENTS.md#4-non-functional-requirements) and the library-itself success metric are updated to describe this three-tier contract in place of the single 10/14 kB ceiling.

## Alternatives Considered

- **Separate factory function per feature** (e.g. `defineFormAssociatedComponent()` alongside `defineComponent()`). Achieves the same tree-shaking property (separate module/export boundary), but doesn't compose — a future component needing two independent extensions together would need a combinatorial function per combination, and adds a new public name per feature instead of one general mechanism.
- **Single generic `defineComponent` with a `const` type parameter and conditional context type.** Rejected per the Typing section above — breaks under this codebase's explicit-`P`-annotation convention.
- **Keep `ComponentOptions` boolean flags, add one per feature** (`formAssociated`, `observedAttrs`, ...). Rejected — each new flag would require `component.ts` to unconditionally import that feature's module, permanently defeating tree-shaking for every flag added, which is the exact problem this ADR fixes.

## Consequences

**Good:**
- `formAssociated()` (and any future bundled extension) is tree-shaken away for consumers who don't use it — verified via the three-tier bundle test, not just asserted.
- Generalizes past a single boolean to an arbitrary, composable set of features without further `defineComponent` signature churn.
- `retainedInitializers` generalization is reusable by any future extension needing "re-apply the original prop initializer later," not just the two shipped here.

**Bad:**
- Breaking API change for existing `{ formAssociated: true }` usage (migrated to `[formAssociated()]` across all examples and tests in this branch) — acceptable since ElementInternals support shipped only in `2.3.0-beta.1`, not a stable release.
- `formAssociated()` must lead the `extensions` array for its context-widening overload to apply; this is an easy-to-miss constraint not enforced by any runtime check (only by which overload TypeScript happens to select).
- Collision detection is scoped to `staticProps` keys only — it does not detect two extensions' `installOnPrototype` clobbering the same prototype property, since that would require inspecting opaque callback bodies.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [X1](../REQUIREMENTS.md#x1-observedattributes--attributechangedcallback-for-reactive-state), [N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance), [§4](../REQUIREMENTS.md#4-non-functional-requirements)
- Amends: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (the "future third parameter" it anticipated), [ADR 0016](0016-element-internals-for-form-association-and-states.md) (`formAssociated` moves from a `ComponentOptions` flag to an extension)
- Supersedes: None
