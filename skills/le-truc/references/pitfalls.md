# Pitfalls: review checklist

These are things that compile and look plausible but are wrong in Le Truc. Generic web-component and ARIA advice is left out on purpose. Docs: [accessibility](https://zeixcom.github.io/le-truc/accessibility.html).

## Code

| Smell | Why it's wrong | Instead |
|---|---|---|
| `return [watch(…), on(…)]` from the factory | removed in v3.0. Helpers self-register, and the return value is ignored | call the helpers, return nothing |
| a helper called after `await`, in `setTimeout`, or in a handler | no active collector, so it throws `NoActiveCollectorError` | call it in setup, and move the condition inside the effect |
| `interface Props` | fails the `ComponentProps` index-signature constraint | `type Props = { … }` |
| `(v) => …` as a parser, `() => {…}` as a method | unmarked functions become computed props | `asParser(fn)`, `defineMethod(fn)` |
| `expose({ lang: … })`, `expose({ hidden: … })` | built-in IDL names are skipped silently | use the attribute |
| `pass(child, { v: 'v' })` or `pass(child, { v: signal })` | retired forms that fail validation | `() => host.v` or `{ get, set }` |
| `pass()` into Lit, Stencil or native elements | it needs a Le Truc Slot | `watch(src, bindProperty(el, key))` |
| `pass()` with a thunk into a prop the child writes itself | the child's writes throw `ReadonlySignalError` | `watch` + `bindProperty` down, `change` event up |
| a raw `() => cleanup` effect | its cleanup never runs | `watch(() => true, descriptor)` |
| `first()`/`all()` inside `on()`/`watch()` | re-queries every run and loses dependency registration | query once in the body, above its effect |
| `querySelectorAll`/`Array.from` read inside a thunk | snapshot with no dependency | `all()`, `createElementsMemo()`, `el.children` |
| `bindAttribute(el, 'aria-expanded')` with a boolean source | sets presence (`aria-expanded=""`) | `watch(() => String(open), bindAttribute(…))` or `bindAria(el, 'ariaExpanded')` |
| expecting a post-connect attribute change to update a prop | parsers run once | set the property, or add `observedAttributes([...])` |
| `observedAttributes(['value'])` on a form-associated component | conflates the reset baseline with the live value | leave `value`/`checked` out |
| `dangerouslyBindInnerHTML(el)` on user content without configuring a sanitizer | assigns raw HTML | `{ sanitize }`, or `configureHtmlSanitizer()` per realm |
| `on(el, 'touchmove', e => e.preventDefault())` | that event defaults to passive and throttled | pass `{ passive: false }` |
| `host.prop = null` | signals reject nullish values | a sentinel value or wrapper type |
| a `.tsx` attribute `class={cond ? 'a' : 'b'}` meant to update | a bare expression renders once on the server | `class={() => …}` |
| input fields inside a reactive condition's arm | the arm is re-cloned on a flip, and input is lost | `hidden={() => …}` to keep the DOM |
| a constant `id` in a compiled template | duplicates on the second instance | an id server arg with a default |

## Markup and progressive enhancement

- The server HTML must work and read correctly with JavaScript off. An empty `<my-tag></my-tag>` is a defect.
- Seed state from the DOM. A prop whose value already sits in the component's text or controls should harvest it rather than require a duplicate host attribute.
- A compiled component's no-JS state for values that have no server answer (clock, random, layout) is blank unless you give a static default.

## Accessibility (Le Truc specifics)

- **ARIA has two channels.**
  - Component-owned semantics (`role`, `ariaExpanded`, `ariaValueNow`) go through `bindAria(internals | el, name)`, or a one-time `internals.role = 'slider'` in setup. That reflects without fighting the consumer.
  - Use `bindAttribute` only for attributes a consumer may override, or that CSS selects on.
  - `bindAria` clears a stale server-rendered attribute on its first write.
- On a form-associated component, the **host** is the form participant. An inner control must not carry `name` (LTC029), or the field submits twice.
- `id` references (`<label for>`, `aria-labelledby`) only work when every instance has a unique id. In compiled sources, take the id as an arg.
- Messages that assistive tech announces (`aria-label`, status text) are prose. In an i18n component, route them through `t.<key>`.

## Testing

- Use the component's example HTML as the fixture. It is the contract the component claims to support. Test observable behavior (DOM, attributes, events, `host.prop`), not which helper was used.
- Cover these cases:
  - Initial state is harvested from the markup.
  - Each parser path works: present, absent, `"false"`, an unknown enum value.
  - A post-connect attribute change does **not** update the prop, unless `observedAttributes` is used.
  - Prop → DOM, and real user events → prop → DOM.
  - Two instances keep independent state.
- Read-only props throw on assignment. Drive them through native interaction, not `el.prop = x`.
- A missing required descendant does not throw out of `connectedCallback`. Assert that the component stays inert and logs one `console.error`.
- A runtime without `CustomStateSet`/ARIA reflection (jsdom) turns `bindState` into a no-op and makes `bindAria` fall back to attributes. Assert accordingly.
- `DEV_MODE` comes from `process.env.DEV_MODE` under an unbundled runner (`bun test`), so set it to the string `"true"` there too.

## Documentation

- Document the public surface only: tag, reactive properties (type, default, read-only), attributes read at connect (and say they are read **once**), host classes, custom states, methods, events, and required/optional descendants.
- Defaults must match the source: `asString()` → `''`, `asBoolean()` → `false`, `asInteger()` → `0`, `asEnum([a, …])` → `a`.
