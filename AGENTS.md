# Agent Context — Le Truc

> Non-obvious facts and easy-to-get-wrong behaviors only. Structure: `ARCHITECTURE.md`. API details: JSDoc in `src/`. Authoring or reviewing a compiled component? Read `server/compiler/HOST_PROFILE.md` first — `.tsx` is the default authored surface, `.tsrx` stays supported where statement-context control flow reads better (ADR 0032), and this project's host decisions (styles, `truc:pass`, element references) differ from Ripple's, the only other TSRX host profile.

## Factory Form

The factory form is the only way to define components. Effect helpers (`watch`, `on`, `pass`, `each`, `provideContexts`) self-register in an ambient collector when called — no `return` needed (ADR 0018). Explicit `return [...]` of a `FactoryResult` still works but is deprecated.

```ts
defineComponent<MyProps>('my-element', ({ expose, first, on, watch }) => {
  const input = first('input') as HTMLInputElement
  expose({ value: input.value })
  on(input, 'input', () => ({ value: input.value }))
  watch('value', v => { input.value = v })
})
```

## Surprising Behaviors

- **One tag, one authored source, whichever surface**: the corpus scan globs `.tsrx` AND `.tsx` into one registry, and a tag two files declare fails the build naming both, dropping both (TSRX048). Migrate a tag to `.tsx` by replacing the `.tsrx` source in the same change, not alongside it.

- **The boundary is three-arm in both surfaces; the in-flight state is the `isPending` idiom**: `boundary({ ok, nil, err })` — there is no `stale` arm anywhere (owner withdrawal, LT-211: the client toggles `hidden`/`disabled` on server-rendered arms and never re-renders their content, so a re-fetching state has no arm to show). Reactive idiom: `class={() => (isPending(data) ? 'pending' : null)}` — the ARROW is required (a bare expression is a render-time `server` attribute that never updates), and `@if` still cannot read signals on either surface. Arms are typed `JSX.Element`/`err: Error` (LT-208). The `css` tag remains `.tsx` vocabulary and the `{count}` shorthand `.tsrx`-only.

- **Typed factory context on `.tsx`: annotate the second parameter** (LT-209): `, { host, first, expose }: FactoryContext<Props>` (form-associated: `FormFactoryContext<Props>`). It shadows the wide ambients at function scope, makes `watch`/`on`/`pass` prop-key-precise, and turns a mistyped `expose()` key into a free tsc error (P-drift). Wrong surface annotation → TSRX050; unknown destructured name → TSRX049. `i18n` stays in the ARGS destructure — the generated client has zero i18n. No silent fallbacks: omit the param and you get the ambients; an unannotated param is an implicit-`any` error under strict.

- **`observedAttributes` is opt-in — parsers run once**: `defineComponent` never registers `observedAttributes`/`attributeChangedCallback` on its own. Parsers passed to `expose()` read the attribute once at connect, for server-rendered configuration. Pass the `observedAttributes()` extension to re-run a Parser-backed prop's parser on later attribute mutations; otherwise react via events or `watch()`.

- **Branding, not structure, distinguishes parsers and method producers**: `isParser()` checks `PARSER_BRAND`, `isMethodProducer()` checks `METHOD_BRAND`. Always use `asParser()` / `defineMethod()`. An unbranded `() => void` is wrapped in `deriveCell()` as a `MemoCallback`, not installed as a method producer — silently wrong, no error.

- **A hand-authored `EffectDescriptor` silently never cleans up**: only the effect helpers self-register cleanup via their internal `createEffect()`/`createScope()`. A raw descriptor (`() => { setup(); return cleanup }`) returned bare has its cleanup dropped — it never runs on disconnect. Wrap it: `watch(() => true, descriptor)`.

- **`pass()` is Le Truc–only and replaces signals, not values**: it calls `slot.replace(signal)` on the child's internal Slot map, so it only works for Le Truc components with Slot-backed properties. For any other element use `watch(source, bindProperty(el, key))`, which goes through the public JS setter. `pass()` captures the original signal and restores it on parent disconnect, so the child regains independent state after detachment. The property-key (`'value'`) and bare-writable-signal short forms are deprecated — they grant the child unrestricted `.set()` on the parent's signal and warn in `DEV_MODE`. Use `() => host.prop` for read-only or `{ get, set }` to mediate writes (ADR 0012).

