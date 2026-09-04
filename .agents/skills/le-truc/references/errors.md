# Errors

Every error a component author can meet, why it surfaces, and how to fix it.

**Source of truth:** `src/errors.ts` (runtime classes) and `server/tsrx/diagnostics.ts` (compiler codes). Read the condition at the throw site before you act on a row here.

---

## Read the tier first

Le Truc routes each failure to the cheapest channel that can carry it ([ADR 0028](../../../../adr/0028-tiered-error-surfacing.md)). The tier tells you how much is broken. It is the load-bearing part of every row below.

| Tier | What you see | What it means for the page |
|---|---|---|
| **Tier 1 — Prevented** | A `TSRX0NN` diagnostic. The build fails. | Nothing shipped. Fix the source and rebuild. |
| **Tier 2 — Contained** | One `console.error` naming the component and the phase. | **The page is fine.** The component did not enhance and kept its server-rendered markup, which is the correct pre-JS state. Other components are unaffected. |
| **Tier 3 — Escalated** | An uncaught exception. | A real page-level failure. Only two sites reach it: `defineComponent()` at module evaluation, and a Trusted Types violation in `dangerouslyBindInnerHTML`. |

**A contained error is not a crash.** Le Truc never renders initial HTML — the server does. A component that fails to enhance falls back to markup that was already correct a moment ago. Read a Tier 2 line as "this one component is inert", not "the page broke".

Two Tier 2 shapes, by phase:

- **Factory failure** — the whole component is inert. Reported by `reportConnectFailure`.
- **Activation failure** — one effect descriptor did not activate; the component's other effects did. Reported by `reportEffectFailure`, which names the helper (`watch()`, `on()`, `pass()`, …). A **partially enhanced** component is a state that exists: some bindings live, one dead.

---

## Runtime errors

Thrown from `src/errors.ts`. Every one is contained unless the tier column says otherwise.

| What fired | Why it surfaces | How to fix | Tier |
|---|---|---|---|
| `InvalidComponentNameError` | `defineComponent()` got a tag that is not a valid custom element name. | Use a hyphenated, lowercase name. | **3** — thrown at module evaluation, before any component exists to degrade. Compiler: `TSRX008` |
| `ExtensionCollisionError` | Two extensions passed to `defineComponent()` declare the same `staticProps` key. | Remove or rename the key in one of them. | **3**, DEV_MODE only; production is first-wins and silent. Compiler: `TSRX009` |
| `InvalidPropertyNameError` | An `expose()` key is a reserved word / `Object` builtin, or a member an extension reserves (`form`, `name`, `validity`, …). | Rename the reactive property. | **2**. Compiler: `TSRX028` |
| `MissingElementError` | A required `first()`/`query()` reference matched nothing at connect. | Add a matching element, or drop the required-reason string to make the reference optional. | **2**. Compiler: `TSRX026`, `TSRX040`, `TSRX025` |
| `InvalidSelectorError` | The selector given to `all()`/`queryAll()` is malformed; the DOM engine threw. | Correct the selector. Until it parses, the element list stays empty and never updates. | **2**. Compiler: `TSRX026` |
| `NoActiveCollectorError` | `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` ran outside synchronous factory setup — usually deferred into a callback, or an `async` factory. | Call the helper directly in setup; move the deferred condition inside the effect. | **2**. Compiler: `TSRX013` (deferred call), `TSRX008` (`async` factory) |
| `InvalidCustomElementError` | `pass()`'s target is not a custom element. | Point `pass()` at a custom element, or bind the value with a reactive attribute/property instead. | **2**. Compiler: `TSRX012` |
| `InvalidReactivesError` | `pass()`'s second argument is not a record. | Pass an object literal of thunks, signals, or `{ get, set }` descriptors. | **2**. TypeScript covers this; no `TSRX` code |
| `InvalidPassPropertyError` | A passed prop is absent on the target, unresolvable to a signal, or **not Slot-backed** — read-only, a `defineMethod()` producer, or a non-Le-Truc element. | Expose the prop from a *mutable* initializer on the target (a value, a Parser, or `{ get, set }`), or drive it from that component's own state. | **2**. Compiler: `TSRX012` for a registry-known target; the runtime is the backstop for hand-authored and foreign elements |
| `InvalidTemplateError` | The `<template>` passed to `reconcile()` has other than exactly one root element. | Wrap the template content in a single root. | **2**. **No compiler rule and none needed** — a compiled `@for` template has one root by construction, so this only fires for a hand-authored `reconcile()` |
| `DependencyTimeoutError` | Required child custom elements were not defined within the timeout. | Make sure each is registered with `customElements.define()`, or raise the timeout. | **2** — *logged, never thrown*; effects run anyway, so the DOM may not be in the expected state |
| `UnsafeAttributeError` | `safeSetAttribute()` blocked an `on*` attribute name or an unsafe URL protocol. | Attach listeners with `on()`; use `http`, `https`, `ftp`, `mailto`, or `tel`. | **2**. Not decidable — it fires on runtime *data*, not source shape. The guarantee is that the write did **not** happen |
| Trusted Types violation | `dangerouslyBindInnerHTML` produced HTML the page's Trusted Types policy rejected. | Sanitize the value, or adjust the policy. | **3** — re-thrown from a microtask so the page's own error reporting sees it ([ADR 0010](../../../../adr/0010-trusted-types-support-via-sanitize-hook.md)) |

