# Expected generated outputs — unified format (hand-written, Phase 0 branch B)

What a unified compiler must generate from the three spike sources. Client
factories are generated (never hand-authored); server render functions emit
HTML strings. All rules derive from one principle: **the server renders the
truth; the client harvests its initial state from that truth** (ADR 0003
preserved end to end).

## 1. basic-counter — complete lowering

### Server (render function)

```ts
import { escapeHtml } from './utils' // server/templates/utils.ts semantics

export interface BasicCounterArgs { start?: number }

export function renderBasicCounter({ start = 42 }: BasicCounterArgs): string {
	// `createCell(start)` lowers to a plain read — the server never reacts
	const count = start
	return `<basic-counter><button type="button">💐 <span>${escapeHtml(String(count))}</span></button></basic-counter>`
}
```

CSS artifact: `stylesheet.source` verbatim (as in Option C).

### Client (generated `defineComponent`)

```ts
// ALL imports generated from '@zeix/le-truc' — the source file imports nothing.
// Signal constructors arrive via Le Truc's CE v2 bridge (re-exported since 2.5.1).
import { asInteger, bindText, createCell, defineComponent, on, watch } from '@zeix/le-truc'
import type { BasicCounterProps } from './basic-counter.tsrx'

export default defineComponent<BasicCounterProps>(
	'basic-counter',
	({ expose, first, on, watch }) => {
		// Element addressing: selectors derived from template structure,
		// uniqueness validated at compile time (the compiler rendered the HTML).
		const button = first('button', 'basic-counter: <button> missing')
		const span = first('span', 'basic-counter: <span> missing')

		// Signal harvest: `count` was rendered into <span>; seed from there.
		// The parser is inferred from the signal's TS type (number → asInteger).
		const count = createCell(asInteger()(span.textContent))

		expose({ count: count.get })

		// onClick={…} on <button>
		on(button, 'click', () => count.set(count.get() + 1))

		// &{count} in <span>
		watch(count, bindText(span))
	},
)
```

Note the convergence: this is byte-for-byte the *shape* of today's hand-written
`basic-counter.ts` (same seed, same binding, same handler) — the unified
compiler would generate what the author now writes by hand.

## 2. module-tabgroup — the hard lowerings

### Server

Renders each tab with `aria-selected`/`tabindex` computed once from the
initial signal value, panels with `hidden` likewise — identical to the
Option C expected output (`expected/module-tabgroup.md`).

### Client (generated) — `@for` + reactive attributes → `each()` + hoisted-const rebinding

