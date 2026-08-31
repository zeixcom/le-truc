# TSRX Le Truc Compiler — Correction & Caveat Checklist

Compiled from the `FormTextbox` review discussion. Three kinds of item:

- **BUG** — current compiler behaviour is wrong, fix it
- **RULE** — a rule the compiler must enforce (diagnostic or lowering)
- **DOC** — behaviour that is correct but surprising; must be written down

---

## 1. Conformance with the TSRX spec

- [ ] **BUG — `&{}` is not reactive interpolation.** In TSRX, `&{` and `&[` are the whitespace-sensitive *lazy-pattern introducers* (`LazyObjectBindingPattern`, `LazyArrayBindingPattern`) and live in binding positions. There is no `&{}` template-child form. Remove it; use plain `{}`. This is the single decisive divergence — anything that has read the spec parses `&{` as opening a binding pattern.
- [ ] **DOC — lazy destructuring is not applicable to Le Truc.** Server composition requires eager snapshot evaluation for markup generation. `&{}` should never appear in a Le Truc component; consider making it a diagnostic in this host profile.
- [ ] **RULE — a standalone `JSXExpressionContainer` is not a `TemplateOutput`.** Any `@{}` or control-flow block whose output is a bare expression needs a `<>` wrapper. Emit the diagnostic with a fix-it.
- [ ] **RULE — statements before output are legal.** `TemplateBlock : { StatementListItemList TemplateOutput }`. Do not reject statements inside `@if` / `@for` / `@switch` / `@try` bodies; exactly one output node, statements first.
- [ ] **DOC — `pass={{…}}` is not a deviation.** Core TSRX defines no attribute semantics at all; the host owns them. Consider `truc:pass` (`JSXNamespacedName` is in the grammar) to be collision-proof against a user prop named `pass` and to match ecosystem convention for host-owned attributes.
- [ ] **DOC — declare the style profile as unscoped.** The host owns selector scoping and class generation. Le Truc is light-DOM with global selectors; Ripple scopes and hashes. State this explicitly or every tool and agent trained on Ripple will mis-explain the CSS.

## 2. Reactivity lifting

- [ ] **BUG — auto-lift is partial.** The line is *lexically visible reactive read* vs. *read behind an opaque call boundary*, not *single read* vs. *compound expression*. `{host.validationMessage}` and `{length.get() === 0}` both lift. `{formatRemaining(maxlength, length)}` needs a thunk.
- [ ] **RULE — a missed lift must be an error, never a silent static emit.** A missed lift is invisible: the server folds it, the HTML is correct, the demo looks right, and it never updates. Over-lift is loud; under-lift survives review and screenshots. When analysis is uncertain, error and ask for an explicit thunk.
- [ ] **DOC — thunks remain legal as an explicit override**, mandatory only where tracing fails.

## 3. Element references

- [ ] **BUG — drop magic `ref={}`.** Use explicit `first(selector)`, resolved structurally on the server and via the DOM on the client.
- [ ] **RULE — selector-literal type inference must yield precise, non-nullable types** via `HTMLElementTagNameMap`, e.g. `first('input, textarea', 'required')` → `HTMLInputElement | HTMLTextAreaElement`. This is the direct countermeasure to the observed agent habit of writing obsolete casts: casts get written when inference returns `Element` or `null`.
- [ ] **RULE — force narrowing** where a reference spans `@if` branches with different element types.

## 4. Server fold / optimizer pass

The fold rule: **the server may fold only expressions that are pure functions of props and the static template.**

- [ ] **RULE — one AST node, two bindings.** Server = evaluate with props bound; client = evaluate with signals bound. Never two lowerings of the same expression — that reintroduces the three-file drift problem inside the compiler, where it is invisible because both halves are generated.
- [ ] **RULE — trace live element properties to their origin.** `first('input').value` → the server arg behind `<input value={arg}>`. Structural use of `first()` folds; live reads do not.
- [ ] **RULE — fail loud on the server** for live element method calls (`checkValidity()`, `setCustomValidity()`) and impure initializers (`Date.now()`, random ids).
- [ ] **RULE — refuse to fold sensors.** No server value exists; folding to the build machine's reading is the worst outcome.
- [ ] **RULE — refuse to fold ambient reads that pass a naive purity check.** `Intl.*`, `toLocaleString`, `Date`, `getTimezoneOffset` read no signal but their inputs are ambient (build-machine locale and timezone). For SSG add the time gap itself: folded at build, upgraded weeks later.

## 5. Sensor slots and semantically loaded attributes

