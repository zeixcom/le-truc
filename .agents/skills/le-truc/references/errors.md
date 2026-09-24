# Errors

Every error a component author can meet, why it surfaces, and how to fix it.

**Source of truth:** `src/errors.ts` (runtime classes) and `server/compiler/diagnostics.ts` (compiler codes). Read the condition at the throw site before you act on a row here.

---

## Read the tier first

Le Truc routes each failure to the cheapest channel that can carry it ([ADR 0028](../../../../adr/0028-tiered-error-surfacing.md)). The tier tells you how much is broken. It is the load-bearing part of every row below.

| Tier | What you see | What it means for the page |
|---|---|---|
| **Tier 1 — Prevented** | A compiler diagnostic — `LTC###`, or `TSRX###` for a `.tsrx`-grammar rule. The build fails. | Nothing shipped. Fix the source and rebuild. |
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
| `InvalidComponentNameError` | `defineComponent()` got a tag that is not a valid custom element name. | Use a hyphenated, lowercase name. | **3** — thrown at module evaluation, before any component exists to degrade. Compiler: `LTC008` |
| `ExtensionCollisionError` | Two extensions passed to `defineComponent()` declare the same `staticProps` key. | Remove or rename the key in one of them. | **3**, DEV_MODE only; production is first-wins and silent. Compiler: `LTC009` |
| `InvalidPropertyNameError` | An `expose()` key is a reserved word / `Object` builtin, or a member an extension reserves (`form`, `name`, `validity`, …). | Rename the reactive property. | **2**. Compiler: `LTC028` |
| `MissingElementError` | A required `first()`/`query()` reference matched nothing at connect. | Add a matching element, or drop the required-reason string to make the reference optional. | **2**. Compiler: `LTC026`, `LTC040`, `LTC025` |
| `InvalidSelectorError` | The selector given to `all()`/`queryAll()` is malformed; the DOM engine threw. | Correct the selector. Until it parses, the element list stays empty and never updates. | **2**. Compiler: `LTC026` |
| `NoActiveCollectorError` | `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` ran outside synchronous factory setup — usually deferred into a callback, or an `async` factory. | Call the helper directly in setup; move the deferred condition inside the effect. | **2**. Compiler: `LTC045` (deferred call), `LTC008` (`async` factory) |
| `InvalidCustomElementError` | `pass()`'s target is not a custom element. | Point `pass()` at a custom element, or bind the value with a reactive attribute/property instead. | **2**. Compiler: `LTC012` |
| `InvalidReactivesError` | `pass()`'s second argument is not a record. | Pass an object literal of thunks, signals, or `{ get, set }` descriptors. | **2**. TypeScript covers this; no compiler code |
| `InvalidPassPropertyError` | A passed prop is absent on the target, unresolvable to a signal, or **not Slot-backed** — read-only, a `defineMethod()` producer, or a non-Le-Truc element. | Expose the prop from a *mutable* initializer on the target (a value, a Parser, or `{ get, set }`), or drive it from that component's own state. | **2**. Compiler: `LTC012` for a registry-known target; the runtime is the backstop for hand-authored and foreign elements |
| `InvalidTemplateError` | The `<template>` passed to `reconcile()` has other than exactly one root element. | Wrap the template content in a single root. | **2**. **No compiler rule and none needed** — a compiled `@for` template has one root by construction, so this only fires for a hand-authored `reconcile()` |
| `DependencyTimeoutError` | Required child custom elements were not defined within the timeout. | Make sure each is registered with `customElements.define()`, or raise the timeout. | **2** — *logged, never thrown*; effects run anyway, so the DOM may not be in the expected state |
| `UnsafeAttributeError` | `safeSetAttribute()` blocked an `on*` attribute name or an unsafe URL protocol. | Attach listeners with `on()`; use `http`, `https`, `ftp`, `mailto`, or `tel`. | **2**. Not decidable — it fires on runtime *data*, not source shape. The guarantee is that the write did **not** happen |
| Trusted Types violation | `dangerouslyBindInnerHTML` produced HTML the page's Trusted Types policy rejected. | Sanitize the value, or adjust the policy. | **3** — re-thrown from a microtask so the page's own error reporting sees it ([ADR 0010](../../../../adr/0010-trusted-types-support-via-sanitize-hook.md)) |

