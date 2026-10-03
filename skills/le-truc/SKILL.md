---
name: le-truc
description: Non-obvious facts and rules for building, reviewing and debugging Web Components with @zeix/le-truc — the defineComponent factory, expose()/watch()/on()/pass(), parsers, context, form association, compiled .tsx/.tsrx component sources, and LTC/TSRX build diagnostics or Le Truc runtime errors. Use whenever code imports @zeix/le-truc or a component source declares a Le Truc custom element.
---

# Le Truc

Le Truc enhances **server-rendered** custom elements with signals. It never renders a component's initial HTML on the client: the markup is already correct before JavaScript runs, and the component binds to it. Most of the API is clear from the exported signatures and JSDoc (`types/`, `src/`). This skill covers what a competent developer would still get wrong.

`@zeix/le-truc` re-exports the whole `@zeix/cause-effect` signal API (`createCell`, `deriveCell`, `createList`, `createTask`, `batch`, `match`, `isPending`, …). Install nothing else for signals.

## Two authoring surfaces

- **Runtime factory (`.ts`)**: `defineComponent<Props>(tag, factory, extensions?)` from `@zeix/le-truc`. This is the runtime API, and the only way to define a component by hand.
- **Compiled component sources (`.tsx` by default, `.tsrx` also supported)**: one exported function whose template renders the server HTML and whose setup becomes the client factory. Both surfaces share one set of rules and one diagnostic family (`LTC0NN`). See `references/compiled.md`. The compiler's packaging and entry points are not settled yet, so don't assume an import path or CLI for it. Follow the setup the project already has.

## The factory form

```ts
type CounterProps = { count: number }   // `type`, never `interface` (see runtime.md)

defineComponent<CounterProps>('basic-counter', ({ expose, first, host, on, watch }) => {
  const button = first('button', 'Add a native <button>.')
  const count = first('.count')
  expose({ count: asInteger(Number(count?.textContent) || 0) })
  on(button, 'click', () => ({ count: host.count + 1 }))
  if (count) watch('count', bindText(count))
})
```

Obligations that are easy to miss:

- **The factory returns nothing.** `watch`, `on`, `pass`, `each`, `reconcile` and `provideContexts` register themselves in an ambient collector when called and return `void`. A returned array is ignored. The old `return [...]` form was removed in v3.0.
- **Call the helpers synchronously in the factory body** (or inside an `each()`/`reconcile()` callback). If you call one after an `await`, in a `setTimeout`, or from an event handler, it throws `NoActiveCollectorError`. An `async` factory loses every call after its first `await` for the same reason. To register conditionally, use plain control flow: `if (el) watch(...)`.
- **`each`, `reconcile`, `query`, `queryAll` and every `bind*` are module imports**, not factory-context members. The factory context holds `host`, `first`, `all`, `expose`, `watch`, `on`, `pass`, `provideContexts`, `requestContext` and `internals`.
- **`host` is the only external interface.** Don't query outside the host's subtree, don't reach into a child component's DOM, and don't talk to siblings. Lift shared state to a common ancestor (`references/coordination.md`).
- **Attributes configure the component once, at connect.** Parsers in `expose()` read the attribute a single time. Later attribute changes do nothing unless you pass the `observedAttributes([...])` extension. Live state flows through properties and events.
- **Read initial state from the DOM the server rendered** (text, `value`, child structure) and seed `expose()` with it. Don't make the page repeat it as a host attribute.

## Facts that bite (details in references)

- `pass()` works only on Le Truc children. It replaces the child's backing signal, it isn't a value write. For any other element, use `watch(src, bindProperty(el, key))`.
- Mark custom parsers with `asParser()` and methods with `defineMethod()`. An unmarked function in `expose()` silently becomes a computed property.
- A hand-written `() => { setup; return cleanup }` effect never cleans up unless you wrap it: `watch(() => true, descriptor)`.
- `expose()` on a built-in property name (`lang`, `dir`, `title`, `hidden`, …) is skipped silently. No error, no reactivity.
- `bindAttribute` with a boolean toggles the attribute (presence only). Pass `String(v)` for `aria-*="true|false"`.
- `bindVisible(el)` sets `el.hidden = !value`.
- `all()` watches the DOM only while an effect reads it.
- Undefined child custom elements are awaited for up to 200 ms. After that the effects run anyway, and `DependencyTimeoutError` is logged, not thrown.
- Dev mode needs the **string** `"true"`: `--define process.env.DEV_MODE='"true"'`.
- Most runtime errors are contained. The component stays inert with its server markup, and the console gets one line. See `references/errors.md`.

## When building

- Write the HTML first, and make it valid and usable without JavaScript. Use native elements (`<button>`, `<input>`, `<dialog>`, `<details>`) before ARIA.
- Declare the props `type`, plus a `declare global { interface HTMLElementTagNameMap { 'my-tag': HTMLElement & MyProps } }` entry so `first()`/`all()` and composing parents get typed elements.
- Give `first()` a required-reason string for each descendant the component cannot work without. Leave it off for optional ones, and guard their effects.
- Put each query directly above the effects that use it. Hoist only the queries that seed `expose()`.
- Pick the coordination mechanism from `references/coordination.md`, and the styling model from `references/styling.md`. The two surfaces differ.

## When reviewing

Check `references/pitfalls.md` first, then:

- Every `expose()` initializer has the right kind (Parser / value / signal / thunk / `{ get, set }` / method). Read-only props are deliberate.
- No `first()`/`all()` call inside an `on()` handler or `watch()` callback.
- `watch` handlers that add listeners or timers return a cleanup.
- `pass()` targets only Le Truc children, and only props they expose from a mutable initializer.
- Accessibility channel: `bindAria` for component-owned semantics, `bindAttribute` for attributes the consumer or CSS reads.
- Docs and tables match the source defaults (`asBoolean()` → `false`, `asEnum([...])` → first entry).

## When debugging

1. **Is there a named error?** Look up the build's `LTC0NN`/`TSRX0NN` code or the console's error class in `references/errors.md`, and act on that row before tracing reactivity. Read the tier: a contained error means one inert component, not a broken page.
2. **No error, wrong behavior**: trace the chain attribute → parser → `host.prop` → `watch` → DOM → `on()` → `host.prop`, and find the broken link. Common causes: an attribute changed after connect, a `watch` call skipped by a conditional, a thunk reading a DOM snapshot (`querySelectorAll`) instead of a signal, a required child custom element not defined (timeout), or `nil` handling (`references/runtime.md`).
3. In a `DEV_MODE` build, set `el.debug = true` on one instance. Its `watch`/`on`/`pass` firings pulse the host and are logged with `console.debug`.

## References

| File | Load when |
|---|---|
| `references/runtime.md` | Writing a factory: `expose()` initializers, parsers, `watch` routing, `bind*` behavior, `on()`, queries, lists, extensions, dev mode |
| `references/coordination.md` | Components talk to each other: `pass()`, context, events, `all()`+`each()` |
| `references/compiled.md` | Authoring or reviewing a `.tsx`/`.tsrx` component source |
| `references/styling.md` | Writing component CSS (runtime and compiled models differ) |
| `references/pitfalls.md` | Reviewing: anti-patterns, accessibility, testing, documentation |
| `references/errors.md` | Any runtime error class or `LTC`/`TSRX` diagnostic code |

Docs: https://zeixcom.github.io/le-truc/getting-started.html. API reference: https://zeixcom.github.io/le-truc/api.html. When the skill and the shipped source disagree, `src/` is authoritative.
