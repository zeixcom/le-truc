# ADR 0016: ElementInternals for Form Association and Custom States

## Status

✅ Accepted

## Context

Le Truc components cannot participate in HTML forms as first-class controls. Today, components that need form integration resort to workarounds. A survey of the example components in `examples/` found:

- **`form-listbox`** embeds a hidden `<input type="hidden">` and manually keeps it in sync with the component's value, including dispatching a synthetic `change` event (`input.dispatchEvent(new Event('change', { bubbles: true }))`). It has a **latent form-reset bug**: on `<form reset()>`, the hidden input reverts but nothing propagates back to the component's state.
- **`form-colorgraph`** submits one logical color value through three separate named `<input>` elements (`lightness`, `chroma`, `hue`), because the custom element itself is not a form control.
- **`form-spinbutton`** uses a hidden or disabled `<input type="number">` as a serialization vessel while real interaction happens via +/- buttons.
- **`form-textbox`**, **`form-combobox`**, and **`form-colorgraph`** all repeat a manual validity relay: `checkValidity()` → `host.error` property → `setAttribute('aria-invalid')` → `setAttribute('aria-errormessage')`. This is a tax that native Constraint Validation integration would eliminate.

ElementInternals — now baseline across evergreen browsers — is the standard Web Components API for the *implicit* behavior of custom elements: form association (`setFormValue`, lifecycle callbacks, Constraint Validation), custom `:state()` pseudo-classes, and ARIA reflection. It is the platform mechanism for exactly these concerns. Without it, Le Truc components must either abstain from form participation or work around the missing API.

A full needs assessment and exploration are documented in [PLAN-element-internals.md](../PLAN-element-internals.md).

Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function) (component definition via `defineComponent`), §4 Accessibility ("must not make it harder to achieve"), §4 Browser support ("Required APIs: Custom Elements v1 …").

## Decision

Expose the `ElementInternals` object on the `FactoryContext` and support form-association opt-in via a third `options` parameter on `defineComponent`. **No reactive abstraction layer** for the ElementInternals API — authors use it imperatively inside `watch()`, the same way they use the DOM today. Form lifecycle callbacks get minimal `onForm*()` helpers because the browser requires them as class methods the library owns.

### 1. `attachInternals()` in the constructor

The `Truc` class calls `this.attachInternals()` unconditionally in its constructor and stores the result on a private field. This is the only valid call site: `attachInternals()` can be called once per element, and the constructor is the only lifecycle callback that runs exactly once. Calling it in `connectedCallback` would throw on reconnect. The call is guarded by a try/catch — `attachInternals()` throws `NotSupportedError` for pre-upgrade instances or parser-ordering edge cases; the component degrades gracefully (internals is `null`, a DEV_MODE warning fires on first access).

### 2. `internals` on the `FactoryContext`

The `ElementInternals` object is exposed on the context alongside `host`:

```ts
type FactoryContext<P> = ElementQueries & {
  host: HTMLElement & P
  internals: ElementInternals | null
  expose: ...
  // ...
}
```

Authors use the standard imperative API inside `watch()`:

```ts
defineComponent<Props>('my-input',
  ({ expose, host, internals, watch }) => {
    expose({ value: '' })
    return [
      watch('value', v => { internals?.setFormValue(v) }),
      watch(() => host.valid, valid => {
        internals?.setValidity({ valid, message: valid ? '' : 'Required' })
      }),
    ]
  },
  { formAssociated: true }
)
```

The `internals` object is also the escape hatch for the two-argument `setFormValue(value, state)` form and for `internals.states` (custom `:state()` pseudo-classes).

### 3. `options` parameter for `formAssociated`

A third parameter on `defineComponent` carries static class-level configuration:

```ts
defineComponent<Props>(name, factory, options?)
```

`options.formAssociated` (default `false`) sets `static formAssociated = true` on the generated class and enables the form-lifecycle callback stubs. This is additive and non-breaking — existing two-argument calls are unaffected.

### 4. `onForm*()` helpers for form lifecycle callbacks

The form-associated lifecycle callbacks (`formAssociatedCallback`, `formDisabledCallback`, `formResetCallback`, `formStateRestoreCallback`) must exist as **methods on the class** — the browser looks for them there — but the class is library-owned. The `onForm*()` helpers are the minimal bridge: the class implements stub callbacks that delegate to handlers registered by the factory:

```ts
onFormReset(() => { host.value = '' }),
onFormDisabled(disabled => { host.disabled = disabled }),
```

These helpers follow the existing `on()` pattern and return `EffectDescriptor`s. Four separate helpers — `onFormAssociated`, `onFormDisabled`, `onFormReset`, `onFormStateRestore` — each taking a single handler function. They are always present on the `FactoryContext` (not conditionally narrowed by `formAssociated`): the browser only calls the class callbacks when `static formAssociated = true`, so the helpers are inert no-ops on non-form-associated components. The class stubs delegate to a per-instance handler map stored in a module-private `WeakMap`; calling a callback with no registered handler is a safe no-op.

`onFormAssociated` has a late-registration guard: `formAssociatedCallback` fires during DOM insertion, which can precede the effect-activation phase that waits on dependency resolution. The handler map caches the form value (`undefined` = not yet fired, `null` = disassociated, `HTMLFormElement` = associated) and replays it when the `onFormAssociated` effect activates.

### ARIA reflection: available but not promoted

`internals.role` and `internals.aria*` are accessible via the exposed `internals` object — they cannot be withheld once the object is on the context. However, **no convenience helpers will be added** for ARIA reflection, and the documentation will carry an active warning against replacing explicit `aria-*` attributes or native semantic elements with it until the platform tooling gap is resolved (see Consequences).

## Alternatives Considered