---

## Compiler diagnostics

Emitted by `server/compiler/diagnostics.ts` while compiling a component source — `.tsx` or `.tsrx`. **Errors** fail the build; **warnings** let it through and tell you what the output will do instead. Several conditions share one code where the author's fix is the same sentence. Codes are `LTC###` — the compiler-wide namespace — except the six `.tsrx`-grammar codes that keep `TSRX###`; see Retired idioms for why.

### Reactivity and the server/client split

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `LTC001` | `@for` over a reactive source that is not a declared `createList`. | Declare the source with `createList()`, or iterate server data. | warning — file skipped |
| `LTC002` | A reactive expression reads an `@for` loop variable directly. | Hoist the derived value into a `const` first. | error |
| `LTC003` | A hoisted `const` is read reactively but never rendered as a bare attribute, so the client cannot rebind it. | Render it (e.g. `aria-controls={id}`), or stop reading it reactively. | error |
| `LTC017` | A signal crosses a call the compiler cannot see inside, so it cannot tell whether the child is reactive. | Wrap the child in an explicit thunk. | error |
| `LTC033` | A **static** child or server-rendered attribute reads `Date`/`Intl`/`Math.random()`/a locale method — the *build machine's* clock, baked into the page permanently. | Make it reactive, or take the value as a server arg. | error |
| `LTC034` | `disabled`/`checked` on a submittable form control has no server-renderable value, and no server phase resolves the expression in any tier, so the attribute is omitted — leaving the control enabled-and-submittable (or unchecked) regardless of author intent. | Trace the value to a server-known prop or signal, or give the element an explicit static default. | error |
| `LTC044` | A signal's initializer conditionally chooses between two signal constructors — it must be a single, unconditional call. | Move the condition inside the callback (e.g. `deriveCell(() => cond ? a : b)`). | error |
| `LTC045` | A `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` call is deferred into a callback, so it runs after the factory's collector is gone and its effect never activates. | Call the helper directly in setup; move the deferred condition inside the effect. | error |
| `LTC046` | A setup `const` the server cannot evaluate — its initializer reads a client-only name (`first`/`all`/`watch`/`on`/`pass`/`requestContext`/`provideContexts`, a `first()`-bound ref, or `host`/`internals`) — has its **value** rendered into the markup. No tier can produce the static splice, and no client binding ever corrects one. | Render the site from a server arg or signal, or make the site reactive so the client's first binding pass supplies the value. | error |

Four conditions left this table in LT-165 ([ADR 0029](../../../../adr/0029-tiered-server-evaluation.md) § 5), because a shape the server cannot fold is a routing fact, not an author error. A signal with no harvestable render site (`LTC004`), a setup `const` calling a client-only primitive or a derived compute reading `host`/`internals` (`LTC013`), and a setup `const` reading a `first()`-bound ref (`LTC043`) are now **routing signals** recorded on the component's registry entry (`server/compiler/tier.ts`): they route the component to the Simulated tier and ride the build report's tier census instead of failing the build. The non-severe form of `LTC034` left the channel the same way. The **reactive** form of `LTC033` is silent for a different reason: the expression is *unresolvable*, so it is omitted from the initial HTML and the client's first binding pass supplies the value — no diagnostic, no flash.

### Element references

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `LTC025` | `first()` called with other than one or two string literals. | Selector alone for optional; selector + required-reason for required. | error |
| `LTC026` | A `first()`/`all()` selector matches nothing in the template, uses syntax the compiler cannot verify structurally, or is **malformed CSS**. | Correct the selector so it addresses a real, statically-addressable element. | error |
| `LTC027` | A `first()` selector matches several elements that are not mutually-exclusive `@if` branches. | Give the target a distinguishing `class`/`id`/`data-*`. On a composed element the attribute goes on the *compose site*. | error |
| `LTC040` | A **required** `first()` whose only match sits in a branch that may not render, so the reason can never be thrown. | Drop the required-reason string. | warning |
| `LTC041` | Two `first()` names resolve to the same element. | Use one name in both places, or distinguish the two elements. | error |

