# ADR 0016: ElementInternals for Form Association and Custom States

## Status

✅ Accepted

## Context

Le Truc components cannot take part in HTML forms as first-class controls. Workarounds are a hand-synced hidden `<input>` (whose `form.reset()` never reaches the component's state), one value split across several named inputs, and a hand-rolled validity relay (`checkValidity()` → a component-owned error property → `aria-invalid` / `aria-errormessage`).

ElementInternals, baseline across evergreen browsers, is the platform API for form association, Constraint Validation, custom `:state()` pseudo-classes and ARIA reflection. Form association cuts both ways. The component must feed value and validity into the form and react to its lifecycle (reset, disable, state restore). And to outside code, a form-associated custom element (FACE) should behave like a native control, which FACE does not give for free: the host has no `checkValidity()`, `validity`, `form`, `labels` and so on unless the class defines them. Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 Accessibility ("must not make it harder to achieve"), §4 Browser support.

## Decision

Support form association via the `formAssociated()` extension in `defineComponent`'s third `extensions` parameter ([ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md)), with a **managed form-control convention**: the component exposes a reactive `value`, and the library owns everything mechanical — form value sync, the form lifecycle callbacks, and a native-parity host contract. `ElementInternals` is exposed on the `FactoryContext` as the escape hatch. **No `onForm*()` lifecycle helpers and no reactive abstraction layer**: a typical form component writes zero ElementInternals code. Implementation: `src/extensions/form.ts`; usage: `docs-src/pages/extensions.md`.

### 1. `attachInternals()` in the constructor

Every `Truc` instance attaches internals unconditionally in the constructor, the only callback that runs exactly once (`attachInternals()` may be called once per element). If attaching fails, the component degrades gracefully: `internals` is `null` and a `DEV_MODE` warning fires on first access.

### 2. The `formAssociated()` extension

Passing `[formAssociated()]` sets `static formAssociated = true` on the generated class and enables the managed behavior below. It is opt-in and tree-shaken: a consumer who never calls `formAssociated()` never bundles this code (amended by ADR 0019, replacing a flat `options.formAssociated` flag).

### 3. Managed form-control convention

A form-associated component mirrors native form controls:

- **It exposes a reactive `value`** (a string, or coerced with `String()`); a `DEV_MODE` warning fires if it does not.
- **The `value` attribute is the default value**, like native `defaultValue`; components must not reflect the current value back into it.
- **The `name` attribute identifies the control on submission**, read natively by the browser.

In exchange the library syncs `value` to the form through an effect in the same deferred-activation pipeline as author effects ([ADR 0007](0007-effect-descriptors-with-deferred-activation.md)); restores `value` on form reset by re-running its initializer (re-parsing the `value` attribute for a Parser, native `defaultValue` semantics); assigns a restored string state to `value` (non-string states are not managed); and drives the managed `disabled` property (§4) from `formDisabledCallback`.

**Managed member names are reserved.** On a form-associated component, `expose()` throws `InvalidPropertyNameError` for any managed member name (`form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity`, `reportValidity`, `setCustomValidity`, `disabled`), instead of the `prop in this` guard silently skipping it. `value` is the deliberate exception. Other components may expose these names freely.

### 4. Managed `disabled` property

Form-associated hosts get a reactive `disabled: boolean` that reflects to the `disabled` attribute, so the browser natively bars the element from validation and submission and matches `:disabled` / `:enabled`. Because `formDisabledCallback` also fires for an ancestor `<fieldset disabled>`, `host.disabled` and `watch('disabled', …)` report the effective state even when the element's own attribute is untouched. Authors propagate it inward where needed (`watch('disabled', bindProperty(input, 'disabled'))`).

### 5. Native-parity host contract

The host gets the standard form-control members, delegating to `internals`: `form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, and `setCustomValidity(message)`, which touches only `customError` and preserves flags set elsewhere (amended by [ADR 0020](0020-merge-based-validity-composition-and-relayvalidity.md)). **Validation anchor**: the managed anchor is the first focusable form-control descendant, falling back to the host. Components needing another anchor, or typed flags like `rangeOverflow`, call `internals.setValidity(flags, message, anchor)` directly.

The `host.error` property convention is retired: consumers read `host.validationMessage` / `host.validity` as on a native input. **Change events stay the author's job**, with native timing: dispatch `change`/`input` at user-commit points; programmatic sets fire no events. The library cannot know what a user commit is for a given widget.

### 6. Type surface

An exported **`FormAssociatedElement`** interface (`HTMLElement` plus the managed members) types the declarations the library cannot write, chiefly the tag-name map. `value` is left to the author's props type, since its type varies by component. A **`defineComponent` overload keyed on a leading `formAssociated()`** in the extensions tuple types `host` as `FormAssociatedElement & P`, requires `P extends { value: string | number }`, lets `watch('disabled', …)` typecheck, and excludes managed names from `expose`. Other arrays get the plain signature and the same runtime. ADR 0019 specifies the overloads.

### 7. `internals` on the `FactoryContext`

`internals: ElementInternals | null` sits on the context beside `host`. It is the escape hatch for typed validity flags, custom `:state()` pseudo-classes and the two-argument `setFormValue(value, state)`; ADR 0020 adds `relayValidity()` beside it. A typical form component never touches it.

### 8. `bindState()` for custom states

`bindState(internals, token)` mirrors `bindClass(element, token)`: `true` adds the token to `internals.states`, `false` removes it, and a `null` internals makes it a no-op. Custom states are the right primitive for **component-owned** styling hooks, since consumer code rewriting the host's `class` cannot clobber them. They work on any component (§1). This is a deliberate carve-out from the rejection of bind helpers below: the per-token signature matches `bindClass` exactly, so it hides nothing.

### ARIA reflection

Superseded by [ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md), which makes ARIA reflection a first-class channel with `bindAria()`.

## Alternatives Considered

- **`onFormAssociated` / `onFormDisabled` / `onFormReset` / `onFormStateRestore` context helpers**: rejected after migrating all five form examples. Three went unused; `onFormReset` was used only to re-implement native `defaultValue` semantics by hand, which the library can do generically because parsers already encode attribute → value. They would also sit on every component's context; a reset hook can return if a custom reset appears.
- **Declarative `internals({...})` map, like `expose()`**: rejected as both too early and too late. The factory runs after `attachInternals()` must already have been called, and values reading descendant state must wait for dependency resolution (the `watch()` pipeline).
- **`bindFormValue` / `bindValidity` / `bindAria` / whole-set `bindStates` helpers**: rejected. They wrap one imperative statement without making it clearer and hide standard ElementInternals names. The managed convention removes the call instead of renaming it. Only per-token `bindState` is accepted (§8).
- **Separate `defineFormComponent()`**: rejected. Two parallel registration paths duplicating the definition logic, where an opt-in third parameter needs no second entry point.
- **`formAssociated: true` on every class**: rejected. Every component would be serialized into forms and bound to the `value`/`disabled` convention.
- **Keeping `host.error` beside ElementInternals**: rejected. It duplicates `validationMessage` as a second, non-standard source of truth and keeps the manual ARIA relay alive.

## Consequences

**Good:**

- **A typical form component writes zero ElementInternals code**: it exposes `value` (usually with a parser) and gets form participation, native reset, disabled handling and state restore.
- **Native contract in both directions**: outside code uses the host as an `<input>`; CSS uses `:disabled`, `:invalid`, `:user-invalid`.
- The hidden-input hack, multi-input serialization and the manual validity relay are retired, not relocated.
- **Type-checked and collision-safe**: the overload enforces `value`; managed-name collisions fail loudly.
- No `onForm*` helpers on the context and no public `FormState` type.

**Bad / accepted tradeoffs:**

- **The convention prescribes `value` and reserves `disabled`.** Components with non-string canonical state expose a string `value` and derive the richer representation from it — the same constraint native controls live with, and what makes the managed layer possible.
- **Managed behavior has gaps by design**: File/FormData values, two-argument `setFormValue` state and non-string restore go through `internals` directly.
- **The anchor heuristic can guess wrong**; the override is calling `internals.setValidity()` directly.
- **The CEM schema has no `formAssociated` field**, and the standard analyzer does not detect it; the mitigation is extending the Le Truc CEM plugin ([ADR 0013](0013-cem-plugin-for-le-truc-factory-pattern.md)) to emit it as a non-standard field.
- `internals` is a getter, not a plain field, so the `null` warning can fire once per instance; it never fires if `internals` is never read.

**Compatibility:** additive and non-breaking; M1 gains an optional third parameter, and §4 Accessibility gains native validation and pseudo-classes.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 (Accessibility, Browser support); architecture: [Component Model](../ARCHITECTURE.md#component-model)
- Related: [ADR 0002](0002-factory-form-over-builder-pattern.md) (the factory context gains `internals`), [ADR 0007](0007-effect-descriptors-with-deferred-activation.md) (managed and author effects activate after dependency resolution), [ADR 0013](0013-cem-plugin-for-le-truc-factory-pattern.md)
- Amended by: [ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md) (§2: extension instead of an options flag), [ADR 0020](0020-merge-based-validity-composition-and-relayvalidity.md) (§5: merging `setCustomValidity`; §7: `relayValidity()`), [ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md) (ARIA reflection)
- Supersedes: None
