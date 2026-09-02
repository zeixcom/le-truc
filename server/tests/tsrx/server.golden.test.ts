/**
 * Golden tests — server half (LT-001).
 *
 * The hand-written example PAGES demonstrate variants (different seeds,
 * initial selections, tab counts); what the compiler must prove is that
 * every variant is representable: `render(args)` produces exactly the
 * markup that variant needs, deterministically, byte for byte against the
 * inline expectations below. The first counter expectation is the golden
 * page's default block verbatim; the remaining expectations are the same
 * render with the demo variants' args.
 *
 * Two golden-page demos are not render(args)-shaped and stay out: the
 * "invalid state" demo (a hand-broken tab referencing a nonexistent panel)
 * and the "rich content" demo (nested h3/p markup — plain-string args
 * escape, which is correct SSR semantics; rich children are a composition
 * question, not a render bug).
 *
 * CSS is asserted byte for byte against the hand-written artifacts.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'
import { createGeneratedDir } from '../helpers/generated-tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')
const read = (rel: string): string =>
	fs.readFileSync(path.join(ROOT, rel), 'utf8')

const registry = new Set<string>(['basic-counter', 'module-tabgroup'])
const counter = compileComponent(
	read('examples/basic/counter/basic-counter.tsrx'),
	'examples/basic/counter/basic-counter.tsrx',
	registry,
)
const tabgroup = compileComponent(
	read('examples/module/tabgroup/module-tabgroup.tsrx'),
	'examples/module/tabgroup/module-tabgroup.tsrx',
	registry,
)
const formTextbox = compileComponent(
	read('examples/form/textbox/form-textbox.tsrx'),
	'examples/form/textbox/form-textbox.tsrx',
	new Set<string>([...registry, 'form-textbox']),
)
const moduleList = compileComponent(
	read('examples/module/list/module-list.tsrx'),
	'examples/module/list/module-list.tsrx',
	new Set<string>([...registry, 'form-textbox', 'module-list', 'basic-button']),
	undefined,
	// module-list composes FormTextbox (ADR 0023 sub-design 10, LT-020) —
	// keyed by form-textbox's own repo-relative source path, mirroring
	// server/effects/tsrx.ts's corpus-wide compose registry.
	new Map(
		formTextbox.component
			? [
					[
						'examples/form/textbox/form-textbox.tsrx',
						formTextbox.component.entry,
					],
				]
			: [],
	),
)
const formCheckbox = compileComponent(
	read('examples/form/checkbox/form-checkbox.tsrx'),
	'examples/form/checkbox/form-checkbox.tsrx',
	new Set<string>([...registry, 'form-textbox', 'form-checkbox']),
)
// Arg-seeded reactive list (LT-003): initial items render in place with
// data-key, the item shape is extracted as a <template>, and the client's
// List declaration harvests the adopted children (see client.golden.test.ts).
const seededSource = `import { createList } from '@zeix/le-truc'
export function Seeded({ initial }: { initial?: string[] })
	@{
		const items = createList<string>(initial, { keyConfig: 'item' })
		<>
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						<li><span>{item}</span></li>
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
const seeded = compileComponent(seededSource, 'seeded.tsrx', new Set<string>())

if (
	!counter.component ||
	!tabgroup.component ||
	!formTextbox.component ||
	!moduleList.component ||
	!formCheckbox.component ||
	!seeded.component
)
	throw new Error('corpus components must compile for golden tests')

// Generated server modules must exist for in-process execution; the effect
// normally writes them, tests must not depend on a prior build — nor write
// into the build's own output directory (LT-140).
const generated = createGeneratedDir('server-golden')
afterAll(() => generated.cleanup())
const ensureEmitted = (tag: string, code: string): void => {
	generated.emit(`${tag}.server.ts`, code)
}
ensureEmitted('basic-counter', counter.component.serverCode)
ensureEmitted('module-tabgroup', tabgroup.component.serverCode)
ensureEmitted('form-textbox', formTextbox.component.serverCode)
ensureEmitted('module-list', moduleList.component.serverCode)
ensureEmitted('form-checkbox', formCheckbox.component.serverCode)
ensureEmitted('c-el', seeded.component.serverCode)

const render = async (
	name: string,
	tag: string,
	args: unknown,
): Promise<string> => {
	const mod = await generated.importModule(`${tag}.server.ts`)
	const fn = mod[`render${name}`] as (args: unknown) => string
	if (typeof fn !== 'function')
		throw new Error(`render function for ${tag} missing`)
	return fn(args)
}

const counterHtml = (seed: number | string): string =>
	`<basic-counter><button type="button">💐 <span>${seed}</span></button></basic-counter>`

describe('server golden — basic-counter variants', () => {
	const seeds: Array<[string, number | undefined, number | string]> = [
		['default seed (42)', undefined, 42],
		['dom-read demo seed (100)', 100, 100],
		['repeat seed (42)', 42, 42],
		['zero seed', 0, 0],
		['negative seed', -5, -5],
	]
	for (const [label, arg, expected] of seeds) {
		test(`render({${arg === undefined ? '' : ` start: ${arg}`}}) — ${label}`, async () => {
			const html = await render('BasicCounter', 'basic-counter', { start: arg })
			expect(html).toBe(counterHtml(expected))
		})
	}
})

describe('server golden — module-tabgroup variants', () => {
	const tab = (id: string, label: string, content: string) => ({
		id,
		label,
		content,
	})

	test('default: first tab selected', async () => {
		const html = await render('ModuleTabgroup', 'module-tabgroup', {
			tabs: [
				tab('1', 'Tab 1', 'Tab 1 content'),
				tab('2', 'Tab 2', 'Tab 2 content'),
				tab('3', 'Tab 3', 'Tab 3 content'),
			],
		})
		expect(html).toBe(
			'<module-tabgroup><div role="tablist" aria-label="Tabs">' +
				'<button type="button" role="tab" id="trigger1" aria-controls="panel1" aria-selected="true" tabindex="0">Tab 1</button>' +
				'<button type="button" role="tab" id="trigger2" aria-controls="panel2" aria-selected="false" tabindex="-1">Tab 2</button>' +
				'<button type="button" role="tab" id="trigger3" aria-controls="panel3" aria-selected="false" tabindex="-1">Tab 3</button>' +
				'</div>' +
				'<div role="tabpanel" id="panel1" aria-labelledby="trigger1">Tab 1 content</div>' +
				'<div role="tabpanel" id="panel2" aria-labelledby="trigger2" hidden>Tab 2 content</div>' +
				'<div role="tabpanel" id="panel3" aria-labelledby="trigger3" hidden>Tab 3 content</div>' +
				'</module-tabgroup>',
		)
	})

	test('selected: 1 — second tab selected', async () => {
		const html = await render('ModuleTabgroup', 'module-tabgroup', {
			tabs: [
				tab('4', 'Settings', 'Settings content'),
				tab('5', 'Profile', 'Profile content'),
				tab('6', 'Security', 'Security content'),
			],
			selected: 1,
		})
		expect(html).toBe(
			'<module-tabgroup><div role="tablist" aria-label="Tabs">' +
				'<button type="button" role="tab" id="trigger4" aria-controls="panel4" aria-selected="false" tabindex="-1">Settings</button>' +
				'<button type="button" role="tab" id="trigger5" aria-controls="panel5" aria-selected="true" tabindex="0">Profile</button>' +
				'<button type="button" role="tab" id="trigger6" aria-controls="panel6" aria-selected="false" tabindex="-1">Security</button>' +
				'</div>' +
				'<div role="tabpanel" id="panel4" aria-labelledby="trigger4" hidden>Settings content</div>' +
				'<div role="tabpanel" id="panel5" aria-labelledby="trigger5">Profile content</div>' +
				'<div role="tabpanel" id="panel6" aria-labelledby="trigger6" hidden>Security content</div>' +
				'</module-tabgroup>',
		)
	})

	test('five tabs — keyboard-navigation demo shape', async () => {
		const html = await render('ModuleTabgroup', 'module-tabgroup', {
			tabs: [
				tab('7', 'Home', 'Welcome to our homepage'),
				tab('8', 'Products', 'Browse our products'),
				tab('9', 'Services', 'Learn about our services'),
				tab('10', 'About', 'About our company'),
				tab('11', 'Contact', 'Get in touch with us'),
			],
		})
		expect(html).toBe(
			'<module-tabgroup><div role="tablist" aria-label="Tabs">' +
				'<button type="button" role="tab" id="trigger7" aria-controls="panel7" aria-selected="true" tabindex="0">Home</button>' +
				'<button type="button" role="tab" id="trigger8" aria-controls="panel8" aria-selected="false" tabindex="-1">Products</button>' +
				'<button type="button" role="tab" id="trigger9" aria-controls="panel9" aria-selected="false" tabindex="-1">Services</button>' +
				'<button type="button" role="tab" id="trigger10" aria-controls="panel10" aria-selected="false" tabindex="-1">About</button>' +
				'<button type="button" role="tab" id="trigger11" aria-controls="panel11" aria-selected="false" tabindex="-1">Contact</button>' +
				'</div>' +
				'<div role="tabpanel" id="panel7" aria-labelledby="trigger7">Welcome to our homepage</div>' +
				'<div role="tabpanel" id="panel8" aria-labelledby="trigger8" hidden>Browse our products</div>' +
				'<div role="tabpanel" id="panel9" aria-labelledby="trigger9" hidden>Learn about our services</div>' +
				'<div role="tabpanel" id="panel10" aria-labelledby="trigger10" hidden>About our company</div>' +
				'<div role="tabpanel" id="panel11" aria-labelledby="trigger11" hidden>Get in touch with us</div>' +
				'</module-tabgroup>',
		)
	})

	test('two tabs — minimal demo shape', async () => {
		const html = await render('ModuleTabgroup', 'module-tabgroup', {
			tabs: [
				tab('15', 'Only Tab', 'Only panel content'),
				tab('16', 'Second Tab', 'Second panel content'),
			],
		})
		expect(html).toBe(
			'<module-tabgroup><div role="tablist" aria-label="Tabs">' +
				'<button type="button" role="tab" id="trigger15" aria-controls="panel15" aria-selected="true" tabindex="0">Only Tab</button>' +
				'<button type="button" role="tab" id="trigger16" aria-controls="panel16" aria-selected="false" tabindex="-1">Second Tab</button>' +
				'</div>' +
				'<div role="tabpanel" id="panel15" aria-labelledby="trigger15">Only panel content</div>' +
				'<div role="tabpanel" id="panel16" aria-labelledby="trigger16" hidden>Second panel content</div>' +
				'</module-tabgroup>',
		)
	})

	test('aria-label comes from args', async () => {
		const html = await render('ModuleTabgroup', 'module-tabgroup', {
			label: 'Site navigation',
			tabs: [tab('1', 'Home', 'Welcome')],
		})
		expect(html).toContain('<div role="tablist" aria-label="Site navigation">')
	})
})

describe('server golden — form-textbox variants (extensions, Parser-expose, @if)', () => {
	// `clearable` and `validatable` (required || maxlength != null) each gate
	// an entire optional element — the clear button and the error paragraph
	// only render when true, not merely hidden/empty (a single-branch @if,
	// no @else, LT-008's DOM-existence-guarded addressing).
	const formTextboxHtml = ({
		name,
		label,
		value = '',
		required = false,
		maxlength,
		multiline = false,
		clearable = false,
		description = '',
	}: {
		name: string
		label: string
		value?: string
		required?: boolean
		maxlength?: number
		multiline?: boolean
		clearable?: boolean
		description?: string
	}): string => {
		const validatable = required || maxlength != null
		const describedByIds = [
			description ? `${name}-description` : null,
			validatable ? `${name}-error` : null,
		].filter((id): id is string => id !== null)
		const describedBy =
			describedByIds.length > 0
				? ` aria-describedby="${describedByIds.join(' ')}"`
				: ''
		const descriptionText =
			Number(maxlength) > 0 && description.includes('{n}')
				? description.replace('{n}', String(Number(maxlength) - value.length))
				: description
		return (
			`<form-textbox name="${name}" value="${value}">` +
			`<label for="${name}-input">${label}</label>` +
			'<div class="input">' +
			(multiline
				? `<textarea id="${name}-input" value="${value}" autocomplete="off"${required ? ' required' : ''}${maxlength !== undefined ? ` maxlength="${maxlength}"` : ''} rows="3"${describedBy}>${value}</textarea>`
				: `<input type="text" id="${name}-input" value="${value}" autocomplete="off"${required ? ' required' : ''}${maxlength !== undefined ? ` maxlength="${maxlength}"` : ''}${describedBy}>`) +
			(clearable
				? `<button type="button" aria-label="Clear input"${value === '' ? ' hidden' : ''} class="clear">✕</button>`
				: '') +
			'</div>' +
			(validatable
				? `<p role="alert" aria-live="assertive" id="${name}-error" class="error"></p>`
				: '') +
			(description
				? `<p aria-live="polite" id="${name}-description" data-remaining="${description}" class="description">${descriptionText}</p>`
				: '') +
			'</form-textbox>'
		)
	}

	test('default: empty value, optional field, no clear button, no error paragraph', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'name',
			label: 'Name',
		})
		expect(html).toBe(formTextboxHtml({ name: 'name', label: 'Name' }))
	})

	test('required: boolean arg renders the bare attribute and the error paragraph', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'name',
			label: 'Name',
			required: true,
		})
		expect(html).toBe(
			formTextboxHtml({ name: 'name', label: 'Name', required: true }),
		)
	})

	test('seeded value reaches the host attribute AND the mirrored input value', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'nick',
			label: 'Nickname',
			value: 'Ada',
		})
		expect(html).toBe(
			formTextboxHtml({ name: 'nick', label: 'Nickname', value: 'Ada' }),
		)
	})

	test('multiline: @if renders the textarea branch with the same constructs', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'notes',
			label: 'Notes',
			multiline: true,
			required: true,
		})
		expect(html).toBe(
			formTextboxHtml({
				name: 'notes',
				label: 'Notes',
				multiline: true,
				required: true,
			}),
		)
	})

	test('special characters escape in both the root attribute and the mirror', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'x',
			label: 'A & B <test>',
			value: 'q"uote',
		})
		expect(html).toBe(
			formTextboxHtml({
				name: 'x',
				label: 'A &amp; B &lt;test&gt;',
				value: 'q&quot;uote',
			}),
		)
	})

	test('clearable: false by default, the clear button and its @if branch simply do not render', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'q',
			label: 'Search',
		})
		expect(html).not.toContain('class="clear"')
	})

	test('clearable: true renders the clear button, hidden while the value is empty', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'q',
			label: 'Search',
			clearable: true,
		})
		expect(html).toBe(
			formTextboxHtml({ name: 'q', label: 'Search', clearable: true }),
		)
	})

	test('clearable: true with a seeded value renders the clear button visible', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'q',
			label: 'Search',
			clearable: true,
			value: 'abc',
		})
		expect(html).toBe(
			formTextboxHtml({
				name: 'q',
				label: 'Search',
				clearable: true,
				value: 'abc',
			}),
		)
	})

	test('maxlength alone makes the field validatable (error paragraph) and describes the description paragraph', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'q',
			label: 'Search',
			maxlength: 10,
			description: 'Max 10 characters',
		})
		expect(html).toBe(
			formTextboxHtml({
				name: 'q',
				label: 'Search',
				maxlength: 10,
				description: 'Max 10 characters',
			}),
		)
	})
})

describe('server golden — module-list (reactive @for → template extraction)', () => {
	const itemTemplate =
		'<template><li><span><slot></slot></span>' +
		'<basic-button class="remove">' +
		'<button type="button" class="tertiary destructive small">Remove</button>' +
		'</basic-button></li></template>'

	test('empty seed: form renders, empty container, extracted template', async () => {
		const html = await render('ModuleList', 'module-list', {})
		expect(html).toBe(
			'<module-list><form action="#">' +
				// FormTextbox is composed (ADR 0023 sub-design 10, LT-020): this
				// is form-textbox.tsrx's OWN render output for
				// { name: 'new-item', label: 'New item', clearable: true } —
				// value="" (unauthored default, now real, not hand-copied), the
				// clear button (module-list passes bare `clearable`), and no
				// error paragraph (no `required`/`maxlength` — nothing to
				// validate, so the branch simply doesn't render at all).
				'<form-textbox name="new-item" value="">' +
				'<label for="new-item-input">New item</label>' +
				'<div class="input">' +
				'<input type="text" id="new-item-input" value="" autocomplete="off">' +
				'<button type="button" aria-label="Clear input" hidden class="clear">✕</button>' +
				'</div>' +
				'</form-textbox>' +
				'<basic-button class="submit"><button type="submit" class="constructive">Add</button></basic-button>' +
				'</form>' +
				// disabled={() => !textbox.length} reads a child component's live
				// prop — omitted server-side (dependency-provable evaluation).
				'<ul data-container></ul>' +
				itemTemplate +
				'</module-list>',
		)
	})

	test('arg-seeded list: keyed items render in place with values, no slot markers', async () => {
		const html = await render('Seeded', 'c-el', {
			initial: ['Apples', 'Pears'],
		})
		expect(html).toBe(
			'<c-el><ul data-container>' +
				'<li data-key="item0"><span>Apples</span></li>' +
				'<li data-key="item1"><span>Pears</span></li>' +
				'</ul>' +
				'<template><li><span><slot></slot></span></li></template>' +
				'</c-el>',
		)
	})

	test('arg-seeded list: values escape through the item hole', async () => {
		const html = await render('Seeded', 'c-el', {
			initial: ['<b>A & B</b>'],
		})
		expect(html).toContain(
			'<li data-key="item0"><span>&lt;b&gt;A &amp; B&lt;/b&gt;</span></li>',
		)
	})
})

describe('server golden — form-checkbox (formAssociatedCheckbox)', () => {
	test('default: unchecked — no checked attributes anywhere', async () => {
		const html = await render('FormCheckbox', 'form-checkbox', {
			name: 'agree',
			label: 'I agree',
		})
		expect(html).toBe(
			'<form-checkbox name="agree"><label>' +
				'<input type="checkbox">' +
				'<span class="label">I agree</span>' +
				'</label></form-checkbox>',
		)
	})

	test('checked arg seeds host attribute AND the mirrored input', async () => {
		const html = await render('FormCheckbox', 'form-checkbox', {
			name: 'agree',
			label: 'I agree',
			checked: true,
		})
		expect(html).toBe(
			'<form-checkbox name="agree" checked><label>' +
				'<input type="checkbox" checked>' +
				'<span class="label">I agree</span>' +
				'</label></form-checkbox>',
		)
	})
})

describe('CSS golden — verbatim tag-scoped extraction', () => {
	test('basic-counter.css equals the hand-written artifact byte for byte', () => {
		expect(counter.component?.css).toBe(
			read('examples/basic/counter/basic-counter.css'),
		)
	})
	test('module-tabgroup.css equals the hand-written artifact byte for byte', () => {
		expect(tabgroup.component?.css).toBe(
			read('examples/module/tabgroup/module-tabgroup.css'),
		)
	})
	// The form fixture's style is authored in the .tsrx — now the fuller
	// migration (LT-020 follow-up): dimmed/focus-within opacity on
	// label/p/button, textarea alongside input, a `:state(clearable)`
	// custom-state hook instead of an author-set class, and `.description`
	// alongside `.error`. Extraction must still be verbatim, byte for byte.
	test('form-textbox.css equals the fixture style byte for byte', () => {
		expect(formTextbox.component?.css).toBe(`form-textbox {
	display: block;
	width: 100%;

	& label,
	& p,
	& button {
		opacity: var(--opacity-dimmed);
		transition: opacity var(--transition-short) var(--easing-inout);
	}

	& label {
		display: block;
		font-size: var(--font-size-s);
		color: var(--color-text);
		margin-bottom: var(--space-xxs);
	}

	& input,
	& textarea {
		display: inline-block;
		box-sizing: border-box;
		background: var(--color-input);
		color: var(--color-text);
		border: none;
		border-bottom: 1px solid var(--color-border);
		padding: var(--space-xs) var(--space-xxs);
		font-size: var(--font-size-m);
		width: 100%;

		&::placeholder {
			color: var(--color-text);
			opacity: var(--opacity-translucent);
		}
	}

	/* Native validity styling — replaces the old aria-invalid attribute hook.
	   :user-invalid matches after user interaction (the right UX for required
	   fields); :invalid would match immediately on page load. */
	&:user-invalid input,
	&:user-invalid textarea {
		box-shadow: 0 0 var(--space-xxs) 2px var(--color-error-invalid);
	}

	& input {
		height: var(--input-height);
	}

	/* Derived from markup, so it cannot drift from whether the button exists. */
	&:has(.clear) .input {
		position: relative;

		& input {
			padding-right: var(--input-height);
		}

		.clear {
			position: absolute;
			bottom: 0;
			right: 0;
			border: 0;
			border-radius: 50%;
			font-size: var(--font-size-xs);
			line-height: var(--line-height-xs);
			color: var(--color-input);
			background-color: var(--color-text-soft);
			width: calc(0.6 * var(--input-height));
			height: calc(0.6 * var(--input-height));
			margin: calc(0.2 * var(--input-height));
			padding: 0;

			&:hover {
				background-color: var(--color-text);
			}
		}
	}

	.error,
	.description {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-xs);
		line-height: var(--line-height-s);

		&:empty {
			display: none;
		}
	}

	.error {
		color: color-mix(in srgb, var(--color-text) 50%, var(--color-error));
	}

	.description {
		color: var(--color-text-soft);
	}

	&:focus-within {
		& label,
		& p,
		& button {
			opacity: var(--opacity-solid);
		}
	}
}
`)
	})

	// The module-list fixture's style is the Phase-0 spike's own stylesheet —
	// deliberately not the current hand-written module-list.css (different
	// spacing tokens, no @container block). Sync it when module-list migrates
	// for the docs; until then the golden pins verbatim extraction.
	test('module-list.css equals the fixture style byte for byte', () => {
		expect(moduleList.component?.css).toBe(`module-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-s);

	> form {
		display: flex;
		gap: var(--space-s);
		align-items: flex-start;
	}

	> [data-container] {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;

		> li {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: var(--space-s);
		}
	}
}
`)
	})
})
