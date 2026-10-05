# Compiled component sources (`.tsx`, `.tsrx`)

A compiled source is one component written once. The compiler turns it into a server render (the initial HTML) and a client factory (a `defineComponent` call). `.tsx` is the default surface for new components. `.tsrx` stays supported where statement-shaped control flow (`@if`/`@for`/`@switch`/`@try` blocks with statements before their output) reads better. Both surfaces follow the rules below and report `LTC0NN` diagnostics. A few `.tsrx`-only grammar rules keep `TSRX0NN` codes. See `errors.md`.

How the compiler is installed and invoked is project setup and not settled as a public API. Don't invent import paths or commands for it.

## Module shape (`.tsx`)

```tsx
import { asBoolean, type FactoryContext } from '@zeix/le-truc'

export type MyToggleProps = { pressed: boolean }
declare global { interface HTMLElementTagNameMap { 'my-toggle': HTMLElement & MyToggleProps } }

export function MyToggle(
  { label, pressed = false }: { label: string; pressed?: boolean }, // server args
  { host, expose }: FactoryContext<MyToggleProps>, // typed factory context
) {
  expose({ pressed: asBoolean() })
  return (
    <my-toggle pressed={pressed}>
      <button type="button" aria-pressed={() => String(host.pressed)}
        onClick={() => ({ pressed: !host.pressed })}>{label}</button>
      <style>{css`:host { display: inline-block; }`}</style>
    </my-toggle>
  )
}
```

- **Parameter 1 holds the server args.** Its type is what a composing parent's JSX checks against.
- **Parameter 2 is the typed factory context.** Annotate it `FactoryContext<Props>`, or `FormFactoryContext<Props>` when `export const config = { formAssociated: true }`. The annotation makes `watch`/`on`/`pass` prop-key-precise and turns a mistyped `expose()` key into a `tsc` error. Destructure every factory name you use from it. If you name the wrong context type, that's LTC050. A name that isn't factory vocabulary is LTC049. If you leave the parameter out, you get loosely typed ambients. An unannotated parameter is an implicit-`any` error under strict mode.
- **Statements before `return` are setup.** They run on the client as the factory body. Server-evaluable parts also feed the server render.
- **The root element is the host**, spelled as the component's own tag. Its tag name *is* the component's name: renaming the function changes nothing, renaming the tag breaks things. A `<>…</>` fragment root fails the compile (LTC060), whatever it wraps. The stylesheet is a `<style>` child of the root.
- **The stylesheet is a `<style>` child of the root** holding a `css`-tagged template literal. `${}` substitution inside it is a compile error. Write only one: a second `<style>` in the root, or one nested deeper, fails the compile (LTC073). See `styling.md`.
- Real `@zeix/le-truc` exports (parsers, `createCell`, `defineMethod`, `isPending`, `bind*`) must be imported (LTC036). Factory vocabulary (`host`, `first`, `expose`, …) must **not** be imported (LTC037).
- Attributes are spelled `class` and `for`. `className`/`htmlFor` are type errors. There is no `{count}` shorthand in `.tsx`: write `count={count}`.

## Reactive vs. server-rendered values

- **An arrow makes a value reactive.** `class={() => (isPending(data) ? 'pending' : null)}` re-binds on the client. A bare expression (`class={x ? 'a' : 'b'}`) is rendered once on the server and **never updates**. The same rule covers text children (`{() => …}`) and attributes.
- `{host.prop}` as a child renders empty on the server and binds on connect. For a value the server knows, render it from the server arg (`{label}`) and harvest it back in `expose()` (`label: labelEl?.textContent ?? ''`). One site serves as render target, harvest source and binding target. A Parser-exposed prop that is *also* rendered from a same-named arg warns (LTC039).
- `on*` attributes (`onClick`, `onInput`, …) lower to `on()`. Returning `{ prop: value }` updates the host, as it does in the runtime form.
- Values that depend on when or where the page is viewed have no server answer: the clock, `Math.random()`, `crypto` RNG, the runtime default locale, layout, `matchMedia`. Inside a reactive thunk they are left out of the initial HTML, and the client fills them in. In a static position they are refused (LTC033). Page globals (`document`, `window`, `location`, storage) in any server-evaluated position are LTC054. Read them in `watch()` or a handler instead.
- If a shape can't be folded at build time, the component moves to a slower server-evaluation tier, but that's not an error. Don't contort a component's public surface to avoid it. A `disabled`/`checked` attribute on a submittable control that no tier can resolve is the exception (LTC034). Give it a static or server-rendered default.

## Conditions and lists

- **A condition that reads a signal or `host` switches template-cloned arms.** That covers a ternary, `&&`, a `switch` IIFE (`.tsx`), and `@if`/`@switch` (`.tsrx`). Only the winning arm is live. Its root carries `data-key` (`then`/`else`/`case:<value>`/`default`), and every arm also ships as an inert `<template>`. Flipping the condition clones a fresh arm, so **uncommitted input in an arm is lost**, and arm effects die with the arm. Rules:
  - Each arm has exactly one root element.
  - The condition sits directly in an element of the host, an arm or a list item, not in a server-rendered branch, a server-data loop body or composed content (LTC005). Conditions and lists nest inside arms and list items.
  - Reactive `case` values are literals with distinct keys (LTC062).
  - A reactive list's container cannot hold a reactive condition or an async boundary (LTC063).
  - `first()` cannot target an element inside an arm, because the element is recreated on every flip.