---

## Compiler diagnostics

Emitted by `server/tsrx/diagnostics.ts` while compiling a `.tsrx` source. **Errors** fail the build; **warnings** let it through and tell you what the output will do instead. Several conditions share one code where the author's fix is the same sentence.

### Reactivity and the server/client split

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `TSRX001` | `@for` over a reactive source that is not a declared `createList`. | Declare the source with `createList()`, or iterate server data. | warning — file skipped |
| `TSRX002` | A reactive expression reads an `@for` loop variable directly. | Hoist the derived value into a `const` first. | error |
| `TSRX003` | A hoisted `const` is read reactively but never rendered as a bare attribute, so the client cannot rebind it. | Render it (e.g. `aria-controls={id}`), or stop reading it reactively. | error |
| `TSRX004` | A signal is never rendered into the DOM, so the client cannot harvest its initial value. | Render it, or remove it. | error |
| `TSRX013` | A setup `const` calls a client-only primitive, derives from `host`/`internals`, chooses its constructor conditionally, or defers a collector helper into a callback. | Use a signal constructor, derive from a server-known value, or call the helper directly in setup. | error |
| `TSRX017` | A signal crosses a call the compiler cannot see inside, so it cannot tell whether the child is reactive. | Wrap the child in an explicit thunk. | error |
| `TSRX033` | An expression reads `Date`/`Intl`/`Math.random()`/a locale method — the *build machine's* clock, not a server arg. | Make it a reactive thunk, or take the value as a server arg. | error for a static child/attribute; warning for a reactive one (the fold is refused, the client corrects it) |
| `TSRX034` | `hidden`/`disabled`/`checked`/`selected`/`aria-expanded` has no server-renderable value, so it is omitted — which renders the *more dangerous* state of each pair. | Trace the value to a server-known prop, or give the element an explicit static default. | error on a real submittable form control; warning otherwise |
| `TSRX043` | A setup `const`'s initializer reads a `first()`-bound ref, which does not exist at server-render time. | Harvest instead: render the site from a server arg and read it back in `expose()`. | error |

### Element references

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `TSRX025` | `first()` called with other than one or two string literals. | Selector alone for optional; selector + required-reason for required. | error |
| `TSRX026` | A `first()`/`all()` selector matches nothing in the template, uses syntax the compiler cannot verify structurally, or is **malformed CSS**. | Correct the selector so it addresses a real, statically-addressable element. | error |
| `TSRX027` | A `first()` selector matches several elements that are not mutually-exclusive `@if` branches. | Give the target a distinguishing `class`/`id`/`data-*`. On a composed element the attribute goes on the *compose site*. | error |
| `TSRX040` | A **required** `first()` whose only match sits in a branch that may not render, so the reason can never be thrown. | Drop the required-reason string. | warning |
| `TSRX041` | Two `first()` names resolve to the same element. | Use one name in both places, or distinguish the two elements. | error |

The selector rules are deliberately **one-sided**: `TSRX026` reports only what no CSS parser accepts. A selector it passes is not thereby claimed valid — `InvalidSelectorError` remains the Tier 2 backstop.

