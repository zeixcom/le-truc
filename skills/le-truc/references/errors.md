# Errors and diagnostics

Each row says what fired, why, how to fix it, and its tier. The message itself names the specifics, so the rows don't repeat it. The source of truth is `src/errors.ts` for runtime classes and the compiler's diagnostics module for codes.

## Tiers

| Tier | What you see | What it means |
|---|---|---|
| **1 Prevented** | a compiler error, `LTC0NN` (or `TSRX0NN` for a `.tsrx`-grammar rule). The build fails. | Nothing shipped. Fix the source. |
| **2 Contained** | one `console.error` naming the component and the phase, or a compiler **warning** | **The page is fine.** At runtime, the component did not enhance (or one of its effects didn't activate) and keeps its server markup. Other components are unaffected. |
| **3 Escalated** | an uncaught exception | Only `defineComponent()` at module evaluation, and a Trusted Types rejection in an HTML sink. |

There are two Tier 2 shapes at runtime:

- **Factory failure**: the whole component is inert. Example: `Connect failed in <x-y> while running …`.
- **Activation failure**: one effect didn't activate and the others did. Example: `watch() failed to activate in …`. The component is *partially enhanced*, and the named helper is the fastest route to the cause. A list item or a conditional arm reports in its own words, named by its key: `reconcile() item "a" did not activate in <ul>` means that item's `bindItem` threw (`reconcile() arm "then"` means a `bindArm` threw). The element stays in place, unbound. The other items are unaffected; a failed arm stays unbound until the condition switches, and the next arm mounts afresh. The error logged after the message is the cause.

## Runtime error classes

| Class | What fired, and why | Fix | Tier |
|---|---|---|---|
| `InvalidComponentNameError` | `defineComponent()` got an invalid custom-element name | lowercase, with a hyphen | 3 (module evaluation). Compiler: LTC008 |
| `ExtensionCollisionError` | two extensions declare the same static key (e.g. `formAssociated()` + `formAssociatedCheckbox()`) | drop one | 3, DEV_MODE only. Production: first wins, silently |
| `InvalidPropertyNameError` | an `expose()` key is a reserved word or `Object` builtin, or a member an extension manages (`form`, `name`, `validity`, `defaultValue`, `debug` in dev, …) | rename the prop | 2. Compiler: LTC028 |
| `MissingElementError` | `first()`/`all()`/`query()` with a required reason matched nothing | add the element, or drop the reason to make it optional | 2. Compiler: LTC026/LTC040 |
| `InvalidSelectorError` | a malformed selector given to `all()`/`queryAll()` | fix the selector. Until it parses, the list stays empty | 2. Compiler: LTC026 |
| `NoActiveCollectorError` | `watch`/`on`/`pass`/`each`/`reconcile`/`provideContexts` called outside synchronous setup (after `await`, in a callback) | call it in setup, and move the condition inside the effect | 2. Compiler: LTC045, LTC008 (`async` component) |
| `InvalidCustomElementError` | the `pass()` target is not a custom element | target a Le Truc component, or use `watch` + `bindProperty` | 2. Compiler: LTC012 |
| `InvalidReactivesError` | the second argument to `pass()` is not a record | pass an object literal of thunks or `{ get, set }` | 2. Types catch it |
| `InvalidPassPropertyError` | a passed prop is absent on the target, is a retired form (property key, bare signal), or is not Slot-backed (read-only, a method, a non-Le-Truc element). The message lists each failing prop. Nothing is swapped. | a thunk or `{ get, set }`, and expose the target prop from a mutable initializer. Or `watch` + `bindProperty` | 2. Compiler: LTC012 for known targets |
| `InvalidTemplateError` | a `reconcile()` template doesn't have exactly one root element, or the arm form got no templates | one root per template | 2. Compiled templates can't hit this |
| `DependencyTimeoutError` | queried child custom elements were not defined within 200 ms | define them (`customElements.define`), including CSS-only ones. The timeout is fixed | 2, **logged**. Effects run anyway |
| `UnsafeAttributeError` | `safeSetAttribute`/`bindAttribute` refused an `on*` name or a URL protocol other than `http`, `https`, `ftp`, `mailto`, `tel` | use `on()` for listeners, and use safe URLs | 2. Runtime data, not decidable at build time. The write did not happen |
| `HarvestWitnessError` | the server render of a compiled component reached the keys of a list harvested through a key alias incompletely: a key missing (a group the server gated off), out of list order, or not in the list. The client rebuilds the list from the rendered items only | render every item of the list once at the alias scope, in the list's order | Server render: fails the build under static generation and the realm. Compiler: LTC080 for the static half |
| Trusted Types violation | an HTML sink (`dangerouslyBindInnerHTML`, compiled `truc:html`) produced a string the page's policy rejects. An unconfigured `truc:html` escapes to a plain string and fails too | `configureHtmlSanitizer()` with a sanitizer returning `TrustedHTML` (DOMPurify `RETURN_TRUSTED_TYPE: true`), once per realm | 3, re-thrown from a microtask, by design |

These signal errors are re-exported from `@zeix/cause-effect`:

- `ReadonlySignalError`: something wrote to a read-only prop. Either `{ get }` was given without `set`, or a getter-only `pass()` is overwriting the child's own writes.
- `NullishSignalValueError`: something assigned `null`/`undefined` to a prop.
- `UnsetSignalValueError`: something read a task that has no value yet. Inside `watch`, this routes to `nil`.
- `CircularDependencyError`: a signal depends on itself.

## Compiler diagnostics

Errors are tier 1. **W** marks a warning: the build continues and the warning tells you what the output does instead. Codes are surface-neutral (`.tsx` and `.tsrx`) unless the row says otherwise.

### Reactivity and the server/client split

| Code | What fired, and why | Fix |
|---|---|---|
| LTC001 **W** | a loop over a reactive source that is not a declared `createList` or `deriveList`. Only lists reconcile. **The file is skipped.** | declare the source with `createList(…)` or `deriveList(…)`, or loop over server data |
| LTC002 | a reactive read of a loop variable | hoist the derived value into a `const` first |
| LTC003 | a hoisted `const` read reactively but never rendered as a plain attribute, so the client can't rebind it | render it (e.g. `aria-controls={id}`), or stop reading it reactively |
| LTC017 | a signal crosses a call the compiler can't see into, so its reactivity can't be traced | wrap the child in an explicit thunk |
| LTC033 | a static child, a server-rendered attribute or a server-data loop's items read the clock, the RNG, `Intl` or a locale method. The build machine's value would be baked in. | make it reactive, or take it as a server arg |
| LTC034 | `disabled`/`checked` on a submittable control has a value no server phase can resolve, so the no-JS control would be enabled or unchecked | trace it to a server-known value, or give a static default |
| LTC044 | a signal initializer conditionally chooses between two constructors | one unconditional call, with the condition inside (`deriveCell(() => c ? a : b)`) |
| LTC045 | an effect helper deferred into a callback. At connect it would throw `NoActiveCollectorError`. | call it in setup, with the condition inside the effect |
| LTC046 | a setup `const` whose value is rendered into markup reads a client-only name (`first`, `host`, `internals`, a ref, …). No tier can produce it, and no binding corrects a static site. | compute it from an arg or signal, or make each site that reads it reactive |
| LTC059 | a signal seeded from an arg renders only as formatted text (`Intl`, `toLocaleString()`, a message with a number or date argument). Formatted text doesn't parse back, so the client can't seed from it | render the raw value beside the text, reactive: `<data value={() => n.get()}>`, `<time datetime={() => d.get()}>`, or render the arg as a host attribute |
| LTC054 | a position the server evaluates reads page context (`document`, `window`, `location`, storage, …), or the `i18n` record is destructured for a member it doesn't have (or with a rest element) | pass the value as an arg, or read it in `watch()`/a handler. Destructure only `lang`, `t`, `timeZone`, `currency`, `dir` |

### Element references

| Code | What fired, and why | Fix |
|---|---|---|
| LTC025 | `first()` called with something other than one or two string literals | `first('sel')` (optional) or `first('sel', 'reason')` (required) |
| LTC026 | a `first()`/`all()` selector matches nothing in the template, can't be verified structurally, or is malformed CSS | address a real, statically addressable element |
| LTC027 | a `first()` selector matches several elements that aren't exclusive branches of one condition | add a distinguishing `class`/`id`/`data-*`. For a composed child, put it on the compose site |
| LTC040 **W** | a **required** `first()` whose only match sits in a branch that may not render | drop the reason string |
| LTC041 | two `first()` names resolve to the same element | use one name, or distinguish the elements |

### Props, `expose()` and composition

| Code | What fired, and why | Fix |
|---|---|---|
| LTC010 | a managed form prop (`host.validationMessage`, …) used without `formAssociated` | `export const config = { formAssociated: true }`, or expose a prop with that name |
| LTC011 | a PascalCase tag with no matching import of a `.tsx`/`.tsrx` module, or the imported file did not compile, or a construct inside or around a composed element that composition doesn't support yet | import the component, fix the child's own diagnostics first, or move the construct into the child |
| LTC012 | `truc:pass` on a native or unknown tag; a passed prop the target doesn't expose; a target prop exposed read-only or as `defineMethod()`; a function-valued attribute on a custom element (which binds nothing) | target a known component and a prop exposed from a mutable initializer. Call methods from a handler. Use `truc:pass` instead of a reactive attribute |
| LTC028 | an `expose()` key is a reserved word or builtin, or shadows a member `formAssociated()` manages | rename the prop |
| LTC029 | a form-associated component's inner control has `name`, so the field would submit twice | remove `name`. The host is the participant |
| LTC032 | a destructured arg has a default, but its type isn't optional | mark it `prop?:` |
| LTC039 **W** | a Parser-exposed prop is also rendered into an owned site from a same-named arg, giving two seeding channels | harvest from the site and drop the attribute. On a form-associated host, keep it (it's the reset baseline) |
| LTC049 | the typed context parameter destructures a name that isn't factory vocabulary, or isn't a destructuring pattern | destructure only `host`, `first`, `all`, `expose`, `watch`, `on`, `pass`, `internals`, `requestContext`, `provideContexts` |
| LTC050 | the context annotation disagrees with `config.formAssociated` | `FormFactoryContext<Props>` when form-associated, `FactoryContext<Props>` otherwise |

### Template structure

| Code | What fired, and why | Fix |
|---|---|---|
| LTC030 | `<textarea value={…}>`, which is not an attribute the browser reads | put the value in the text content |
| LTC038 | the same static `id` on several compose sites | distinct ids, or address instances by class |
| LTC042 **W** | a constant `id` in a template duplicates when the component appears twice, which breaks `for`/`aria-*` | take the id as an arg with a default |
| LTC047 **W** | literal prose (two or more adjacent letters) in a component that declares `i18n` | add a message key, and render `{t.key}` |
| LTC052 | a `.tsrx` `@for` over server data has a `key` clause, which only a `createList` loop reads | remove `key`, or declare the items with `createList` |
| LTC053 | a tag that isn't a static name (`.tsrx` `<{expr}>`, an unknown `.tsx` namespaced or member tag), or a boundary placed directly as a loop body's root | choose between static tags with a conditional. Wrap the boundary in an element |
| LTC055 | an `i18n` pattern that isn't valid ICU MF1, or a `t.key` site that disagrees with its pattern (missing or extra args, args not one object literal, an arg message read without a call, a plain message called) | fix the pattern (quote literal `{`, `}`, `#` with apostrophes), or pass exactly the args it reads |
| LTC056 | a `<script>` in a template, whatever its type | move it to the page, or do the work in setup |
| LTC060 | the template output is a fragment (`<>…</>`). The root is the host element; there is no fragment root | drop the fragment so that the host element is the root; put a stylesheet inside the root as a `<style>` child |
| LTC073 | a `<style>` that isn't the root's first direct `<style>` child: a second one in the root, or one nested in a descendant. Its CSS would be dropped | merge its rules into the root's single `<style>` child |
| LTC078 | a `<style>` block whose content is not a stylesheet: in `.tsx`, another tag, a `css` that is not the marker (not imported from `@zeix/le-truc-compiler/macros`, or shadowed by a local), a `${}` substitution, or any other expression; in `.tsrx`, an expression instead of CSS text. The component would ship no CSS | write ``<style>{css`…`}</style>`` with `css` imported from `@zeix/le-truc-compiler/macros`; move dynamic values into custom properties read with `var()` |
| LTC061 | an authored `<template>` in a template. The compiler emits its own. | render directly, or use a list or condition |
| LTC062 | a reactive switch has a non-literal `case` value, or two values with the same key | string, number, boolean or `null` literals, one arm each |
| LTC063 | a reactive condition or async boundary inside a reactive list's container, which the list clears | move it out, or wrap the loop in its own element |
| LTC074 | an element beside a reactive-list loop in the list's container, directly or as an arm root (any arm) of a conditional that reads no signal or of a `try` without a pending arm, carrying no `data-unreconciled` — the list removes it on its first run. An authored `data-key` does not exempt it. A composed element cannot carry the attribute | add `data-unreconciled` to keep the element, or move it out of the container |
| LTC075 | a composed element in a reactive-list item whose args or content read the item or key binding. The server renders the child once, into the `<template>` that every item clones | pass the value through `truc:pass`, or give the child only server-known values |
| LTC072 | a field of a list item seeded from server args renders nowhere in the item: no text child or reactive attribute reads exactly the field, and `keyConfig` doesn't return it. The client rebuilds each server-rendered item from its markup | render the raw value in the item, reading exactly the field: `data-<field>={() => …}` on the item root, or `<data value={() => …}>` |
| LTC076 | a field of a list item seeded from server args has no parser: its type isn't `string`, a string-literal union, `number` or `boolean` (a `Date`, an object, an optional `?:` field), or the item type is imported and no `harvest()` map lists the fields | declare the parser on the seed: `createList(harvest(items, { due: … }), …)`, with `harvest` imported from `@zeix/le-truc-compiler/macros` |
| LTC080 | a host-level list seeded from server args, rendered only through another list's items, is read with `list.byKey(k)` in item setup in a way the client cannot rebuild it from: the aliasing list doesn't key each item by itself; the read isn't `const t = list.byKey(k)` over the loop key as its own statement; a second alias exists; or a field renders nowhere in the alias scope | key the aliasing list by its item (`keyConfig: s => s`), declare one alias over the loop key, and render every field through `t.get().<field>` in that item |
| LTC077 | a signal is harvested from its render site but its seed's type isn't one the compiler reads (`string`, `number`, `boolean` — an alias, a union or an imported type), so it would connect as a string | declare the parser on the seed: `createState(harvest(value, asNumber()))`, with `harvest` imported from `@zeix/le-truc-compiler/macros` |

### Stylesheet

| Code | What fired, and why | Fix |
|---|---|---|
| LTC064 | the stylesheet doesn't parse | fix the CSS syntax at the reported line |
| LTC065 **W** | an unknown property, or a value outside the property's grammar. Custom properties and `var()`/`env()` are not checked. This one is tier 2: the dictionary lags the platform. | fix a typo. If the CSS is just newer than the dictionary, leave it. It ships as written |
| LTC066 | a rule led by the component's own tag, which would address a nested element, never the host | `:host { … }`, and drop the tag from selectors for internals |
| LTC067 | `::slotted()`, but compiled components are light DOM, with no slots | style composed children's hosts by tag |
| LTC068 | `:host-context()`, which is removed from the spec and matches nothing | inheritance and custom properties |
| LTC069 | `:global` in a form other than a top-level `:global(<whole selector>)` rule or a bare `:global { … }` block (nested, prefixed, trailing, leading-ancestor, mid-selector, or declarations directly in the bare block) | hoist to one of the two admitted forms. Use bare selectors for internals |
| LTC070 | `:host.x`, `:host:hover`, `:host[attr]`. A compound on bare `:host` matches nothing. | `:host(.x)`, `:host(:hover)`, `:host([attr])` |
| LTC071 | a selector reaches inside a custom element this component renders (`child-tag .x`, `child-tag > .x`). The scope stops at the child, so the rule matches nothing. | style it from the child's own sheet, or use a top-level `:global { … }` for a page-level rule |
| LTC051 | the members of a variant set compile to different CSS, so none of the set's artifacts are written. **Two faces:** the authored styles differ, or the styles are the same but the members render different custom elements, so the scope stops at different boundaries | copy the served member's styles into the others, or make every member render the same custom elements |

### Source shape, imports and the corpus

| Code | What fired, and why | Fix |
|---|---|---|
| LTC005 | a construct outside the supported subset. **Server-only face:** a client position (reactive text or attribute, handler, class/style map, `truc:html`, `pass`/`expose()` entry, signal initializer, list body) reads a name the client doesn't bind: a component arg, a module-level declaration, a server-loop binding, or (in a list body) a setup const or import. That includes `t` used other than as a literal key, `i18n.t.key`, and `lang` (use `host.lang`). **Condition face:** an `@if`/`@switch` test (or `.tsx` ternary) reading a live setup alias of a signal or `host` — a function reading it, a bare alias, a method reference without the call. An eager snapshot const (`const snapshot = open.get()`) is one server value and compiles; a loop binding (item, index, key, a hoisted per-item `const`) shadowing a same-named signal is the binding, not the signal. **Arm/branch faces:** a reactive condition nested in another branch, composed content or a loop body; an arm with other than one root; a loop inside an `if`/`switch` branch; a `.map()` in a conditional arm other than the empty-state shape; a client construct on an element in a server-rendered branch of a reactive-list item (the branch roots and a nested list's branch-held container included — make the condition reactive, which plans an arm set in the item); a `truc:pass` onto a composed child in a server-rendered branch, of a reactive-list item or the host (make the condition reactive, so the composed child renders as its arm's root — a pass-less composed child in a branch stays legal). | follow the fix in the message. Read values through an exposed prop or the DOM. Move module values into setup |
| LTC006 | an attribute shape the classifier rejects, including Svelte-style `class:x={…}` and a `truc:` name other than `truc:pass`/`truc:html` (`truc:case` is retired) | the suggested form, e.g. a class map `class={() => ({ x: v })}` |
| LTC007 | an element the client can't address deterministically | add a stable distinguishing attribute |
| LTC008 | a source-level violation: root tag, exports, style placement, an `async` component function, or a parse error (including `.tsrx` lazy destructuring `&{ … }`, dropped from the grammar) | follow the message. Component functions are synchronous |
| LTC009 | an invalid `export const config` | correct the declaration |
| LTC014 **W** | a plain import whose bindings are never used, which would be dropped from the output | remove it, or use it |
| LTC015 | `requestContext()` called without exactly two arguments | `requestContext(context, fallback)`. The server renders the fallback |
| LTC016 | the `requestContext()` fallback isn't server-known | a literal, or an expression over args or setup |
| LTC036 | a real `@zeix/le-truc` export used without importing it | add the import |
| LTC037 | factory vocabulary (`host`, `expose`, `first`, …) in an import | remove it from the import |
| LTC048 | one tag declared by several sources that aren't one folder-local variant set (same surface twice, different folders, different base names). All are dropped. | one source per surface per tag, same base name, same directory |
| LTC019 | `{'prop'}` in child position. It renders the literal string. | `{host.prop}` |

### `.tsrx`-only grammar (`TSRX0NN`)

These rules have no `.tsx` counterpart. In `.tsx`, the React shapes below are the *correct* spellings.

| Code | What fired, and why | Fix |
|---|---|---|
| TSRX018 | an `&{expr}` sigil in a template child. It has no meaning, since the compiler decides reactivity. | drop the `&`: `{expr}` |
| TSRX021 | `{cond && <x/>}`, which renders literally in `.tsrx` | `@if (cond) { … }` |
| TSRX022 | `{cond ? <a/> : <b/>}`, which renders literally | `@if (…) { … } @else { … }` |
| TSRX023 | `{items.map(…)}` producing markup, which renders literally | `@for (const item of items) { … }` |
| TSRX024 | `return (<>…</>)` in setup | drop `return`, and keep the markup as the trailing expression |

### Retired codes (never emitted)

LTC004, LTC013, LTC031, LTC035, LTC043 and TSRX020 are spent numbers. LTC004, LTC013 and LTC043 became routing signals that pick a slower server-evaluation tier. LTC035 retired because non-winning arms are templates, so ids repeated across arms no longer collide. TSRX020's construct no longer parses (LTC008).