- [ ] **RULE — omission is not neutral for attributes whose absence carries meaning.** `hidden` omitted → visible. `disabled` omitted → enabled **and submittable**. Same for `checked`, `selected`, `aria-expanded`. A sensor-driven `hidden` renders the element visible until the client corrects; a sensor-driven `disabled` renders an interactive, submittable control. Require an author-declared server default for these, or err to the safe side.
- [ ] **DOC — text content may be omitted.** Empty string degrades gracefully; only CLS remains as residue.
- [ ] **DOC — the "Le Truc is fast" argument bounds the wrong quantity.** Connect-time work is small, but the gap is *latency to definition*: parse → module fetched → `defineComponent` executed. Network-bound; hundreds of ms on a cold cache, permanent on a 404 or CSP block. For a library whose premise is that the HTML works before JS, this argument cannot be leaned on for loaded attributes.

## 6. Hydration and the initial effects run

- [ ] **RULE — the goal is not "all initial effects are no-ops."** It is: **every non-no-op is attributable to a known cause** — sensor, async, or pre-upgrade DOM divergence. A no-op guarantee that is too strong forces defending the wrong behaviour.
- [ ] **BUG — pre-upgrade DOM divergence must not be overwritten.** Between parse and upgrade the user can type; the browser can also refill via session restore, password-manager autofill, or bfcache. At upgrade `input.value` may be `"hello"` while the content attribute still says `""`. Adopting the attribute silently eats user input in exactly the window where people are most likely to be typing.
- [ ] **RULE — for elements with a dirty flag** (`input`/`textarea` value, `checked`, `selected`), adopt the **live IDL property**. Everywhere else the attribute is the server's channel and adoption is correct.
- [ ] **DOC — equality is a non-issue.** `List` and `Store` already compare by value; `equals` is overridable.
- [ ] **RULE — dev-mode hydration assertion.** Recompute each folded expression once on upgrade and warn on mismatch. Costs nothing in production; converts impure folds and missed lifts — both silent, both invisible in single-instance demos — into loud failures.

## 7. Form-associated semantics

The dirty flag gates the **content-attribute** path, not the property path.

- [ ] **DOC — the IDL setter always applies.** `input.value = x` sets the value, **sets the dirty flag**, and runs sanitization; never blocked. `setAttribute('value', x)` changes the value **only if the dirty flag is false**. `input.checked = x` behaves the same way with the dirty checkedness flag. So `host.value = x` → `input.value = x` needs no relay logic, and marking dirty is the correct native side effect.
- [ ] **RULE — mirror the native property pair** instead of inventing a policy for "set from outside":
      `host.value` → `input.value` (current, sets dirty);
      `host.defaultValue` → `input.defaultValue` (reflects the `value` content attribute).
- [ ] **RULE — do not reflect `host.value` back to the content attribute.** Reflecting overwrites the reset baseline, and `formResetCallback` would then restore whatever the user last typed.
- [ ] **RULE — drop `value` from `observedAttributes`.** `defaultValue` gives the reset baseline a typed public channel; the property becomes the sole live edit path. (If the attribute path is kept instead, it must apply only while not dirty.)
- [ ] **DOC — the dirty flag cannot be cleared from JS.** Only the form reset algorithm clears it — which works here because the inner control is in the light DOM and is itself a resettable element owned by the same form.
- [ ] **BUG — reset ordering.** Reset runs in tree order, so the host precedes its own inner input: `formResetCallback` fires *first*, then the native input resets to `defaultValue`. Do not write to `input.value` in the callback; sync back after it, e.g. `queueMicrotask(() => { host.value = input.value })`.
- [ ] **DOC — `host.clear()` leaves the control permanently dirty.** Correct and native-matching, but the content attribute is inert from then on. Document it or it reads as a bug later.
- [ ] **RULE — the inner control must have no `name`.** It stays out of submission only for that reason; a named inner control submits the field twice (once via `setFormValue`, once natively). Compiler error, not a doc note — the markup looks entirely reasonable and the failure is server-side.
- [ ] **DOC — ARIA reflection is broader than assumed.** String-valued `aria-*` have IDL properties (`ariaLabel`, `ariaExpanded`, …). The uneven area is element-reference attributes (`ariaDescribedByElements` and friends). Rough rule: string ARIA → property, relationship ARIA → attribute. Re-check current support before fixing the fallback.

## 8. `@try` / `@pending` / `@catch`

All three branches render in the initial HTML, two hidden.