### Props, `expose()`, and composition

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `TSRX010` | `{host.validationMessage}` (or another managed form prop) without `formAssociated`. | Declare `export const config = { formAssociated: true }`, or expose a prop of that name. | error |
| `TSRX011` | A composed (PascalCase) tag has no resolvable `.tsrx` import, or the imported file did not compile. | Import the component, or fix the child's own diagnostics first. | error |
| `TSRX012` | `pass={{ … }}` on a native or unregistered tag; a prop the target does not `expose()`; a prop the target exposes **read-only** or as a `defineMethod()`; a reactive attribute on a custom element; a compose-site `pass` with no `ref`. | Target a registry-known component and pass a prop it exposes from a *mutable* initializer. | error |
| `TSRX028` | An `expose()` key is a reserved word / `Object` builtin, or shadows a member `formAssociated()` installs. | Rename the prop. | error |
| `TSRX029` | A form-associated component's inner control carries a `name`, so the field submits twice. | Remove `name`; the host is the sole form participant. | error |
| `TSRX032` | A destructured prop has a default but its type is not marked optional, so the default is unreachable. | Mark it `prop?:` in the props type. | error |
| `TSRX039` | A Parser-exposed prop is *also* rendered from a same-named server arg — two seeding stories for one value. | Harvest from the site and drop the attribute. On a form-associated host, render the attribute too: it is the reset baseline. | warning |

**The read-only trap.** `expose({ x: sig.get })` is read-only however mutable `sig` is — a bare `.get` is neither a signal nor a descriptor, so it is wrapped in a computed and gets a plain getter, not a Slot. That is the most common `expose()` shape in the corpus, and `pass()` cannot target it. Expose a value, a Parser, or `{ get, set }` if the prop is meant to be driven from outside.

### Template structure

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `TSRX030` | `<textarea value={…}>` — not a real attribute; the browser ignores it. | Set the initial value as text content. | error |
| `TSRX035` | A literal `id` repeats across `@try`/`@catch`/`@pending` arms, which all render at once. | Give each arm's element a distinct id. | error |
| `TSRX038` | The same static `id` on more than one compose site. | Distinct ids, or address the instances by class. | error |
| `TSRX042` | A constant `id` in a template duplicates the moment a page places the component twice, breaking `aria-labelledby`/`<label for>`. | Take the id as a server arg with a default and render it from there. | warning |

### Source shape and imports

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `TSRX005` | A construct outside the sanctioned subset. | Rewrite it with a supported construct. | error |
| `TSRX006` | An attribute shape the classifier does not accept. | Follow the message's suggested form. | error |
| `TSRX007` | An element the generated client cannot address deterministically. | Give it a stable, distinguishing attribute. | error |
| `TSRX008` | A source-level violation: root tag, exports, style placement, an `async` component function. | Follow the message; a component function must be synchronous. | error |
| `TSRX009` | An invalid `export const config` extension declaration. | Correct the declaration. | error |
| `TSRX014` | A plain import whose bindings are never referenced, so it would be dropped from both generated modules. | Remove it, or use it. | warning |
| `TSRX015` | `requestContext()` called with other than exactly two arguments. | `requestContext(context, fallback)` — the fallback is what the server renders. | error |
| `TSRX016` | `requestContext()`'s fallback references a name the server cannot resolve. | Use a literal or an expression over server args/setup. | error |
| `TSRX036` | A real `@zeix/le-truc` export used without importing it. | Add the import. Factory-context helpers are ambient and need none. | error |
| `TSRX037` | Factory-context vocabulary (`expose`, `first`, `host`, …) named in an import. | Remove it from the import line. | error |

### Retired idioms

`TSRX018`–`TSRX024` catch constructs that would compile to something silently wrong. `TSRX018` (`&{…}` lazy-child sigil) and `TSRX019` (`{'prop'}` string-literal prop child) are retired TSRX forms; `TSRX020` rejects lazy destructuring, which the eager server half has nothing to defer to. `TSRX021`–`TSRX024` are the React idioms — `{cond && …}`, `{cond ? … : …}`, `.map()`, and `return (<>…</>)`. None of them fail loudly on their own: TSRX would render each one **literally**, stringified. Each message names the TSRX construct to use instead (`@if`, `@if`/`@else`, `@for`, a bare trailing expression).

`TSRX031` is **retired**. No builder emits it; per-branch addressing replaced the rule.

---

## Related

- `workflows/debug.md` — start there when the symptom is behavioral rather than a named error
- [ADR 0028](../../../../adr/0028-tiered-error-surfacing.md) — the tier contract
- [ADR 0004](../../../../adr/0004-slot-based-signal-swapping-for-inter-component-binding.md) — why `pass()` needs a Slot
- [ADR 0018](../../../../adr/0018-implicit-effect-collection-via-ambient-context.md) — why a deferred helper call has no collector
