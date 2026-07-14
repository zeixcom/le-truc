# ADR 0016: ElementInternals for Form Association and Custom States

## Status

✅ Accepted

## Context

Le Truc components cannot participate in HTML forms as first-class controls. Today, components that need form integration resort to workarounds. A survey of the example components in `examples/` found:

- **`form-listbox`** embeds a hidden `<input type="hidden">` and manually keeps it in sync with the component's value, including dispatching a synthetic `change` event (`input.dispatchEvent(new Event('change', { bubbles: true }))`). It has a **latent form-reset bug**: on `<form reset()>`, the hidden input reverts but nothing propagates back to the component's state.
- **`form-colorgraph`** submits one logical color value through three separate named `<input>` elements (`lightness`, `chroma`, `hue`), because the custom element itself is not a form control.
- **`form-spinbutton`** uses a hidden or disabled `<input type="number">` as a serialization vessel while real interaction happens via +/- buttons.
- **`form-textbox`**, **`form-combobox`**, and **`form-colorgraph`** all repeat a manual validity relay: `checkValidity()` → `host.error` property → `setAttribute('aria-invalid')` → `setAttribute('aria-errormessage')`. This is a tax that native Constraint Validation integration would eliminate.

ElementInternals — now baseline across evergreen browsers — is the standard Web Components API for the *implicit* behavior of custom elements: form association (`setFormValue`, lifecycle callbacks, Constraint Validation), custom `:state()` pseudo-classes, and ARIA reflection. It is the platform mechanism for exactly these concerns.

Form association cuts both ways, and both directions matter:

- **Author-facing**: the component must feed its value and validity into the form (`setFormValue`, `setValidity`) and react to form lifecycle events (reset, disable, state restore).
- **Consumer-facing**: to the outside world — form code, testing tools, other frameworks — a form-associated custom element (FACE) should behave like a native control. FACE does **not** provide this automatically: the host element gets no `checkValidity()`, `reportValidity()`, `validity`, `validationMessage`, `willValidate`, `setCustomValidity()`, `form`, or `labels` members unless the class defines them, delegating to `internals`.

A full needs assessment and exploration are documented in [PLAN-element-internals.md](../PLAN-element-internals.md).

Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function) (component definition via `defineComponent`), §4 Accessibility ("must not make it harder to achieve"), §4 Browser support ("Required APIs: Custom Elements v1 …").

## Decision

Support form association via a third `options` parameter on `defineComponent` and a **managed form-control convention**: a form-associated component exposes a reactive `value` property, and the library owns everything mechanical — form value sync, the form lifecycle callbacks (reset, disabled, state restore), and a native-parity validity contract on the host. The `ElementInternals` object is exposed on the `FactoryContext` as the escape hatch for typed validity flags, custom `:state()` pseudo-classes, and the two-argument `setFormValue(value, state)` form. **No `onForm*()` lifecycle helpers and no reactive abstraction layer** — a typical form component writes zero ElementInternals code.

### 1. `attachInternals()` in the constructor

The `Truc` class calls `this.attachInternals()` unconditionally in its constructor and stores the result on a private field. This is the only valid call site: `attachInternals()` can be called once per element, and the constructor is the only lifecycle callback that runs exactly once. Calling it in `connectedCallback` would throw on reconnect. The call is guarded by a try/catch — `attachInternals()` throws `NotSupportedError` for pre-upgrade instances or parser-ordering edge cases; the component degrades gracefully (internals is `null`, a DEV_MODE warning fires on first access).

### 2. `options` parameter for `formAssociated`

A third parameter on `defineComponent` carries static class-level configuration:

```ts
defineComponent<Props>(name, factory, options?)
```

`options.formAssociated` (default `false`) sets `static formAssociated = true` on the generated class and enables the managed form-control behavior below. This is additive and non-breaking — existing two-argument calls are unaffected.

### 3. Managed form-control convention

A component defined with `{ formAssociated: true }` follows a prescribed convention, mirroring native form controls:

- **It exposes a reactive `value` property** (string, or coerced with `String()`). A DEV_MODE warning fires if the factory completes without exposing `value`.
- **The `value` attribute is the default value** — like native `defaultValue`. Components must not reflect the current value back into the attribute.
- **The `name` attribute identifies the control on submission** — read natively by the browser; nothing for the library or author to do.