The selector rules are deliberately **one-sided**: `LTC026` reports only what no CSS parser accepts. A selector it passes is not thereby claimed valid — `InvalidSelectorError` remains the Tier 2 backstop.

### Props, `expose()`, and composition

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `LTC010` | `{host.validationMessage}` (or another managed form prop) without `formAssociated`. | Declare `export const config = { formAssociated: true }`, or expose a prop of that name. | error |
| `LTC011` | A composed (PascalCase) tag has no resolvable component import (`….tsrx` or `….tsx`), or the imported file did not compile. | Import the component, or fix the child's own diagnostics first. | error |
| `LTC012` | `pass={{ … }}` on a native or unregistered tag; a prop the target does not `expose()`; a prop the target exposes **read-only** or as a `defineMethod()`; a reactive attribute on a custom element; a compose-site `pass` with no `ref`. | Target a registry-known component and pass a prop it exposes from a *mutable* initializer. | error |
| `LTC028` | An `expose()` key is a reserved word / `Object` builtin, or shadows a member `formAssociated()` installs. | Rename the prop. | error |
| `LTC029` | A form-associated component's inner control carries a `name`, so the field submits twice. | Remove `name`; the host is the sole form participant. | error |
| `LTC032` | A destructured prop has a default but its type is not marked optional, so the default is unreachable. | Mark it `prop?:` in the props type. | error |
| `LTC039` | A Parser-exposed prop is *also* rendered from a same-named server arg — two seeding stories for one value. | Harvest from the site and drop the attribute. On a form-associated host, render the attribute too: it is the reset baseline. | warning |

**The read-only trap.** `expose({ x: sig.get })` is read-only however mutable `sig` is — a bare `.get` is neither a signal nor a descriptor, so it is wrapped in a computed and gets a plain getter, not a Slot. That is the most common `expose()` shape in the corpus, and `pass()` cannot target it. Expose a value, a Parser, or `{ get, set }` if the prop is meant to be driven from outside.

### Template structure

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `LTC030` | `<textarea value={…}>` — not a real attribute; the browser ignores it. | Set the initial value as text content. | error |
| `LTC035` | A literal `id` repeats across `@try`/`@catch`/`@pending` arms, which all render at once. | Give each arm's element a distinct id. | error |
| `LTC038` | The same static `id` on more than one compose site. | Distinct ids, or address the instances by class. | error |
| `LTC042` | A constant `id` in a template duplicates the moment a page places the component twice, breaking `aria-labelledby`/`<label for>`. | Take the id as a server arg with a default and render it from there. | warning |
| `LTC047` | Literal prose — any run of two or more adjacent letters — sits in a template of a component that declares `export const i18n`, so it ships untranslatable. | Declare a key with this string as its source-locale value in `export const i18n` and render `{t.<key>}` here. | warning |

### Source shape and imports

