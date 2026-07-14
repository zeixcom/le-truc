# Plan: ElementInternals Support

> Status: **Draft — pending ADR**
> Date: 2026-07-13

## Problem

Le Truc components cannot participate in HTML forms as first-class controls. Today, components that need form integration resort to workarounds: hidden `<input>` elements as serialization vessels, manual `change` event dispatching, and relayed validity state mirrored onto host properties. These workarounds are repeated across the example components, and at least one (`form-listbox`) has a latent form-reset bug because there is no lifecycle hook for it.

ElementInternals — now baseline across evergreen browsers — is the Web Components API for the *implicit* behavior of custom elements: form association, validity, custom `:state()` pseudo-classes, and ARIA reflection. It is the standard mechanism for exactly these concerns.

## Needs Assessment

A survey of all example components in `examples/` identified where ElementInternals would simplify or enhance components. Full findings below; the headline is that **form association alone justifies the feature**, with `:state()` and ARIA reflection as free byproducts.

### Form association — HIGH value, clear wins

Five of seven form components work around not being form controls themselves:

| Component | Current workaround | With ElementInternals |
|---|---|---|
| `form-listbox` | `<input type="hidden">` + manual `dispatchEvent(new Event('change'))` + manual `input.value =` sync. **Latent form-reset bug**: no `formResetCallback`, so reset desynchronizes visual selection from submitted value. | `setFormValue(v)` eliminates the hidden input. `formResetCallback` fixes the reset gap. |
| `form-colorgraph` | Three separate `<input name="lightness/chroma/hue">` for one logical `oklch` value. | Single form control submitting one serialized value. |
| `form-spinbutton` | Hidden/readonly `<input type="number">` as serialization vessel. | Drop the vestigial input; native range validation via `setValidity()`. |
| `form-combobox` | Inherits listbox's hidden-input hack transitively via composition. | Fixed when listbox is fixed. |
| `form-textbox` | Visible input is legitimate, but validity is mirrored onto `host.error` + manual `aria-invalid`/`aria-errormessage` plumbing. | `setValidity()` drives `:invalid` and `validationMessage` natively. |

A repeated validation relay pattern (`checkValidity()` → `host.error` → `setAttribute('aria-invalid')` → `setAttribute('aria-errormessage')`) appears in **textbox, combobox, colorgraph** — a manual tax that native Constraint Validation integration eliminates.

Two form components (`form-checkbox`, `form-radiogroup`) intentionally delegate to native inputs for keyboard accessibility and semantics and would see **no benefit**.

### Custom `:state()` pseudo-class — MEDIUM value, narrow scope

`module-scrollarea` is the prime example. It toggles three CSS classes **on the host** to represent overflow state:

```ts
watch(overflowStart, bindClass(host, 'overflow-start')),
watch(overflowEnd, bindClass(host, 'overflow-end')),
```

This becomes `internals.states.add('overflow-start')` + CSS `:host:state(overflow-start)` — the textbook spec use case. A few other components (`module-codeblock` collapsed state, `module-todo` filter, `module-lazyload` loading/error) have milder versions of the same host-boolean-state pattern.

This capability requires **no additional API** — once `internals` is exposed, authors use `internals.states` directly.

### ARIA reflection — available but discouraged (tooling gap)

**Important negative finding.** Le Truc's component model treats the host as a *container* whose **children** carry widget roles and ARIA state (`role="tab"` buttons, `role="tabpanel"` slides, the separator divider). But `internals.aria*` only reflects onto the *host* element. So `module-carousel`, `module-tabgroup`, and `module-splitview` — which look like natural AOM candidates — **cannot benefit** without restructuring which element owns the semantics.