In exchange, the library manages:

| Concern | Managed behavior |
|---|---|
| Form value sync | An internal effect (same deferred-activation pipeline as author effects) watches `value` and calls `internals.setFormValue(String(value))`. |
| `formResetCallback` | Restores `value` to its default by re-running the retained initializer: for a `Parser`, re-parse the current `value` attribute (native `defaultValue` semantics); for a static initial value, restore it. No-op if signals are not yet initialized. |
| `formStateRestoreCallback` | If the restored state is a string, assigns it to `value`. Non-string states (File/FormData, custom two-argument `setFormValue` states) are not managed — deferred until a concrete need surfaces. |
| `formDisabledCallback` | Drives a library-managed reactive `disabled` property (below). |

**Managed member names are reserved.** On a form-associated component, `expose()` throws `InvalidPropertyNameError` (the existing error class, with a form-association-specific message) for any managed member name — `form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity`, `reportValidity`, `setCustomValidity`, `disabled`. `value` is the deliberate exception: the component must expose it. The check runs before `#initSignals`' `prop in this` guard, which would otherwise *silently skip* the colliding initializer (the managed members are prototype-defined). Non-form-associated components are unaffected and may expose these names freely.

### 4. Managed `disabled` property

Form-associated hosts get a library-managed reactive `disabled: boolean` property:

