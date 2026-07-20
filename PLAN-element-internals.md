# Plan: ElementInternals Support

> Status: **Revised after design review — draft implementation on this branch is being reshaped**
> Date: 2026-07-14

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
| **Form association** (`formAssociated`, managed value/reset/disabled/restore, native-parity host contract) | **High** — real workarounds, a latent bug, repeated validation tax | **v2.3** (non-breaking minor). |
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
| `setFormValue` (managed) | After dependency resolution | Library-internal effect on the `value` signal, registered in the same deferred-activation pipeline as author effects |
| `setValidity`, `states`, ARIA (author-driven) | After dependency resolution (may depend on descendant state) | Author uses `internals.*` imperatively inside `watch()` |
| Form lifecycle callbacks | Runtime (form events) | Library-owned class methods with managed default behavior; guarded no-ops if they fire before `expose()` has initialized signals |

### Why no `internals()` context helper like `expose()`

An `internals({...})` declarative map was considered and rejected. It would be **both too early and too late**: too early because the factory body runs in `connectedCallback`, after `attachInternals()` must already have been called; too late because reactive values that read descendant state must wait for dependency resolution (the `watch()` pipeline). A declarative map would reinvent the existing `watch()` + deferred-activation pipeline and get the timing wrong. (This argument does *not* apply to the managed value-sync effect: the library owns `connectedCallback` and registers its internal effect in the same pipeline as author effects.)

### Why no `bind*` helpers for ElementInternals

`bindFormValue(internals)`, `bindValidity(internals, anchor)`, `bindStates(internals)`, `bindAria(internals, name)` were considered and rejected. Applying the test "what complexity does this abstraction hide?":

- Most wrap a single imperative statement (`internals.setFormValue(v)`) without making it shorter or clearer.
- `internals` is instance-bound (`host.#internals`), so any `bind*` helper would either be a context helper (inconsistent with the imported `bind*` family) or take `internals` as a first arg (pointless indirection).
- They hide the standard ElementInternals method names behind Le-Truc-specific names, forcing authors to learn two APIs.

The managed convention (below) goes the other way: it removes the need to call the low-level API at all in the common case.

### Why no `onForm*()` lifecycle helpers (revised decision)

The first draft on this branch shipped four factory context helpers — `onFormAssociated`, `onFormDisabled`, `onFormReset`, `onFormStateRestore` — bridging the class-level form lifecycle callbacks. Migrating all five form examples produced decisive evidence against them:

- **Three of the four went entirely unused.** No example needed `onFormAssociated`, `onFormDisabled`, or `onFormStateRestore`.
- **The fourth was used five times to hand-roll the same thing.** Every `onFormReset` handler reset `value` to an ad-hoc guess of its default (`''`, `0`, or a manually re-parsed attribute in colorgraph). That is native `defaultValue` semantics re-implemented per component — and the library can do it generically, because prop parsers already encode attribute → value.
- **Every component also hand-wired the same `watch('value', v => internals?.setFormValue(v))` boilerplate**, with per-component serialization variance (`String(v)`, `formatCss(color)`).
- The helpers sat permanently on the `FactoryContext` of every component, form-associated or not.

By the same YAGNI test used to reject the `bind*` helpers, none of the four earned its place. The revised design moves the lifecycle behavior into library-managed defaults; a reset/restore hook can be added back if a component with genuinely custom semantics appears.

## Design

### 1. Third `options` parameter on `defineComponent`

```ts
defineComponent<Props>(
  'my-input',
  (ctx) => { ... },
  { formAssociated: true }
)
```

The options object starts with one field: `formAssociated?: boolean` (default `false`). When `true`, the generated `Truc` class gets `static formAssociated = true`, the managed form-control behavior (§3–4), and the native-parity host contract (§5).

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

Always attaching (not gated on `formAssociated`) is intentional: ARIA reflection, custom states, and the `:state()` pseudo-class work without form association, and `attachInternals()` is cheap when unused. The try/catch handles the pre-upgrade / parser-ordering edge case where `attachInternals()` throws `NotSupportedError` — the component still works, just without internals. A `DEV_MODE` warning fires once per instance on first access of a `null` `internals`.

### 3. Managed form-control convention

A component defined with `{ formAssociated: true }` follows a prescribed convention mirroring native form controls:

