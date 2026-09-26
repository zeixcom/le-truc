# ADR 0019: Extension-Based Dependency Injection for `defineComponent()`

## Status

✅ Accepted

## Context

[ADR 0016](0016-element-internals-for-form-association-and-states.md) added `formAssociated: true` as a `ComponentOptions` flag, `defineComponent`'s third parameter. Because the core class body branched on that boolean, `component.ts` had to import the form-association module unconditionally — no bundler can prove that import unreachable, so **every** consumer paid for ElementInternals support (about 1.2 kB gzipped) whether they used it or not.

Two more features want the same slot:

- **Attribute-driven reactivity**: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) reserved it as "an optional third parameter to `defineComponent` in a future release." [REQUIREMENTS.md X1](../REQUIREMENTS.md#x1-observedattributes--attributechangedcallback-for-reactive-state) names interop with frameworks that set DOM attributes rather than properties (chiefly React) as the motivating case.
- **Per-instance debug instrumentation** ([REQUIREMENTS.md N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance)): not implemented here; the mechanism only has to accommodate it later.

A single boolean flag does not generalize to several independent, tree-shakable features.

## Decision

`defineComponent`'s third parameter becomes `extensions?: readonly ComponentExtension[]`, replacing `ComponentOptions`. A `ComponentExtension` is a plain data-and-function bundle: a `name`, optional `staticProps`, `observedAttributes`, `reservedMembers`, and the hooks `installOnPrototype`, `onConnect` and `onAttributeChanged`. The shape and its JSDoc live in `src/extension.ts`.

**Core never imports a feature.** `component.ts` references only the generic `ComponentExtension` shape at the value level. Feature-specific types cross into it only as type-only imports, which erase at compile time. A consumer who never calls a feature's extension function never makes the bundler reach that feature's module.

**Bundled extensions are the norm.** The shipped extensions are `formAssociated()` and `formAssociatedCheckbox()` (`src/extensions/form.ts`, from ADR 0016's form-association logic) and `observedAttributes()` (`src/extensions/attributes.ts`, a post-connect attribute-to-property re-parse). They live in `src/extensions/`, separate from `src/helpers/` (which core does import), so "never imported by core" is a structural property of the codebase, not a convention to remember. They form a standard library shipped with and tree-shaken from the library itself. User-authored extensions use the same public type but are the exception.

**`formAssociatedCheckbox()` is a sibling, not a parameter.** `formAssociated()` is keyed on a reactive `value: string | number`, synced on every change. Checkbox-shaped controls (checkboxes, switches, toggles; a switch is only a styled checkbox) are keyed on `checked: boolean` and, like native checkboxes, submit nothing when unchecked. `formAssociatedCheckbox()` shares the whole shape-agnostic host contract with `formAssociated()` and differs only in value sync, reset and state restore:

- **Sync**: submits the host's `value` attribute, read once at connect (default `'on'`, as native), when checked, and nothing when unchecked. The submit value is a static identifier, not a reactive prop.
- **Reset**: the same retained-initializer mechanism, keyed on `checked` instead of `value`.
- **State restore**: a restored string means checked; `null` means unchecked.

Radio groups and listboxes need no third variant. Their selection aggregates into one string `value` on the container, which is exactly `formAssociated()`'s shape.

Both form extensions declare `staticProps: { formAssociated: true }`, so combining them on one component throws `ExtensionCollisionError` in DEV_MODE through the ordinary collision check. No separate guard exists.

**Collision policy.** Only `staticProps` keys can collide; `reservedMembers` and `observedAttributes` are unions across extensions. In DEV_MODE a repeated key throws `ExtensionCollisionError`; in production the first extension to declare a key wins and later ones are ignored.

**Ordering.** Extensions run in array order for every hook.

**Typing: overloads keyed on the leading extension.** `defineComponent` keeps one overload per form extension plus a general one. A leading `FormAssociatedExtension` selects a factory typed with `FormFactoryContext<P>` where `P` carries `value: string | number`. A leading `FormAssociatedCheckboxExtension` selects the same context where `P` carries `checked: boolean`. Any other array selects `FactoryContext<P>`. The signatures live in `src/component.ts`. **Consequence:** a form extension must be the first element of the `extensions` array, because that is what selects the widened context. This is a real, order-dependent constraint.

**Retained initializers are generic.** Every exposed prop's original initializer is retained per instance, whichever extensions are active, so core stays feature-agnostic. Extensions read back only the keys they need: the form extensions for reset and state restore, `observedAttributes()` for the prop matching a mutated attribute.

[REQUIREMENTS.md §4](../REQUIREMENTS.md#4-non-functional-requirements) states the bundle-size budget in terms of this contract: a minimal consumer without extensions, and opt-in extensions tree-shaken away when unused.

## Alternatives Considered

- **Separate factory function per feature** (e.g. `defineFormAssociatedComponent()`): tree-shakes just as well, but does not compose. Two extensions together would need a function per combination, and every feature adds a public name instead of using one mechanism.
- **Single generic `defineComponent` with a `const` type parameter and a conditional context type**: breaks under the codebase's convention of always annotating `P` (`defineComponent<Props>(...)`). When an earlier type parameter is given explicitly, TypeScript falls back to a later parameter's default instead of inferring it from the argument. Each overload has only one type parameter, so the overload form avoids this.
- **Keep `ComponentOptions`, add one boolean per feature**: every flag would force `component.ts` to import that feature unconditionally, permanently defeating tree-shaking, which is the exact problem this ADR fixes.
- **Parameterize `formAssociated()` for the checkbox case** (e.g. `formAssociated({ checked: true })`): its return type would have to branch on its argument, which still needs a third overload to catch, at the same typing cost as a sibling function, and one extension would do two different jobs. A sibling keeps every extension single-purpose.

## Consequences

**Good:**

- Form association and every future bundled extension are tree-shaken away for consumers who do not use them, and this holds for two extensions co-located in one module.
- The set of features grows without further `defineComponent` signature churn.
- Retained initializers and the prop-parameterized reset serve any future extension that needs to re-apply an original initializer later.

**Bad / accepted tradeoffs:**

- Breaking change for `{ formAssociated: true }` usage, which becomes `[formAssociated()]`. Accepted because ElementInternals support had shipped only in a beta, not a stable release.
- A form extension must lead the `extensions` array for its context-widening overload to apply. No runtime check enforces this; only TypeScript's overload selection does.
- Collision detection covers `staticProps` keys only. It cannot see two `installOnPrototype` hooks clobbering the same prototype member, since that would mean inspecting opaque callbacks. Only the shared `staticProps.formAssociated` key stops `formAssociated()` and `formAssociatedCheckbox()` from being combined; in production the combination silently takes the later extension's reset and state-restore behavior.
- The reset target is an attribute, so a component that reflects its own live form state onto that attribute (for example live `checked` onto the `checked` attribute, for CSS hooks) makes a form reset restore the current state instead of the default. The mechanism cannot prevent this; authors must never reflect form-managed state onto the attribute of the same name.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [X1](../REQUIREMENTS.md#x1-observedattributes--attributechangedcallback-for-reactive-state), [N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance), [§4](../REQUIREMENTS.md#4-non-functional-requirements)
- Amends: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (the future third parameter it anticipated), [ADR 0016](0016-element-internals-for-form-association-and-states.md) (`formAssociated` moves from a `ComponentOptions` flag to an extension)
- Supersedes: None
