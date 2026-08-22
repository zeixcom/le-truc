# Expected outputs — module-tabgroup.tsrx (hand-written, Phase 0)

Args shape (matches the spike source):

```ts
type Tab = { id: string; label: string; content: string }
renderModuleTabgroup({
	label: 'Tabs',
	tabs: [
		{ id: '1', label: 'Tab 1', content: 'Tab 1 content' },
		{ id: '2', label: 'Tab 2', content: 'Tab 2 content' },
		{ id: '3', label: 'Tab 3', content: 'Tab 3 content' },
	],
	selected: 0,
})
```

Expected emitter output — note `hidden` present only on inactive panels
(boolean → toggle), `tabindex` numeric, `aria-selected` string-coerced:

```html
<module-tabgroup>
	<div role="tablist" aria-label="Tabs">
		<button type="button" role="tab" id="trigger-1" aria-controls="panel-1" aria-selected="true" tabindex="0">Tab 1</button>
		<button type="button" role="tab" id="trigger-2" aria-controls="panel-2" aria-selected="false" tabindex="-1">Tab 2</button>
		<button type="button" role="tab" id="trigger-3" aria-controls="panel-3" aria-selected="false" tabindex="-1">Tab 3</button>
	</div>
	<div role="tabpanel" id="panel-1" aria-labelledby="trigger-1">Tab 1 content</div>
	<div role="tabpanel" id="panel-2" aria-labelledby="trigger-2" hidden>Tab 2 content</div>
	<div role="tabpanel" id="panel-3" aria-labelledby="trigger-3" hidden>Tab 3 content</div>
</module-tabgroup>
```

`selected: 1` (the "second tab initially selected" demo) flips `aria-selected`,
`tabindex`, and `hidden` accordingly — the client seeds its state from exactly
these DOM values at connect time, so server/client agreement is the contract.

Semantic decisions encoded here (for the format spec):

1. **Boolean attribute dispatch**: `hidden={i !== selected}` renders the
   attribute (valueless) when true, omits it when false — mirrors Le Truc's
   `bindAttribute` boolean semantics and JSX/HTML conventions.
2. **String-coerced ARIA**: `aria-selected={String(...)}` is explicit in the
   source. Whether the emitter should auto-stringify booleans for a known
   ARIA allowlist (`aria-selected`, `aria-expanded`, …) instead of
   requiring `String()` is an open question. Explicit beats magic for the
   spec's first cut.
3. **Template literals in attributes** (`id={`trigger-${tab.id}`}`) must
   parse as attribute expressions — one of the things the probe verifies.
4. **`for ... of` over render args is server-only control flow**: no client
   JS is emitted for it in Option C. The client half never sees `tabs`;
   it discovers tabs via `all('button[role="tab"]')` from the rendered DOM,
   exactly as today.
5. **Escape hatch**: panels with rich content (`<h3>` + `<p>` in the
   "Settings Panel" demo) need either `content: string` passed through
   `{html tab.content}` (raw, trusted) or slot-style composition where the
   gallery supplies child markup. Open format question for ADR 0023.

## CSS artifact

Byte-identical to today's `examples/module/tabgroup/module-tabgroup.css`
(deep native nesting — `> [role="tablist"] > [role="tab"]`, `&` blocks).
This stresses the CSS side of the parser: if `@tsrx/core`'s style utilities
can't round-trip nested CSS without hash rewriting, we bypass them and use
our own printer, as the deferred plan anticipated.

## JS artifact

Client half passes through verbatim, export named `client`, including the
module-scope helpers (`getAriaControls`, `getSelected`) and the
`declare global` block.