- **It exposes a reactive `value` property** (string, or coerced with `String()`). A DEV_MODE warning fires if the factory completes without exposing `value`.
- **The `value` attribute is the default value** — like native `defaultValue`. Components must **not** reflect the current value back into the attribute (this retires the `host.setAttribute('value', v)` pattern in `form-listbox`).
- **The `name` attribute identifies the control on submission** — read natively by the browser; nothing for the library or author to do.

In exchange, the library manages the mechanics:

| Concern | Managed behavior | Implementation |
|---|---|---|
| Form value sync | Internal effect watches `value`, calls `internals.setFormValue(String(value))` | Registered in the same deferred-activation pipeline as author effects; first run submits the initial value |
| `formResetCallback` | Restore `value` to its default: re-run the retained initializer — `Parser` → re-parse the current `value` attribute; static value → restore it | `#initSignals` retains the `value` initializer (per-instance WeakMap); no-op if signals not yet initialized |
| `formStateRestoreCallback(state, mode)` | If `state` is a string, assign to `host.value` | Non-string states (File/FormData, custom two-arg `setFormValue` state) not managed — deferred until a concrete need surfaces |
| `formDisabledCallback(disabled)` | Write effective disabled state into the managed `disabled` signal (§4) | Covers both own `disabled` attribute and ancestor `<fieldset disabled>` |

A typical form component therefore writes **zero ElementInternals code**: it exposes `value` (usually with a parser) and is done.

### 4. Managed `disabled` property

Form-associated hosts get a library-managed reactive `disabled: boolean` property:

- The property setter reflects to the `disabled` content attribute. FACE then gives native behavior for free: the element is barred from constraint validation, skipped on submission, and matches `:disabled` / `:enabled` in CSS.
- `formDisabledCallback` writes the *effective* disabled state into the backing signal — so `host.disabled` and `watch('disabled', …)` are correct even for `<fieldset disabled>` inheritance, which never touches the element's own attribute.
- Authors propagate inward where needed: `watch('disabled', bindProperty(input, 'disabled'))`.
- `disabled` becomes a reserved prop name on form-associated components; `expose({ disabled: … })` throws `InvalidPropertyNameError`.

### 5. Native-parity host contract

When `formAssociated: true`, the generated class defines the standard form-control members on the host, delegating to `internals`:

| Member | Delegates to |
|---|---|
| `form` | `internals.form` |
| `name` | `name` attribute (reflected getter/setter) |
| `labels` | `internals.labels` |
| `validity` | `internals.validity` |
| `validationMessage` | `internals.validationMessage` |
| `willValidate` | `internals.willValidate` |
| `checkValidity()` | `internals.checkValidity()` |
| `reportValidity()` | `internals.reportValidity()` |
| `setCustomValidity(message)` | `internals.setValidity(message ? { customError: true } : {}, message \|\| undefined, anchor)` |

**Validation anchor**: `setValidity` with a message needs a focusable anchor so the browser can focus the control and show the validation bubble on blocked submission or `reportValidity()` — Le Truc hosts are typically not focusable themselves. The managed anchor is the **first focusable form-control descendant** (`input, select, textarea, button, [tabindex]`), resolved at call time, falling back to the host. Components needing a different anchor — or typed validity flags like `rangeOverflow` — call `internals.setValidity(flags, message, anchor)` directly.

**The `host.error` convention is retired.** External consumers read `host.validationMessage` / `host.validity` like on a native input; components set validity via `setCustomValidity()` (or `internals.setValidity` for typed flags); inline error display binds to component-internal state, not a public prop; `aria-invalid` styling hooks are replaced by native `:invalid` / `:user-invalid` on the host.

**Managed member names are reserved.** On a form-associated component, `expose()` throws `InvalidPropertyNameError` (the existing error class, with a form-association-specific message) for any managed member name: `form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity`, `reportValidity`, `setCustomValidity`, `disabled`. `value` is the deliberate exception — the component *must* expose it. This check must run **before** the existing `prop in this` guard in `#initSignals`: the managed members are prototype-defined, so that guard would otherwise *silently skip* the colliding initializer — the worst possible failure mode. Non-form-associated components are unaffected and may expose these names freely.

**Change events stay the author's responsibility**, matching native timing semantics: dispatch `change` (and `input` where appropriate) from the host at user-commit points; programmatic property sets fire no events. The library cannot know what a "user commit" is for a given widget. This also restores the composition channel `form-combobox` lost when the hidden input's bubbling `change` went away — `form-listbox` dispatches `change` from its host on selection.