- **To keep DOM across a toggle**, use `hidden={() => …}` instead of a condition.
- A condition on server-known values only is rendered once on the server.
- **Loops**: `.map()` in `.tsx`, `@for` in `.tsrx`.
  - Over server data, the loop renders once, and each item gets `each()` bindings.
  - Over a declared `createList(…)` or `deriveList(…)` signal, it reconciles by key on the client. The item is the item's signal: read it in an arrow (`{() => item.get()}`); `.tsrx`'s bare `{item}` is its shorthand.
  - Over a list, `.tsx`'s second `.map()` parameter is the item's stable key, not an index: `items.map((item, k) => … items.remove(k) …)`. `.tsrx` binds it with `key k`. Over an Array it stays the index.
  - Over any other reactive source, it's not supported (LTC001 skips the file).
  - Hoist values derived from a loop variable into a `const` before a reactive read (LTC002).
  - A `.tsrx` `key` clause is meaningful only over a `createList` (LTC052).
- **Empty state**: `{items.length === 0 ? <empty/> : items.map(…)}` in `.tsx`, `@for … @empty` in `.tsrx`. A `.map()` in any other conditional arm is LTC005. Over a list, the empty state may carry reactive attributes, class and style maps, events and lazy text.
- **Async boundary**: `<truc:try pending={…} catch={e => …}>` in `.tsx`, `@try`/`@pending`/`@catch` in `.tsrx`. It has three arms (`ok`/`nil`/`err`) and **no `stale` arm**. A re-fetching task keeps its `ok` arm, whose content is not re-rendered. Show in-flight state with an `isPending(task)` arrow beside the boundary. `catch` receives an `Error`. With `catch` alone, it's an error boundary.
- Authored `<template>` (LTC061) and `<script>` (LTC056) elements are refused. Dynamic tags are refused too (LTC053). Choose between static tags with a conditional.

## Composition

- A composed child is written PascalCase and **imported from its source module** (LTC011). A lowercase dashed tag is a raw custom element.
- **`truc:pass={{ prop: () => host.x }}`** lowers to `pass()`. Same rules as the runtime form (`coordination.md`). The child declares `'truc:pass'?: { prop?: () => T }` in its args type, so `tsc` rejects excess keys. A function-valued attribute on a custom element binds nothing (LTC012). Use `truc:pass`.
- Address a composed child with `first('child-tag.discriminator')`, never by its PascalCase name. A compose site's `class`/`id`/literal `data-*` attributes reach the rendered child root and act as discriminators. Ambiguous matches are LTC027.
- `class`/`id`/`data-*` on a compose site are host attributes, never forwarded as server args.
- **Ids belong to whoever instantiates the component.** A constant `id` in a template breaks `<label for>`/`aria-*` on the second instance (LTC042). Take the id as a server arg with a default, and wire every reference from it.

## Element references

- There is no `ref={}`. Declare `const el = first(selector, reason?)`. The selector is checked against the template at compile time: it must match (LTC026), be unambiguous (LTC027), and not alias another name (LTC041). The call is `first('sel')` or `first('sel', 'reason')` with string literals (LTC025).
- A required reference whose only match may not render is LTC040. Drop the reason.

## i18n

- Declare `export const i18n = { key: 'ICU MF1 pattern', … } as const`. Destructure `i18n: { t }` from the **server args** (not the factory context), typed `i18n: I18n<typeof i18n>`. Callers never pass `i18n`.
- A pattern without `{` types as `string`. One with `{` is a call: `t.tasks({ count })`. Plurals, `select` and number/date formatting live in the pattern. When the markup itself differs per case, use a condition. Without `as const`, every key widens and the first use fails `tsc`.
- Literal prose (two or more adjacent letters) in a component that declares `i18n` warns (LTC047). Pattern or argument mismatches are LTC055.
- `t.key` and `t['a.b']` reads also compile in client positions (thunks, handlers, `expose()`). The server serializes only the keys the render locale changes into a root `i18n` attribute. Computed `t[key]`, a bare `t`, `i18n.t.key` and `lang` are server-only (LTC005). The client reads the locale as `host.lang`. An instance created outside a compiled parent's render shows source strings.
- `lang` is a built-in property, so it can't be exposed. Treat it as a config attribute.

## Variant sets

A folder may hold several spellings of one tag (`.ts`, `.tsx`, `.tsrx`) with the same base name. The build compiles every one, requires byte-identical CSS (LTC051), and serves one surface (`.tsx` by default). Each member declares its own `HTMLElementTagNameMap` entry, and diverging Props types between members are a TS 2717 error. Any other pair of sources declaring one tag fails the build (LTC048). To migrate a tag to `.tsx`, add the `.tsx` beside the existing source rather than replacing it.