- **Declarative `internals({...})` map (like `expose()`).** Rejected. It would be both too early and too late: too early because the factory body runs in `connectedCallback`, after `attachInternals()` must already have been called; too late because reactive values that read descendant state must wait for dependency resolution (the `watch()` pipeline). A declarative map would reinvent the existing `watch()` + deferred-activation pipeline and get the timing wrong. See [ADR-0007](0007-effect-descriptors-with-deferred-activation.md).

- **`bindFormValue(internals)` / `bindValidity(internals, anchor)` / `bindStates(internals)` / `bindAria(internals, name)` helpers.** Rejected. Applying the test "what complexity does this abstraction hide?": most wrap a single imperative statement (`internals.setFormValue(v)`) without making it shorter or clearer. `internals` is instance-bound, so any `bind*` helper would either be a context helper (inconsistent with the imported `bind*` family) or take `internals` as a first arg (pointless indirection). They hide standard ElementInternals method names behind Le-Truc-specific names, forcing authors to learn two APIs. The one case with real hidden complexity — `bindStates()` (token-set diffing) — is deferred until a concrete need surfaces; everything is expressible without it.

- **Separate `defineFormComponent()` function.** Rejected. It keeps `defineComponent`'s signature untouched but creates two parallel registration paths and duplicates the entire component-definition logic. An options parameter is the standard way to carry class-level configuration.

- **Always set `formAssociated: true` on every `Truc` class.** Rejected. Every component would get the form-associated lifecycle callbacks whether it needs them or not — surprising behavior (elements unexpectedly participating in `<form>` serialization) and minor overhead for components that aren't form controls.

## Consequences

**Good:**

- Form participation without nested hidden inputs. The `form-listbox` hidden-input hack and manual `change` dispatch are eliminated; the component itself becomes the form control. `form-colorgraph` can submit one serialized value instead of three inputs. `form-spinbutton` drops its vestigial input.
- Native Constraint Validation integration. `setValidity()` drives `:invalid`, `validationMessage`, and form-blocking natively, replacing the manual `checkValidity()` → `host.error` → `aria-invalid`/`aria-errormessage` relay repeated across `form-textbox`, `form-combobox`, and `form-colorgraph`.
- Form lifecycle support. `formResetCallback` closes the latent reset bug in `form-listbox`; `formDisabledCallback` and `formStateRestoreCallback` become available.
- Custom `:state()` pseudo-classes come for free. `module-scrollarea`'s host-level `overflow` / `overflow-start` / `overflow-end` classes can become `internals.states` + `:host:state(...)`.
- No new abstraction layer. Authors use the documented ElementInternals API directly — no second API surface to learn, no names to memorize, consistent with Le Truc's philosophy of composability over wrappers.

**Bad / trade-offs:**

- **ARIA reflection tooling gap (significant).** `internals.role` and `internals.aria*` are not reliably visible to accessibility testing tools. axe-core produces documented false positives ([#4259](https://github.com/dequelabs/axe-core/issues/4259), [#4659](https://github.com/dequelands/axe-core/issues/4659)); Chromium does not reliably update the accessibility tree from `internals.aria*` ([#40810268](https://issues.chromium.org/issues/40810268)); the W3C has not resolved the spec gap ([aria #2663](https://github.com/w3c/aria/issues/2663)). The nested-element trap is concrete: if `<basic-button>` set `internals.role = 'button'` and dropped its inner `<button>`, static tools would not flag invalid button nesting — a regression in the safety net. **Mitigation**: ARIA reflection rides along on the exposed `internals` object (cannot be withheld), but is not promoted — no helpers, no examples, and an active advisory in the docs to keep explicit `aria-*` attributes and native semantic elements until the platform catches up.
- **CEM cannot represent `formAssociated`.** The Custom Elements Manifest schema has no `formAssociated` field and `@custom-elements-manifest/analyzer` (v0.11.0) does not detect it. **Mitigation**: the Le Truc CEM plugin ([ADR-0013](0013-cem-plugin-for-le-truc-factory-pattern.md)) will be extended to emit `formAssociated` as a non-standard extension field in the same work stream.
- The `FactoryContext` type gains `internals` and `onForm*` properties. This is additive but is a visible type change.
- The `internals` property is exposed via a getter (not a plain field) so a `DEV_MODE` warning can fire once per instance when `internals` is `null` (the `attachInternals()` failed path). The warning fires only on first access — if the author never reads `internals`, no warning fires.

**Compatibility:**

- Non-breaking, additive change. Existing `defineComponent(name, factory)` calls are unaffected. The third `options` parameter is optional and defaults to `{}`. Targets v2.3 as a minor release.
- M1 (component definition via `defineComponent`) is extended, not changed — the signature gains an optional third parameter.
- §4 Accessibility: the feature *enables* better form accessibility (native validation, form participation) but the ARIA-reflection sub-feature has a tooling gap. The decision to not promote ARIA reflection and to document the advisory keeps Le Truc aligned with "must not make [accessibility] harder to achieve."

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 (Accessibility, Browser support)
- Architecture: [Component Model](../ARCHITECTURE.md#component-model)
- Exploration: [PLAN-element-internals.md](../PLAN-element-internals.md) (needs assessment, timing model, tooling gap analysis)
- Related: [ADR-0002](0002-factory-form-over-builder-pattern.md) — the factory form; this ADR extends the factory context with `internals`
- Related: [ADR-0007](0007-effect-descriptors-with-deferred-activation.md) — deferred activation; `internals.*` calls run inside `watch()` effects that activate after dependency resolution
- Related: [ADR-0013](0013-cem-plugin-for-le-truc-factory-pattern.md) — the CEM plugin will be extended to emit `formAssociated`
- Supersedes: None