- The property setter reflects to the `disabled` content attribute; the browser then natively bars the element from constraint validation and submission and matches `:disabled` / `:enabled` — FACE gives all of this for free once the attribute is honored.
- `formDisabledCallback` (which the browser fires for both the element's own `disabled` attribute *and* ancestor `<fieldset disabled>`) writes the effective disabled state into the backing signal — so `host.disabled` and `watch('disabled', …)` are correct even for fieldset-inherited disabling, which never touches the element's attribute.
- Authors propagate it inward where needed: `watch('disabled', bindProperty(input, 'disabled'))`.
- `disabled` is a reserved prop name on form-associated components; `expose({ disabled: … })` throws.

### 5. Native-parity host contract

The generated class, when `formAssociated: true`, defines the standard form-control members on the host, delegating to `internals`:

`form`, `name` (attribute-reflecting), `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, and `setCustomValidity(message)` — the last implemented as `internals.setValidity(message ? { customError: true } : {}, message || undefined, anchor)`.

**Validation anchor**: `setValidity` needs a focusable anchor for the browser to focus and show the validation bubble on blocked submission or `reportValidity()`. The managed anchor is the first focusable form-control descendant (`input, select, textarea, button, [tabindex]`), falling back to the host. Components needing a different anchor — or typed validity flags like `rangeOverflow` — call `internals.setValidity(flags, message, anchor)` directly.

With this contract, the `host.error` reactive-property convention in the form examples is retired: external consumers read `host.validationMessage` / `host.validity` like on a native input, and inline error display binds to component-internal state.

**Change events** remain the author's responsibility, matching native timing semantics: dispatch `change`/`input` from the host at user-commit points; programmatic property sets fire no events (native parity). The library cannot know what a "user commit" is for a given widget.

### 6. Type surface: `FormAssociatedElement` + overloaded `defineComponent`

Two complementary pieces:

- **Exported `FormAssociatedElement` interface** — `HTMLElement` plus the managed members (§4–5). Authors use it in the declarations the library cannot write for them, chiefly the tag-name map: `'my-input': FormAssociatedElement & MyProps`. `value` is deliberately not included — it is component-exposed (string for textbox, number for spinbutton) and belongs in the author's own props type.
- **`defineComponent` overload keyed on the options literal** — when the third argument is the inline literal `{ formAssociated: true }`, the factory context types `host` as `FormAssociatedElement & P`, requires `P extends { value: string | number }` (managed sync coerces with `String()`), lets `watch('disabled', …)` typecheck, and excludes the managed member names from `expose`'s initializer type. A widened `boolean` falls back to the plain signature — degraded typing, identical runtime. The DEV_MODE runtime warning for a missing `value` remains, for JS users the overload cannot reach.

### 7. `internals` on the `FactoryContext`

The `ElementInternals` object is exposed on the context alongside `host`:

```ts
type FactoryContext<P> = ElementQueries & {
  host: HTMLElement & P
  internals: ElementInternals | null
  expose: ...
  // ...
}
```

It is the escape hatch for everything the managed layer does not cover: typed validity flags (`internals.setValidity({ rangeOverflow: true }, msg, anchor)`), custom `:state()` pseudo-classes (`internals.states`), and the two-argument `setFormValue(value, state)`. A typical form component never touches it.

### ARIA reflection: available but not promoted

`internals.role` and `internals.aria*` are accessible via the exposed `internals` object — they cannot be withheld once the object is on the context. However, **no convenience helpers will be added** for ARIA reflection, and the documentation will carry an active warning against replacing explicit `aria-*` attributes or native semantic elements with it until the platform tooling gap is resolved (see Consequences).

## Alternatives Considered

- **`onFormAssociated` / `onFormDisabled` / `onFormReset` / `onFormStateRestore` context helpers** (a draft implementation of this ADR shipped these on the branch). Rejected after migrating all five form examples: three of the four helpers went entirely unused, and the fourth (`onFormReset`) was used five times to hand-roll the same thing — resetting `value` to an ad-hoc guess of its default (`''`, `0`, or a manually re-parsed attribute). That is native `defaultValue` semantics re-implemented per component, which the library can do generically because prop parsers already encode attribute → value. The helpers also sat permanently on the `FactoryContext` of *every* component, form-associated or not. By the project's own abstraction test ("what complexity does this hide?" / "defer until a concrete need surfaces"), none of the four earned its place. If a component with a genuinely custom reset appears, a reset hook can be added back then.

- **Declarative `internals({...})` map (like `expose()`).** Rejected. It would be both too early and too late: too early because the factory body runs in `connectedCallback`, after `attachInternals()` must already have been called; too late because reactive values that read descendant state must wait for dependency resolution (the `watch()` pipeline). Note this timing argument does **not** apply to the managed value-sync effect: the library owns `connectedCallback` and registers its internal effect in the same deferred-activation pipeline as author effects. See [ADR-0007](0007-effect-descriptors-with-deferred-activation.md).

- **`bindFormValue(internals)` / `bindValidity(internals, anchor)` / `bindStates(internals)` / `bindAria(internals, name)` helpers.** Rejected. Most wrap a single imperative statement without making it shorter or clearer, and they hide standard ElementInternals method names behind Le-Truc-specific names. The managed convention goes the other way: instead of renaming the low-level API, it removes the need to call it at all in the common case.

- **Separate `defineFormComponent()` function.** Rejected. It keeps `defineComponent`'s signature untouched but creates two parallel registration paths and duplicates the entire component-definition logic. An options parameter is the standard way to carry class-level configuration.

- **Always set `formAssociated: true` on every `Truc` class.** Rejected. Every component would get form participation whether it needs it or not — surprising behavior (elements unexpectedly serialized into `<form>` data) and a prescribed `value`/`disabled` convention imposed on non-form components.

- **Keeping the `host.error` reactive-property convention alongside ElementInternals.** Rejected. It duplicates `validationMessage` as a second, non-standard source of truth and keeps the manual `aria-invalid`/`aria-errormessage` relay alive. `setCustomValidity()` + native `:invalid`/`:user-invalid` + `host.validationMessage` cover the same ground with the platform's own vocabulary.

## Consequences

**Good:**

- **A typical form component writes zero ElementInternals code.** It exposes `value` (usually with a parser) and gets form participation, native reset semantics, disabled handling, and state restore for free. Compare: the draft-helper design required every component to hand-wire `watch('value', v => internals?.setFormValue(v))` plus an `onFormReset` handler.
- **Native contract in both directions.** Outside code can call `checkValidity()` / `reportValidity()`, read `validity` / `validationMessage`, and call `setCustomValidity()` on a Le Truc form component exactly as on `<input>`. CSS can use `:disabled`, `:invalid`, `:user-invalid` natively.
- Form participation without nested hidden inputs; `form-listbox`'s hidden-input hack and its latent form-reset bug are eliminated; `form-colorgraph` submits one serialized value; `form-spinbutton` drops its vestigial input.
- The manual validity relay (`checkValidity()` → `host.error` → `aria-invalid`/`aria-errormessage`) is genuinely retired, not relocated — styling hooks move to native `:invalid` / `:user-invalid` on the host.
- Custom `:state()` pseudo-classes come for free via `internals.states`.
- **The convention is type-checked and collision-safe.** The `{ formAssociated: true }` overload enforces the `value` prop at compile time; `FormAssociatedElement` gives consumers native-control typing; managed-name collisions in `expose()` fail loudly with `InvalidPropertyNameError` instead of being silently skipped by the `prop in this` guard.
- Smaller API surface than the draft: no `onForm*` helpers on `FactoryContext`, no public `FormState` type.

**Bad / trade-offs:**

- **The convention prescribes `value` (and reserves `disabled`).** Components whose canonical state is not a string must expose a string `value` and derive their internal representation from it (e.g. `form-colorgraph` refactors from `color: Oklch` to `value: string` + internal Oklch memo). This is a real constraint, accepted deliberately: it is the same constraint native form controls live with, and it is what makes the managed layer possible.
- **Managed behavior has gaps by design**: File/FormData form values, custom two-argument `setFormValue` state, and non-string state restore are not managed — components use `internals` directly, and a restore/reset hook can be added later if a concrete need surfaces.
- **The anchor heuristic can guess wrong.** First-focusable-descendant is right for the current examples but is a heuristic; the documented override is calling `internals.setValidity(flags, message, anchor)` directly.
- **ARIA reflection tooling gap (significant).** `internals.role` and `internals.aria*` are not reliably visible to accessibility testing tools. axe-core produces documented false positives ([#4259](https://github.com/dequelabs/axe-core/issues/4259), [#4659](https://github.com/dequelabs/axe-core/issues/4659)); Chromium does not reliably update the accessibility tree from `internals.aria*` ([#40810268](https://issues.chromium.org/issues/40810268)); the W3C has not resolved the spec gap ([aria #2663](https://github.com/w3c/aria/issues/2663)). The nested-element trap is concrete: if `<basic-button>` set `internals.role = 'button'` and dropped its inner `<button>`, static tools would not flag invalid button nesting — a regression in the safety net. **Mitigation**: ARIA reflection rides along on the exposed `internals` object (cannot be withheld), but is not promoted — no helpers, no examples, and an active advisory in the docs to keep explicit `aria-*` attributes and native semantic elements until the platform catches up.
- **CEM cannot represent `formAssociated`.** The Custom Elements Manifest schema has no `formAssociated` field and `@custom-elements-manifest/analyzer` (v0.11.0) does not detect it. **Mitigation**: the Le Truc CEM plugin ([ADR-0013](0013-cem-plugin-for-le-truc-factory-pattern.md)) will be extended to emit `formAssociated` as a non-standard extension field in the same work stream.
- The `internals` property is exposed via a getter (not a plain field) so a `DEV_MODE` warning can fire once per instance when `internals` is `null` (the `attachInternals()` failed path). The warning fires only on first access — if the author never reads `internals`, no warning fires.

**Compatibility:**

- Non-breaking, additive change. Existing `defineComponent(name, factory)` calls are unaffected. The third `options` parameter is optional. Targets v2.3 as a minor release.
- M1 (component definition via `defineComponent`) is extended, not changed — the signature gains an optional third parameter.
- §4 Accessibility: the feature *enables* better form accessibility (native validation, form participation, native pseudo-classes) while the ARIA-reflection sub-feature stays unpromoted per the advisory above.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 (Accessibility, Browser support)
- Architecture: [Component Model](../ARCHITECTURE.md#component-model)
- Exploration: [PLAN-element-internals.md](../PLAN-element-internals.md) (needs assessment, timing model, tooling gap analysis, draft-migration evidence)
- Related: [ADR-0002](0002-factory-form-over-builder-pattern.md) — the factory form; this ADR extends the factory context with `internals`
- Related: [ADR-0007](0007-effect-descriptors-with-deferred-activation.md) — deferred activation; both author `internals.*` calls and the managed value-sync effect run in effects that activate after dependency resolution
- Related: [ADR-0013](0013-cem-plugin-for-le-truc-factory-pattern.md) — the CEM plugin will be extended to emit `formAssociated`
- Supersedes: None