```ts
import {
	all,
	bindAttribute,
	createCell,
	defineComponent,
	each,
	on,
	watch,
} from '@zeix/le-truc'
import type { ModuleTabgroupProps } from './module-tabgroup.tsrx'

export default defineComponent<ModuleTabgroupProps>(
	'module-tabgroup',
	({ all, expose }) => {
		const tabs = all('button[role="tab"]', 'module-tabgroup: tabs missing')
		const panels = all('[role="tabpanel"]', 'module-tabgroup: panels missing')

		// Signal harvest: `selected`'s canonical site is the tab the server
		// marked aria-selected="true" (compiler-chosen; rules in the report).
		const selected = createCell(
			tabs.get().find(t => t.ariaSelected === 'true')
				?.getAttribute('aria-controls') ?? '',
		)
		expose({ selected: selected.get })

		// @for body over SERVER data lowers to each() — enhance, don't own.
		// THE REWRITE, SIMPLIFIED: the author's hoisted `const pid =
		// panelId(tab.id)` (server data, static per item) rebinds to the
		// element's aria-controls — the value the server rendered for exactly
		// this const. Reactive thunks then reference `pid` unchanged.
		each(tabs, tab => {
			const pid = tab.getAttribute('aria-controls')!
			watch(
				() => String(selected.get() === pid),
				bindAttribute(tab, 'aria-selected'),
			)
			watch(
				() => (selected.get() === pid ? 0 : -1),
				bindAttribute(tab, 'tabindex'),
			)
			on(tab, 'click', () => selected.set(pid))
			on(tab, 'keyup', (e: KeyboardEvent) => {
				/* author handler body passes through verbatim — it was written
				   DOM-relative (e.currentTarget, closest, …) precisely so it
				   needs no server data at runtime */
			})
		})

		each(panels, panel => {
			// hoisted `const pid = panelId(tab.id)` rebinds to the panel's own id
			watch(
				() => selected.get() !== panel.id,
				bindAttribute(panel, 'hidden'),
			)
		})
	},
)
```

Attribute dispatch per value type (matches `bindAttribute` semantics):
string → setAttribute, boolean → toggleAttribute, number → String(v).
The reactive marker is the **function value itself**: `aria-selected={() => …}`
is a binding because it is function-valued and not `on*`-prefixed (those are
events). Grammar-native — no marker identifier, no upstream changes.

Attribute dispatch per value type (matches `bindAttribute` semantics):
string → setAttribute, boolean → toggleAttribute, number → String(v).

## 3. module-list — `@for` over a reactive List → `reconcile()`

### Server

Initial items render **in place with values, no slot markers** (adopted
children are complete); the item shape is extracted as a sibling `<template>`
whose `&{item}` hole became `<slot></slot>`; `data-key` comes from List keys:

```html
<module-list>
	<form action="#">
		<form-textbox clearable>…</form-textbox>
		<basic-button class="submit"><button type="submit" class="constructive" disabled>Add</button></basic-button>
	</form>
	<ul data-container>
		<li data-key="item0"><span>Apples</span>
			<basic-button class="remove"><button type="button" class="tertiary destructive small">Remove</button></basic-button>
		</li>
	</ul>
	<template>
		<li>
			<span><slot></slot></span>
			<basic-button class="remove">
				<button type="button" class="tertiary destructive small">Remove</button>
			</basic-button>
		</li>
	</template>
</module-list>
```

`disabled={() => !textbox.length}` on `<basic-button>` renders nothing
server-side — the thunk reads a child component's live prop, which does not
exist during SSR (open question #4 in the report). The static `disabled` on
the inner submit button is authored markup and renders as-is.

### Client (generated)

```ts
import {
	createList,
	defineComponent,
	on,
	pass,
	reconcile,
} from '@zeix/le-truc'

export default defineComponent('module-list', ({ first }) => {
	// Declared signal (List). Initial value harvests the DOM: adopted
	// data-key children are the truth (declared initializers are
	// server-render-time only — here both agree on []).
	const items = createList<string>(
		[], // harvest: [...container.children] → keys + slot texts
		{ keyConfig: 'item' },
	)

	const form = first('form', 'module-list: <form> missing')
	const textbox = first('form-textbox', 'module-list: <form-textbox> missing') // ref={textbox}
	const submit = first('basic-button.submit', 'module-list: submit missing')
	const container = first('[data-container]', 'module-list: container missing')
	const template = first('template', 'module-list: <template> missing')

	// @for over items; key k → bindItem's key param; &{item} → slot fill;
	// onClick inside the body → per-item scope (ADR 0017 collector parity)
	reconcile(container, template, items, (_el, item, key, first) => {
		first('slot')?.replaceWith(document.createTextNode(item.get()))
		const removeBtn = first('button', 'module-list: remove button missing')
		on(removeBtn, 'click', () => items.remove(key))
	})

	on(form, 'submit', (e: SubmitEvent) => {
		e.preventDefault()
		const value = textbox.value.trim()
		if (!value) return
		items.add(value)
		textbox.clear()
	})

	// disabled={() => …} on a custom element whose component is in the
	// compile registry → pass() with mediated read-only prop
	pass(submit, { disabled: { get: () => !textbox.length } })
})
```

This is, statement for statement, today's hand-written `module-list.ts` —
including the `<slot>` fill and the exact `reconcile()` call. The unified
compiler generates the existing convention; it invents nothing new at runtime.