### 6. Type surface: `FormAssociatedElement` + overloaded `defineComponent`

Two complementary pieces, because neither alone covers both sides:

**Exported `FormAssociatedElement` interface** — the managed members, for the author's own declarations (which the library cannot augment):

```ts
interface FormAssociatedElement extends HTMLElement {
  readonly form: HTMLFormElement | null
  name: string
  disabled: boolean
  readonly labels: NodeList
  readonly validity: ValidityState
  readonly validationMessage: string
  readonly willValidate: boolean
  checkValidity(): boolean
  reportValidity(): boolean
  setCustomValidity(message: string): void
}

// Author-side usage:
declare global {
  interface HTMLElementTagNameMap {
    'form-textbox': FormAssociatedElement & FormTextboxProps
  }
}
```

`value` is deliberately **not** part of `FormAssociatedElement`: it is component-exposed (string for textbox, number for spinbutton) and belongs in the author's props type, as today.

**Overloaded `defineComponent`** — keyed on the options literal type:

```ts
function defineComponent<P extends ComponentProps & { value: string | number }>(
  name: string,
  factory: (ctx: FormFactoryContext<P>) => FactoryResult | Falsy | void,
  options: ComponentOptions & { formAssociated: true },
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps>(
  name: string,
  factory: (ctx: FactoryContext<P>) => FactoryResult | Falsy | void,
  options?: ComponentOptions,
): CustomElementConstructor | undefined
```

When the third argument is the inline literal `{ formAssociated: true }`, the first overload engages: `host` is typed `FormAssociatedElement & P`, `P` must include `value: string | number`, `watch('disabled', …)` typechecks (managed reactive prop), and `expose`'s initializer type excludes the managed member names. A widened `boolean` (e.g. from an untyped variable) falls back to the plain signature — degraded typing, identical runtime; in practice the options object is always written inline. The DEV_MODE runtime warning for a missing `value` stays, for JS users the overload cannot reach.

### 7. `internals` exposed on `FactoryContext` like `host`

```ts
type FactoryContext<P> = ElementQueries & {
  host: HTMLElement & P
  internals: ElementInternals | null   // escape hatch
  expose: (props: Initializers<P>) => void
  watch: WatchHelper<P>
  on: OnHelper<P>
  pass: PassHelper<P>
  provideContexts: ProvideContextsHelper<P>
  requestContext: RequestContextHelper
}
```

`internals` is the escape hatch for everything the managed layer does not cover:

- **Typed validity flags**: `internals.setValidity({ rangeOverflow: true }, msg, anchor)` (e.g. `form-spinbutton`).
- **Custom `:state()` pseudo-classes**: `internals.states.add('overflow-start')` (e.g. `module-scrollarea`).
- **Two-argument `setFormValue(value, state)`** for custom restore state.

`internals` is nullable because `attachInternals()` may have failed; optional chaining (`internals?.`) is the author's graceful-degradation guard.

### What is NOT included

- **No `onForm*()` lifecycle helpers** — replaced by managed defaults (see Timing Model).
- **No `internals({...})` declarative map** — timing model makes it unsound (see above).
- **No `bindFormValue` / `bindValidity` / `bindStates` / `bindAria` helpers** — they add surface without hiding meaningful complexity (see above).
- **No managed File/FormData values or custom state restore** — use `internals` directly; a hook can be added when a concrete need surfaces.
- **No public `FormState` type** — it was only needed by the `onFormStateRestore` helper signature.

## API Surface Summary

| Addition | Type | Location |
|---|---|---|
| Third `options` param on `defineComponent` | Signature change (additive) | `src/component.ts` |
| `{ formAssociated?: boolean }` option type | New type | `src/component.ts` |
| `internals` on `FactoryContext` | New context property | `src/component.ts` |
| Managed `value` sync, reset, state restore, `disabled` | Library-internal behavior (no new API names) | `src/component.ts` + `src/helpers/form.ts` |
| Host contract: `form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity()`, `disabled` | Native-parity members on form-associated hosts | `src/component.ts` + `src/helpers/form.ts` |
| `FormAssociatedElement` interface | Type export (for tag-name-map and consumer declarations) | `src/types.ts` + `index.ts` |
| `defineComponent` overload on `{ formAssociated: true }` | Type-level convention enforcement (additive) | `src/component.ts` |

No changes to existing `bind*` helpers, parsers, or the reactive pipeline. The change is additive and non-breaking. Compared to the first draft on this branch, the `FactoryContext` sheds the four `onForm*` helpers and the public `FormState` type export.