- [ ] **BUG — hidden form controls still submit.** `display: none` and the `hidden` attribute exclude nothing; only `disabled` does. Named controls in `@try` or `@catch` submit alongside `@pending`. Auto-wrap non-active branches in `fieldset[disabled]` (nested form-associated custom elements inherit).
- [ ] **RULE — duplicate `id`s across branches** land the same way; check or namespace them.
- [ ] **DOC — `<legend>` escapes.** Descendants of a disabled fieldset's first `<legend>` are not disabled. The compiler generates the wrapper, so authors must not put controls in a legend.
- [ ] **DOC — content-model limits.** No `<fieldset>` inside `<tr>`, `<select>`, `<ul>`, `<dl>`. A generic `ModuleLazyload` cannot be used in those contexts; authors hand-craft a component with per-control `disabled` instead.
- [ ] **RULE — reset generated fieldset styles**: `border`, `padding`, `margin`, and `min-width` (the `min-content` quirk breaks flex/grid children).
- [ ] **DOC — `inert` is not a substitute**; it does not exclude from submission. `fieldset[disabled]` is the correct pick.
- [ ] **DOC — per-boundary policy.** SSG: `@pending` visible. SSR: authors may await and emit the resolved branch, avoiding a loading flash for content that was never pending.

## 9. Branch tree-shaking

- [ ] **RULE — shake only when both conditions hold:**
      1. the promise depends **solely on server-definitive args** (a reactive `src`, as in `ModuleLazyload`, disqualifies it), **and**
      2. the resolved value is **consumed only by the shaken markup** — no effect or exposed property outside it also reads it.
- [ ] **RULE — when both hold, emit no client task at all.** The markup becomes static and the `@try` disappears from the client output. No serialization, no re-fetch, no flash.
- [ ] **RULE — if condition 1 holds but 2 does not,** the value must survive to the client, which needs a transfer mechanism that does not exist yet. Until it does, render `@pending` visible and let the client resolve.
- [ ] **DOC — never shake without one of the above.** Emitting only the resolved branch while the client still constructs a pending task flashes back to loading and re-fetches — worse than not shaking.

## 10. Component-authoring gotchas (carry into lint rules or docs)

From the original `FormTextbox`, all still worth catching:

- [ ] `<textarea value={…}>` — textarea has no `value` content attribute; the initial value must be the element's text content.
- [ ] `aria-describedby` parity across `@if` branches (present on the `input` branch, missing on `textarea`).
- [ ] The error paragraph's `id` is computed but never referenced by `aria-describedby`; `role="alert"` announces but does not associate.
- [ ] Ids derived from `name` collide when the component renders twice in one document.
- [ ] `host.value` syncing on `change` while `length` tracks `input` — the two public properties disagree mid-typing.
- [ ] Binding markup to a nullable derived cell (`descriptionCell` is `null` when the description has no `{n}`) instead of to the exposed property. Wrong-layer binding of exactly the kind the format is meant to prevent.
- [ ] Prefer `:has(.clear)` over an imperative `internals.states.add()` in a template block — no JS at all, and it cannot drift from the markup.
- [ ] Type the prop object with optional fields where defaults are supplied, or the defaults are unreachable.

## 11. Codegen and agent ergonomics

- [ ] **Re-run the agent evals after removing `&{}`.** Prediction: a large share of the observed struggle disappears without touching anything structural. If it does not, the remaining causes are elsewhere and worth isolating separately.
- [ ] **Near-miss JSX is worse than distinct syntax.** TSRX is close enough to JSX that the React prior fires at full strength; models fill the delta with React habits. Make `{cond && <x/>}`, `return (<>…</>)`, and similar hard errors with fix-its rather than silently something else.
- [ ] **Point codegen at `https://tsrx.dev/llms.txt`.**
- [ ] **Prefer loud failures over compact output.** Silent, instance-coupled failures (per-instance state baked into a per-tag definition; missed reactive lifts) work in a one-instance demo and break on the second instance, with no error. Context-window savings never justify that trade.

## 12. Strategic notes on the TSRX bet

- [ ] Draft spec dated June 2026, Ripple the only named host profile — the tooling being bought is currently promised, not shipped.
- [ ] Downside is bounded: the grammar is additive over a TypeScript-compatible baseline, the AST is ESTree/JSX-shaped, and TSRX-specific additions are limited to `JSXCodeBlock`, `JSXStyleElement`, and the four control-flow nodes. If it does not take, what remains is a small delta over JSX, not an orphan language.
- [ ] Being an early second host profile is leverage. A custom-element / light-DOM / signals target differs enough from Ripple's to surface where "host-defined" is under-specified — worth engaging upstream **before** the Le Truc profile is fixed rather than after.