| Code | What fired | How to fix | Severity |
|---|---|---|---|
| `LTC005` | A construct outside the sanctioned subset. | Rewrite it with a supported construct. | error |
| `LTC006` | An attribute shape the classifier does not accept. | Follow the message's suggested form. | error |
| `LTC007` | An element the generated client cannot address deterministically. | Give it a stable, distinguishing attribute. | error |
| `LTC008` | A source-level violation: root tag, exports, style placement, an `async` component function. | Follow the message; a component function must be synchronous. | error |
| `LTC009` | An invalid `export const config` extension declaration. | Correct the declaration. | error |
| `LTC014` | A plain import whose bindings are never referenced, so it would be dropped from both generated modules. | Remove it, or use it. | warning |
| `LTC015` | `requestContext()` called with other than exactly two arguments. | `requestContext(context, fallback)` — the fallback is what the server renders. | error |
| `LTC016` | `requestContext()`'s fallback references a name the server cannot resolve. | Use a literal or an expression over server args/setup. | error |
| `LTC036` | A real `@zeix/le-truc` export used without importing it. | Add the import. Factory-context helpers are ambient and need none. | error |
| `LTC037` | Factory-context vocabulary (`expose`, `first`, `host`, …) named in an import. | Remove it from the import line. | error |
| `LTC048` | One component tag is declared by more than one corpus source, and the sources are not one folder-local variant set — two sources of the same surface, or spellings in different folders or under different base names. All the files are dropped from the generated output. | Keep at most one source per surface (`.tsrx`, `.tsx`) for a tag, with one base name in one directory: delete the extra, move the spellings together, or rename one tag. | error |
| `LTC049` | The typed factory-context parameter destructures a name that is not FactoryContext vocabulary, or is not a destructured object at all — the generated client would inherit a name that does not exist. | Destructure only `host`, `first`, `all`, `expose`, `watch`, `on`, `pass`, `internals`, `requestContext`, `provideContexts` — e.g. `, { host, expose }: FactoryContext<MyProps>`. | error |
| `LTC050` | The factory-context annotation's surface disagrees with the component: `config.formAssociated` set but plain `FactoryContext` annotated — `host` is missing the managed form members — or `FormFactoryContext` annotated without it. | Annotate `FormFactoryContext<MyProps>` for a form-associated component; `FactoryContext<MyProps>` otherwise. | error |
| `LTC051` | The compiled members of a variant set produce different CSS. The build writes one stylesheet for the whole set, so it writes no artifact of the set. | Make the styles byte-identical in every member: copy the served member's styles into the others. | error |
| `LTC052` | A `@for` over server data has a `key` clause. Only a `@for` over a declared `createList(…)` signal reconciles its items by key, so the key has no effect. | Remove the `key` clause, or declare the items with `createList(…)` if they must be keyed. | error |

### Retired idioms

`TSRX018` (`&{…}` lazy-child sigil) and `LTC019` (`{'prop'}` string-literal prop child) are retired `.tsrx` forms. `TSRX020` (lazy destructuring in binding position) is **retired at the 0.2 pin**: `@tsrx/core` 0.2 dropped the construct from the grammar, so `&{ … }`/`&[ … ]` no longer parse and fail as `LTC008` — same tier-1 guarantee, one link earlier. `TSRX021`–`TSRX024` are the React idioms — `{cond && …}`, `{cond ? … : …}`, `.map()`, and `return (<>…</>)`. None of them fails loudly on its own: a `.tsrx` compiler renders each one **literally**, stringified. Each message names the `.tsrx` construct to use instead (`@if`, `@if`/`@else`, `@for`, a bare trailing expression).

**Why this family keeps the `TSRX` prefix:** `TSRX018`, `TSRX020` and `TSRX021`–`TSRX024` diagnose `.tsrx` grammar and have no `.tsx` counterpart — the React idioms are `.tsx`'s *correct* spellings ([ADR 0032](../../../../adr/0032-adopt-tsx-as-the-authored-component-surface.md) s6), so those rules are in force for `.tsrx` sources only, a `.tsx` author never meets them, and none of them is in the published package. `LTC019` took the `LTC` prefix because the shared machinery owns it, like every other renamed code. Full disposition: `server/compiler/VOCABULARY_LEDGER.md`.

`LTC031` is **retired**. No builder emits it; per-branch addressing replaced the rule.

`LTC004`, `LTC013`, and `LTC043` are **retired** the same way — no builder emits them. Tiered server evaluation ([ADR 0029](../../../../adr/0029-tiered-server-evaluation.md) § 5) replaced the refusal with routing signals; see the note under the reactivity table above for where those conditions surface now.

---

## Related

- `workflows/debug.md` — start there when the symptom is behavioral rather than a named error
- [ADR 0028](../../../../adr/0028-tiered-error-surfacing.md) — the tier contract
- [ADR 0004](../../../../adr/0004-slot-based-signal-swapping-for-inter-component-binding.md) — why `pass()` needs a Slot
- [ADR 0018](../../../../adr/0018-implicit-effect-collection-via-ambient-context.md) — why a deferred helper call has no collector