## Migration Story (worked example: `form-listbox`)

Today (on `main`):

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

With the managed convention:

```ts
// No hidden input in HTML; name attribute on <form-listbox> itself
// ...
on(listbox, 'click', ({ target }) => {
  const option = (target as HTMLElement).closest('[role="option"]')
  if (option && option.value !== host.value) {
    host.value = option.value
    host.dispatchEvent(new Event('change', { bubbles: true }))  // native-parity commit event
  }
}),
// Form value sync: managed (value → setFormValue)
// Form reset: managed (value attribute is the default)
// Disabled, state restore: managed
```

The hidden `<input>` is gone, the value-sync boilerplate is gone, the form-reset bug is closed without any component code, and the host emits a native-style `change` event that `form-combobox` (and any outside consumer) can listen to.

### Per-component migration notes

| Component | Changes beyond the managed convention |
|---|---|
| `form-listbox` | Drop `host.setAttribute('value', v)` reflection (value attribute = default now). Dispatch `change` from the host at selection commit. |
| `form-combobox` | Listen to listbox's host `change` event instead of reaching into its DOM with `closest('[role="option"]')`. Replace `error` prop with `setCustomValidity()`. |
| `form-textbox` | Drop `error` prop; relay inner input's `validationMessage` via `host.setCustomValidity()`; inline error text binds to internal state; anchor is the inner input (managed heuristic finds it). |
| `form-spinbutton` | Keep `internals.setValidity({ rangeOverflow, rangeUnderflow }, msg, anchor)` for typed flags — the one legitimate direct-`internals` use among the form examples. |
| `form-colorgraph` | **Refactor `color: Oklch` → `value: string`** (CSS color string, parsed with the Oklch parser); internal Oklch memo derived from `value`; interactions write serialized strings. Managed reset then restores from the `value` attribute — replacing the hand-rolled `initialColor` capture. |

## Open Questions

1. **Type-level enforcement of the `value` convention** — **Resolved: overloaded `defineComponent`** (Design §6) requires `P extends { value: string | number }` when the options literal is `{ formAssociated: true }`; the exported `FormAssociatedElement` interface covers the author's tag-name-map declaration, which the library cannot augment. The DEV_MODE runtime warning stays for JS users.
2. **`String()` coercion vs. string-only `value`** — **Resolved: allow `string | number`**, coerce with `String()` in the managed sync. `form-spinbutton` keeps its `number` value; `FormAssociatedElement` omits `value` so per-component value types don't conflict in the intersection.
3. **Managed-name collisions in `expose()`** — **Resolved: throw `InvalidPropertyNameError`** (existing error class, form-association-specific message) for managed member names on form-associated components, checked before the `prop in this` guard that would otherwise silently skip them. `value` excepted (required); non-form-associated components unaffected.
4. **`name` and `type` IDL properties** — `name` (attribute-reflecting) is included for native parity; `type` (native inputs return their kind) is omitted for now — `localName` serves. Confirm during implementation.

## Next Steps

1. ~~Draft ADR 0016~~ — **Rewritten** to the managed-convention design; status **Proposed** pending review and end-to-end validation.
2. Rework the library implementation on this branch:
   - Remove `onForm*` helpers, `FormHandlers` map, and public `FormState` export.
   - Add the managed layer in `src/helpers/form.ts`: value-sync effect, default lifecycle behavior, host contract installer, anchor resolution.
   - Retain the `value` initializer in `#initSignals` for managed reset; throw `InvalidPropertyNameError` for managed member names in `expose()` on form-associated components (before the `prop in this` guard).
   - Export `FormAssociatedElement`; add the `defineComponent` overload on the `{ formAssociated: true }` literal.
   - DEV_MODE warnings: `formAssociated` without exposed `value`; `null` internals on first access (existing).
3. Re-migrate the five form examples per the table above (including the `form-colorgraph` value refactor and the `form-listbox` host `change` event).
4. Update unit tests (`src/tests/form.test.ts`, `component.test.ts`) and the Playwright specs to the managed behavior; keep the form-reset regression test.
5. Flip ADR 0016 to **Accepted** once the migrations validate the shape end-to-end.
6. Extend the CEM plugin ([ADR 0013](adr/0013-cem-plugin-for-le-truc-factory-pattern.md)) to emit `formAssociated` as a non-standard extension field in the same work stream.
