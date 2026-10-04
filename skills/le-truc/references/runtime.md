# Runtime factory: non-obvious behavior

This covers the `defineComponent` factory form. The signatures and JSDoc in `types/` and `src/` give the rest. Docs: [components](https://zeixcom.github.io/le-truc/components.html), [props](https://zeixcom.github.io/le-truc/props.html), [effects](https://zeixcom.github.io/le-truc/effects.html).

## Props type

- **Use `type`, not `interface`.** `ComponentProps` is a `Record` constraint. TypeScript gives object type literals an implicit index signature but never interfaces, so `defineComponent<SomeInterface>` fails with "Index signature … is missing".
- Signal values are `T extends {}`, so `null`/`undefined` are not valid prop values. Assigning `host.prop = null` throws `NullishSignalValueError`. Model absence with `''`, `0`, a sentinel, or a wrapper type.
- Mark a prop `readonly` in the type when consumers must not write it, and back it with a read-only initializer (below). Writing it from outside throws.

## `expose()` initializers

Call `expose()` once, before anything reads `host.<prop>`. It recognizes each value by its **kind**:

| Initializer | Becomes | Writable from outside? |
|---|---|---|
| Parser (`asString()`, `asParser(fn)`) | cell seeded from `getAttribute(key)` once, at connect | yes |
| Static value (`0`, `''`, `[]`) | cell | yes |
| Mutable signal (`createCell(…)`) | that signal, Slot-wrapped | yes |
| `{ get, set? }` descriptor | the property's backing Slot; writes go through `set` | only with `set` (otherwise `ReadonlySignalError`) |
| Read-only signal (memo, task), or a plain function `() => T` (wrapped in `deriveCell`) | getter only | no |
| `defineMethod(fn)` | `host[key] = fn` | n/a |

Non-obvious consequences:

- **Branding is the only distinction.** `isParser()` checks `PARSER_BRAND`, and `isMethodProducer()` checks `METHOD_BRAND`. An unmarked `(v) => …` parser, or an unmarked `() => void` "method", is installed as a computed property. There is no error, it's just wrong. Always use `asParser()` and `defineMethod()`.
- **The attribute name is the prop key as written.** The parser calls `host.getAttribute(key)`, which is case-insensitive in HTML, so `maxLength` reads `maxlength`. Kebab-case `max-length` is never consulted.
- **A parser that returns `null`/`undefined` installs no property at all.** A parser that throws (`asJSON` on malformed JSON throws `SyntaxError`) fails the whole factory, and the component stays inert. `asJSON(fallback)` requires its fallback.
- `asBoolean()`: an attribute that is present is `true`, *except* the value `"false"` (case-insensitive). `asEnum([...])` matches case-insensitively and falls back to the **first** entry. `asInteger`/`asClampedInteger` accept `0x` hex.
- **`expose()` on a built-in IDL property name is skipped silently.** That covers `lang`, `dir`, `title`, `hidden`, `id`, every global-attribute reflection, and any `HTMLElement` member. The `prop in this` guard skips it before an accessor is installed, so reads hit the native property, with no error and no reactivity. Use the attribute as the channel for those names.
- **Reserved names throw `InvalidPropertyNameError`**: JavaScript reserved words and `Object` builtins, members an extension manages (`formAssociated()` reserves `form`, `name`, `validity`, `defaultValue`, …), and `debug` in a `DEV_MODE` build.
- **A write before upgrade is kept.** If a parent sets `child.value = x` before the child is defined, that value becomes the initial value and outranks a static value or Parser seed. A declared signal, thunk or descriptor initializer still wins over it.
- **Event-driven read-only prop**: keep `const len = createCell(0)` in the closure, expose `len.get` (read-only), and update it from `on()`. Inside the same factory, `watch(len, …)` reads the signal directly.
- Prefer one `{ get, set }` descriptor over two `watch` calls kept in sync by hand. The pair re-enters itself and needs an equality guard.

## `observedAttributes` is opt-in

`defineComponent` registers no `observedAttributes`. Pass `observedAttributes(['size', …])` as an extension to re-run a Parser-backed prop's parser when its attribute changes later. On a form-associated component, never list `value`/`checked`. That attribute is the reset baseline (`defaultValue`/`defaultChecked`), not the live value.

## `watch(source, handler)`

- **Source**: a prop name, a signal, a thunk, or an array of these. **Only the source is tracked.** Signal reads inside the handler are untracked, so a value the handler needs fresh belongs in the source.
- **Routing**: `nil` > `err` > `stale` > `ok`. A thunk that returns `null`/`undefined`, or a signal with no value yet, routes to `nil`. A throw routes to `err`, and without an `err` handler it goes to `console.error`.
- **A plain-function handler only has `ok`.** On `nil` it does nothing, so the DOM keeps whatever it last showed. That covers `bindText`, `bindProperty`, `bindVisible`, `bindClass`, `bindState`, and your own functions. The `SingleMatchHandlers` binders do act on `nil`: `bindAttribute` removes the attribute, `bindStyle` calls `removeProperty` (the cascade value comes back), `bindAria` assigns `null`, and `dangerouslyBindInnerHTML` resets.
- **`stale`** fires only for a `Task` that has a retained value and is pending again. It never fires for a cell or memo. Without a seed value, a task's first read routes to `nil`. If you omit `stale`, the old value stays in place during a re-fetch.
- A handler that adds listeners or timers must return a cleanup. It runs before the next `ok` run and on disconnect.

## `bind*` helpers

- `bindAttribute(el, name)`: a string goes through `safeSetAttribute` (validated). A **boolean calls `toggleAttribute`**, so `true` yields `aria-pressed=""`. Pass `String(v)` for enumerated attributes.
- `safeSetAttribute` **throws** `UnsafeAttributeError` for `on*` attribute names, and for URL attributes outside `http:`, `https:`, `ftp:`, `mailto:`, `tel:`. The third argument `allowUnsafe` skips the check.
- `bindVisible(el)` sets `el.hidden = !value`. It's the inverse of `hidden`.
- **Array (map) forms**: `bindClass`/`bindState`/`bindAttribute`/`bindStyle`/`bindAria` treat a name missing from the object as off or removed. `bindProperty`'s map form **leaves missing keys untouched**.
- `bindState(internals, token)` toggles the custom `:state(token)`. Prefer it over `bindClass(host, …)` for host state, because a consumer rewriting `class` cannot clobber it. `internals` is attached on every component, not only form-associated ones. A runtime without `CustomStateSet` (jsdom) makes it a no-op.
- `bindAria(target, name)` reflects through `ElementInternals`/IDL, not the content attribute. It also clears a stale server-rendered attribute on first write. If the target has no working reflection (jsdom), it binds the content attribute instead.
- `dangerouslyBindInnerHTML(el, { sanitize })`: with no `sanitize` and no `configureHtmlSanitizer()` default, it assigns **raw**. `sanitizeHtml` fails closed (escapes) when unconfigured. Configure once per realm: the build's jsdom and the browser are separate module instances. Under Trusted Types enforcement, the sanitizer must return `TrustedHTML` (DOMPurify `RETURN_TRUSTED_TYPE: true`), or the sink throws by design.

## `on(target, type, handler, options?)`

- **The return value updates the host.** Returning `{ prop: value }` assigns each key to `host` in one `batch()`. Returning nothing does nothing.
- `scroll`, `resize`, `wheel`, `mousewheel`, `touchstart` and `touchmove` default to `passive: true` **and are throttled to one call per animation frame**. A `preventDefault()` in such a handler is ignored unless you pass `{ passive: false }` explicitly.
- A `Signal<Element[]>` target (from `all()`) installs **one delegated listener on the host** and calls the handler with the first matching element on the event path. For non-bubbling events (`focus`, `blur`, `mouseenter`, `toggle`, …) it falls back to one listener per element and warns in dev. Prefer `each()` + `on()` there.
- A falsy target is a silent no-op, for `on()` and for `pass()`.

## Queries and dependencies

- `first(selector, reason?)`: given a reason string and no match, it throws `MissingElementError`, and the component stays inert. With no reason, it returns `null`. Selector types infer through `HTMLElementTagNameMap`.
- **Call `first()`/`all()` in the factory body only.** At connect they record undefined custom elements that the component must wait for. Inside a callback they re-query on every run and lose that registration. `query(root, sel)`/`queryAll(root, sel)` and the scoped `first` passed to `each()`/`reconcile()` callbacks are plain one-shot lookups, fine anywhere.
- **Dependency wait**: effects activate once every queried child custom element is defined, or after **200 ms** (internal, not configurable). On timeout, `DependencyTimeoutError` is *logged*, and the effects run against children that may not have upgraded yet.
- **`all()` returns a lazy `Cell<E[]>`**. Its `MutationObserver` runs only while an effect reads the cell, and watches only `childList` plus the attributes the selector mentions. A mutation that leaves the match set unchanged re-runs nothing.
- Reading `querySelector`/`querySelectorAll`/`Array.from(...)` inside a thunk captures a snapshot that never re-triggers. Use `all()`, `createElementsMemo()`, or a live `HTMLCollection` (`el.children`).

## Lists: `each()` and `reconcile()`

- `each(cell, (el, first) => …)` gives every element in the collection its own scope. Effect helpers called inside it attach to that element, and leaving disposes them.
- `reconcile(container, template, list, bindItem)` syncs a keyed `List`/`Collection` one way, data to DOM. Mutate the list, never the container. On the first run it adopts server children by `data-key` and runs `bindItem` for them too, so make `bindItem` idempotent. It **removes every other child** except those marked `data-unreconciled` — and the compiler refuses an authored sibling that carries neither attribute (LTC074), so at runtime only hand-authored markup can hit that removal. The template needs exactly one root element (`InvalidTemplateError`).
- The arm form `reconcile(container, templates, keyThunk, bindArm)` switches conditional arms. It's what compiled conditions lower to. Re-entering an arm clones it afresh, so uncommitted input is lost.

## Hand-written effects

A raw `EffectDescriptor` (`() => { setup(); return cleanup }`) not produced by a helper **never registers its cleanup**, so it never runs on disconnect. Wrap it: `watch(() => true, descriptor)`. A constant source runs the setup once at connect and the cleanup on disconnect.

## Extensions and lifecycle

- `formAssociated()` keys on `value`. `formAssociatedCheckbox()` keys on `checked` and submits nothing when unchecked. Both declare the same static key, so combining them throws `ExtensionCollisionError` in dev (first wins silently in production). Both reserve their managed members, so `expose()` may not name them.
- `relayValidity(internals, control)` copies an inner control's whole `ValidityState` to the host. It isn't reactive: call it from the control's `input`/`change` handler.
- **Reconnect does not re-run the factory.** Cached effects re-activate, and context is not re-requested.

## Dev mode

- Build with `--define process.env.DEV_MODE='"true"'`. Guards compare `=== 'true'` inline, so a bare boolean turns them off. Production should define `"false"` so dev branches fold away. There is no per-instance override.
- A dev build adds a reactive `debug` property to **every** component automatically, and reserves the name. `el.debug = true` (or meta-click) pulses the host on each `watch`/`on`/`pass` firing, marks the knowable target with `data-le-truc-on`/`-pass`/`-watch`, and logs it with `console.debug`.
- Dev mode also warns about a non-bubbling delegated `on()`, a `requestContext` that nobody answered, `null` internals, and markup that `reconcile()` discards on its first run.
