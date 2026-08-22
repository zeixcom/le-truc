# Expected outputs — basic-counter.tsrx (hand-written, Phase 0)

One render call produces one component instance. Expected emitter output for
`renderBasicCounter({ count: 42 })` (default args):

```html
<basic-counter>
	<button type="button">💐 <span>42</span></button>
</basic-counter>
```

For `renderBasicCounter({ count: 100 })` (the "DOM span content reading" demo):

```html
<basic-counter>
	<button type="button">💐 <span>100</span></button>
</basic-counter>
```

Notes:

- Text interpolation `{count}` is escaped per `server/templates/utils.ts`
  `html` tag semantics. `{count}` over a number needs no escaping, but string
  args must round-trip `escapeHtml`.
- The `id` attributes from today's demo gallery (`dom-read-test` etc.) are
  per-instance concerns, not template concerns — the render args need an
  escape hatch for extra host attributes (`{...attrs}` spread or an `id` arg).
  Open format question for ADR 0023.
- Button label differs per demo (`"💐 "` vs `"+ "` vs `"Click me! "`): label
  becomes a render arg `label = '💐 '`, or the demo gallery composes with
  children. Open format question.

## Gallery composition (sketch)

Today's `basic-counter.html` demo gallery maps to N render calls joined with
`<hr>` — either from an args manifest or a page-level template composing the
component:

```ts
const gallery = fragment(
	renderBasicCounter(),
	'<hr>',
	renderBasicCounter({ count: 100 }),
	'<hr>',
	renderBasicCounter({ count: 0 }),
)
```

## CSS artifact

Byte-identical to today's `examples/basic/counter/basic-counter.css`: the
`<style>` block content, concatenated into `examples/main.css` unchanged.
No class hashing — tag scoping is the deliberate deviation.

## JS artifact

The client half passes through verbatim (import path adjusted), export named
`client`. `examples/main.ts` imports change from default import to named:
`import { client as basicCounter } from './basic/counter/basic-counter.tsrx'`
— or the entry list is generated, per the deferred plan's Phase 1 step 3.