- **`all()`'s MutationObserver is lazy**: it activates only when the returned `Cell` is read inside a reactive effect, and watches only the attribute changes implied by the CSS selector. The `equals` check is fully respected — an `innerHTML` mutation that doesn't change the match set re-runs nothing.

- **`setAttribute` validates**: blocks `on*` handler attributes and checks URL attributes against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`). Violations throw, never silently pass.

- **Dependency resolution races the child's own upgrade**: if a queried custom element isn't defined within `DEPENDENCY_TIMEOUT`, a `DependencyTimeoutError` is logged and the parent's effects activate anyway against a possibly-undefined child — intentional progressive enhancement. Writing a not-yet-upgraded child's `expose()`d property is safe: at upgrade, `#initSignals` captures the pre-connect write as the initial signal value and installs the accessor anyway (ADR 0031) — the write outranks static and Parser initializers, a declared `Signal`/thunk/`SlotDescriptor` initializer wins over the write, and inherited prototype-managed members (`localName`, `lang`, …) keep being skipped.

- **`on()` handler return value updates the host**: returning `{ prop: value }` applies those updates in a `batch()`. Returning nothing is a no-op.

- **Context follows the Web Components CG protocol**, with retries: `requestContext(context, fallback)` returns a `Signal<T>` (Slot-backed, the same primitive `pass()` uses) usable directly in `expose()`. If no ancestor answers the initial dispatch, it re-dispatches on a microtask and again after a short timeout, covering providers upgraded later or awaiting `customElements.whenDefined()`. The Slot serves `fallback` until a provider answers; after the last retry the fallback is permanent for that connection. Resolution happens once per component lifetime, at first connect — reconnect re-activates cached descriptors without re-running the factory, so no re-dispatch.

- **Providers are stable single sources of truth**: update the value they provide; don't add/remove providers at runtime. A connected consumer keeps the provider's last value for the life of the connection — removing the provider does not revert it to `fallback`. This prevents flicker when a consumer briefly disconnects during a DOM move (e.g. drag-and-drop). Give consumers a `fallback` that makes sense for a genuinely absent provider.

- **`undefined` from a reactive restores the original DOM value** captured at setup time (e.g. after an error in a computed thunk) — not a blank state. Likewise `bindStyle` on a nil value calls `removeProperty`, restoring the CSS cascade value.

- **`expose()` accepts a `{ get, set? }` descriptor**, installed directly as the property's backing Slot — the same mediated form `pass()` accepts. Prefer it over a pair of `watch` calls kept in sync by hand, which need an equality guard against re-entrant circularity. Omit `set` for read-only (writes throw `ReadonlySignalError`). See `examples/form/tokenbox/form-tokenbox.ts`. For an event-driven read-only prop, expose `state.get` (not the full `State`) and update it in an `on()` handler; to watch it inside the factory pass the signal directly.

- **`expose()` on a built-in IDL property name is silently skipped**: `'lang' in this` (also `dir`, `title`, `hidden`, every global-attribute reflection) is always true, so `#initSignals`'s `prop in this` guard skips the initializer before any accessor is installed — no error, no reactivity, and reads hit the native accessor (the live attribute). The attribute is the only channel for these names: seed it, don't expose it (`basic-pluralize` materializes its walked locale onto the `lang` attribute at connect; LT-191). A parser-applied seed doesn't help — the guard runs first.

- **Dev mode needs the *string* `"true"`**: build with `--define process.env.DEV_MODE='"true"'`; guards compare `=== 'true'` inline, so a bare boolean disables them. Production defines `"false"`, constant-folding dev branches out. No per-instance debug flag exists.

- **`bindVisible` is the inverse of `hidden`**: `bindVisible(el)` sets `el.hidden = !value`.

- **`bindAttribute` returns `SingleMatchHandlers`, not a function** (`watch` accepts both), and dispatches on type: a boolean value calls `toggleAttribute`, so don't pass boolean for attributes needing a string value.

- **`stale` in `watch` only fires for `Task` signals with a retained value**: precedence is `nil` > `err` > `stale` > `ok`; it requires both a retained value and `isPending(signal)` — never `State` or `Memo`. Without `{ value: seed }` the first read throws `UnsetSignalValueError` and routes to `nil`. Omitting `stale` falls back to `ok`, leaving the retained value in place during a re-fetch.