Beyond the architectural mismatch, ARIA reflection via `internals.role` / `internals.aria*` carries a **tooling-detection risk**: axe-core produces false positives, Chromium does not reliably update the accessibility tree, and the W3C has not resolved the spec gap. See the [Tooling Ecosystem Gap](#tooling-ecosystem-gap) section below.

Once `internals` is exposed on the factory context, ARIA reflection cannot be withheld — but **no convenience helpers will be added** for it, and the docs will carry an active warning against replacing explicit `aria-*` attributes or native semantic elements until W3C specs clear and tooling catches up.

### Roadmap phasing

| Capability | Value | Timeline |
|---|---|---|
| **Form association** (`formAssociated`, `setFormValue`, lifecycle callbacks) | **High** — real workarounds, a latent bug, repeated validation tax | **v2.3** (non-breaking minor). Includes convenience helpers for the form lifecycle. |
| **`internals.states` / `:state()`** | **Medium** — one clear win, a few mild ones | **v2.3** — free byproduct of exposing `internals`; no extra API. |
| **ARIA reflection** (`internals.role`, `internals.aria*`) | **Available but discouraged** | Exposed (cannot be withheld), but **not promoted**: no helpers, no examples, active advisory. Revisit when W3C #2663 resolves and tooling catches up. |

The form-association case alone justifies the feature and targets v2.3 as a non-breaking minor.

## Tooling Ecosystem Gap

ElementInternals' ARIA reflection (`internals.role`, `internals.aria*`) is **not reliably visible to static analysis or accessibility testing tools** as of mid-2025. This gap does not affect form association or custom `:state()` — only ARIA reflection.

### The nested-element trap (concrete risk)

Refactoring `<basic-button>` to set `internals.role = 'button'` and drop the inner `<button>` would create a semantic hazard: the browser treats the host as a button-role element, but static tools see no role attribute. An author nesting a `<button>` inside `<basic-button>` would receive **no warning** about invalid button nesting, because the tooling does not know the host carries implicit button semantics. This is a regression in the safety net — worse than a lint miss.

### Evidence

- **axe-core false positives**: [axe-core #4259](https://github.com/dequelabs/axe-core/issues/4259) — custom elements using `ElementInternals` to set `role` are incorrectly flagged as missing the role. [axe-core #4659](https://github.com/dequelabs/axe-core/issues/4659) — focusable elements in FACE shadow roots trigger false-positive audit failures.
- **Platform root cause**: [Chromium #40810268](https://issues.chromium.org/issues/40810268) — setting ARIA properties via `ElementInternals` does not reliably update the accessibility tree. axe-core inspects the computed tree, so it literally cannot see `internals.role`.
- **Spec-level**: [W3C/aria #2663](https://github.com/w3c/aria/issues/2663) — acknowledges that ElementInternals-set ARIA "results in false positives and undetected issues across the growing ecosystem." No resolution yet.

### What is NOT affected

- **Form association** (`setFormValue`, lifecycle callbacks, Constraint Validation): browser-native form plumbing, not accessibility-tree-inspected. The primary justification for this feature is unaffected.
- **Custom `:state()`**: a CSS pseudo-class mechanism, not an accessibility-tree concern. Unaffected.

### CEM cannot represent `formAssociated`

The Custom Elements Manifest schema has no `formAssociated` field, and `@custom-elements-manifest/analyzer` (v0.11.0) does not detect `static formAssociated = true`. The Le Truc CEM plugin ([ADR 0013](adr/0013-cem-plugin-for-le-truc-factory-pattern.md)) would need extending to emit `formAssociated` as a non-standard extension field on the declaration, or an upstream schema change is needed. This is a smaller gap (documentation metadata), not tools actively producing wrong results.

### Mitigation guidance for the ADR

1. **Recommend keeping explicit ARIA attributes on host elements** for now. The `internals.aria*` surface should be documented as available but **not recommended as a replacement for explicit `aria-*` attributes or native semantic elements** until axe-core, Chromium, and the W3C resolve the detection gap.
2. **Do not refactor existing components to drop native semantic elements** (e.g., `<basic-button>` keeping its inner `<button>`) in favor of `internals.role` — the accessibility-safety regression outweighs the minimal simplification.
3. **Extend the CEM plugin** to emit `formAssociated` (non-standard field) in the same work stream as this feature, so editor tooling at least knows which elements participate in forms.
4. **Track W3C/aria #2663** as the unblocking issue for ARIA reflection tooling support.

## Timing Model

ElementInternals imposes a hard constraint on *when* things can happen:

| Concern | When it must happen | Mechanism |
|---|---|---|
| `static formAssociated = true` | Class definition time | Third `options` parameter to `defineComponent` |
| `attachInternals()` | Constructor — runs once at creation; can only be called once per element, so `connectedCallback` is too late (throws on reconnect) | Library calls it unconditionally in the `Truc` constructor |
| `setFormValue`, `setValidity`, `states`, ARIA | After dependency resolution (may depend on descendant state) | Author uses `internals.*` imperatively inside `watch()` |
| Form lifecycle callbacks | Runtime (form events) | `onForm*()` factory helpers register handlers; class stubs delegate to them |

### Why no `internals()` context helper like `expose()`

An `internals({...})` declarative map was considered and rejected. It would be **both too early and too late**: too early because the factory body runs in `connectedCallback`, after `attachInternals()` must already have been called; too late because reactive values that read descendant state must wait for dependency resolution (the `watch()` pipeline). A declarative map would reinvent the existing `watch()` + deferred-activation pipeline and get the timing wrong.

### Why no `bind*` helpers for ElementInternals

`bindFormValue(internals)`, `bindValidity(internals, anchor)`, `bindStates(internals)`, `bindAria(internals, name)` were considered and rejected. Applying the test "what complexity does this abstraction hide?":

- Most wrap a single imperative statement (`internals.setFormValue(v)`) without making it shorter or clearer.
- `internals` is instance-bound (`host.#internals`), so any `bind*` helper would either be a context helper (inconsistent with the imported `bind*` family) or take `internals` as a first arg (pointless indirection).
- They hide the standard ElementInternals method names behind Le-Truc-specific names, forcing authors to learn two APIs.

The imperative form — `watch('value', v => { internals?.setFormValue(v) })` — is more readable and lets authors use the documented ElementInternals API directly.

`bindStates()` (which would hide old/new token-set diffing) is the one case with real hidden complexity, but it is deferred until a concrete need surfaces. Everything is expressible without it.

## Design

### 1. Third `options` parameter on `defineComponent`

```ts
defineComponent<Props>(
  'my-input',
  (ctx) => { ... },
  { formAssociated: true }
)
```

The options object is currently absent. It starts with one field: `formAssociated?: boolean` (default `false`). When `true`, the generated `Truc` class gets `static formAssociated = true` and the four form-lifecycle method stubs that delegate to registered handlers.

This is a **non-breaking, additive change**: existing two-argument `defineComponent(name, factory)` calls are unaffected.

### 2. Constructor calls `attachInternals()` unconditionally

```ts
class Truc extends HTMLElement {
  static formAssociated = options?.formAssociated ?? false

  #internals: ElementInternals | null
  constructor() {
    super()
    try {
      this.#internals = this.attachInternals()
    } catch {
      this.#internals = null
    }
  }
  // ...
}
```

Always attaching (not gated on `formAssociated`) is intentional: ARIA reflection, custom states, and the `:state()` pseudo-class work without form association, and `attachInternals()` is cheap when unused. The try/catch handles the pre-upgrade / parser-ordering edge case where `attachInternals()` throws `NotSupportedError` — the component still works, just without internals.

### 3. `internals` exposed on `FactoryContext` like `host`

```ts
type FactoryContext<P> = ElementQueries & {
  host: HTMLElement & P
  internals: ElementInternals | null   // new
  expose: (props: Initializers<P>) => void
  watch: WatchHelper<P>
  on: OnHelper<P>
  pass: PassHelper<P>
  provideContexts: ProvideContextsHelper<P>
  requestContext: RequestContextHelper
}
```

Authors use the standard ElementInternals API imperatively inside `watch()`:

```ts
defineComponent<Props>('my-input',
  ({ expose, host, internals, watch }) => {
    expose({ value: '', valid: true })
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

`internals` is nullable because `attachInternals()` may have failed; the optional-chaining (`internals?.`) is the author's graceful-degradation guard. A `DEV_MODE` warning is emitted the first time `internals` is accessed and is `null`.

### 4. `onForm*()` factory helpers for form lifecycle callbacks

The form-associated lifecycle callbacks (`formAssociatedCallback`, `formDisabledCallback`, `formResetCallback`, `formStateRestoreCallback`) must exist as **methods on the class** (the browser looks for them there), but the class is library-owned. The `onForm*()` helpers are the minimal bridge: the class implements stub callbacks that delegate to handlers registered by the factory.

```ts
defineComponent<Props>('my-input',
  ({ expose, host, internals, watch, onFormReset, onFormDisabled }) => {
    expose({ value: '' })
    return [
      watch('value', v => { internals?.setFormValue(v) }),
      onFormReset(() => { host.value = '' }),
      onFormDisabled(disabled => {
        host.disabled = disabled
        host.setAttribute('aria-disabled', String(disabled))
      }),
    ]
  },
  { formAssociated: true }
)
```

These helpers follow the existing `on()` pattern: they return `EffectDescriptor`s activated after dependency resolution. Their exact behavior when `formAssociated` is not set is an open question (see Open Question #2 below). The four helpers:

| Helper | Callback it bridges | Signature |
|---|---|---|
| `onFormAssociated(fn)` | `formAssociatedCallback(form)` | `(form: HTMLFormElement \| null) => void` |
| `onFormDisabled(fn)` | `formDisabledCallback(disabled)` | `(disabled: boolean) => void` |
| `onFormReset(fn)` | `formResetCallback()` | `() => void` |
| `onFormStateRestore(fn)` | `formStateRestoreCallback(state, mode)` | `(state: FormState, mode: string) => void` |

### What is NOT included

- **No `internals({...})` declarative map** — timing model makes it unsound (see above).
- **No `bindFormValue` / `bindValidity` / `bindStates` / `bindAria` helpers** — they add surface without hiding meaningful complexity (see above).
- **No reactive `bindStates()`** — deferred until concrete need surfaces; expressible imperatively today.

## API Surface Summary

| Addition | Type | Location |
|---|---|---|
| Third `options` param on `defineComponent` | Signature change (additive) | `src/component.ts` |
| `{ formAssociated?: boolean }` option type | New type | `src/component.ts` |
| `internals` on `FactoryContext` | New context property | `src/component.ts` |
| `onFormAssociated`, `onFormDisabled`, `onFormReset`, `onFormStateRestore` | New context helpers | `src/component.ts` + new `src/helpers/form.ts` |
| `ElementInternals` / `FormState` types | Type exports | `index.ts` |

No changes to existing `bind*` helpers, parsers, or the reactive pipeline. The change is additive and non-breaking.

## Migration Story (worked example: `form-listbox`)

Today:

```ts
// Hidden input in HTML: <input type="hidden" name="timezone">
const input = first('input[type="hidden"]', 'Needed to store the selected value.')
// ...
on(listbox, 'click', ({ target }) => {
  const option = (target as HTMLElement).closest('[role="option"]')
  if (option && option.value !== host.value) {
    host.value = option.value
    input.dispatchEvent(new Event('change', { bubbles: true }))  // manual
  }
}),
watch('value', value => {
  host.setAttribute('value', value)
  input.value = value  // manual sync
}),
// No form-reset handling — latent bug
```

With ElementInternals:

```ts
// No hidden input in HTML needed
// ...
on(listbox, 'click', ({ target }) => {
  const option = (target as HTMLElement).closest('[role="option"]')
  if (option && option.value !== host.value) {
    host.value = option.value  // form value updated reactively via watch below
  }
}),
watch('value', v => { internals?.setFormValue(v) }),  // form participation
onFormReset(() => { host.value = '' }),               // reset gap closed
```

The hidden `<input>` is removed from the HTML, the manual `dispatchEvent` and `input.value =` sync are gone, and the form-reset bug is fixed.

## Open Questions for ADR

> **All resolved during draft implementation.** The ADR remains in Proposed state until the migration of `form-listbox` confirms the shape end-to-end.

1. **`onForm*` presence when not form-associated** — **Resolved: always present, inert no-op.** The helpers are always on the `FactoryContext`; the browser only calls the class callbacks when `static formAssociated = true`, so they are inert on non-form-associated components. Conditional context typing was rejected as over-engineering for a zero-cost no-op.
2. **`onForm*` helper shape** — **Resolved: four separate helpers.** `onFormAssociated(fn)`, `onFormDisabled(fn)`, `onFormReset(fn)`, `onFormStateRestore(fn)`, each returning an `EffectDescriptor` consistent with the `on()` pattern. A single registration object was rejected — it would be a different shape from every other context helper. Handlers are stored in a per-instance `FormHandlers` map (module-private `WeakMap`); calling a callback with no registered handler is a safe no-op. `onFormAssociated` includes a late-registration replay: `formAssociatedCallback` fires during DOM insertion (before effect activation), so the handler map caches the form value and replays it when the effect activates.
3. **`DEV_MODE` null warning cadence** — **Resolved: once per instance, on first access.** The `internals` property is a getter (not a plain field) that checks a `#internalsAccessed` flag. If `internals` is `null` and hasn't been accessed yet, a DEV_MODE warning fires and the flag is set. If the author never reads `internals`, no warning fires.

## Next Steps

1. ~~Draft ADR 0016~~ — **Done.** ADR 0016 is **Accepted**.
2. Target **v2.3** as a non-breaking minor for form association and `internals.states`. ARIA reflection rides along on the exposed `internals` object but is not promoted.
3. ~~If approved: write the implementation plan~~ — **Done.** Implementation complete with 21 unit tests + `form-listbox` migration validating the shape end-to-end (42 Playwright tests pass, including the new form-reset test that closes the latent bug).
4. Extend the CEM plugin ([ADR 0013](adr/0013-cem-plugin-for-le-truc-factory-pattern.md)) to emit `formAssociated` as a non-standard extension field in the same work stream.
