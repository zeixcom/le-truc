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
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8')

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

if (!counter.component || !tabgroup.component || !formTextbox.component)
	throw new Error('corpus components must compile for golden tests')

// Generated server modules must exist for in-process execution; the effect
// normally writes them, tests must not depend on a prior build.
const ensureEmitted = (tag: string, code: string): void => {
	const out = path.join(ROOT, 'server/generated/tsrx', `${tag}.server.ts`)
	fs.mkdirSync(path.dirname(out), { recursive: true })
	fs.writeFileSync(out, code)
}
ensureEmitted('basic-counter', counter.component.serverCode)
ensureEmitted('module-tabgroup', tabgroup.component.serverCode)
ensureEmitted('form-textbox', formTextbox.component.serverCode)

const render = async (name: string, tag: string, args: unknown): Promise<string> => {
	const mod = await import(`../../generated/tsrx/${tag}.server.ts`)
	const fn = mod[`render${name}`] as (args: unknown) => string
	if (typeof fn !== 'function') throw new Error(`render function for ${tag} missing`)
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
	const tab = (id: string, label: string, content: string) => ({ id, label, content })

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
			tabs: [tab('15', 'Only Tab', 'Only panel content'), tab('16', 'Second Tab', 'Second panel content')],
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

describe('server golden — form-textbox variants (extensions, Parser-expose)', () => {
	const formTextboxHtml = ({
		name,
		label,
		value = '',
		required = false,
	}: {
		name: string
		label: string
		value?: string
		required?: boolean
	}): string =>
		`<form-textbox name="${name}" value="${value}">` +
		`<label for="${name}-input">${label}</label>` +
		'<div class="input">' +
		`<input type="text" id="${name}-input" autocomplete="off"${required ? ' required' : ''} value="${value}">` +
		'<button type="button" aria-label="Clear input" class="clear">✕</button>' +
		'</div>' +
		'<p role="alert" aria-live="assertive" class="error"></p>' +
		'</form-textbox>'

	test('default: empty value, optional field', async () => {
		const html = await render('FormTextbox', 'form-textbox', {
			name: 'name',
			label: 'Name',
		})
		expect(html).toBe(formTextboxHtml({ name: 'name', label: 'Name' }))
	})

	test('required: boolean arg renders the bare attribute', async () => {
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
		expect(html).toBe(formTextboxHtml({ name: 'nick', label: 'Nickname', value: 'Ada' }))
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
	// The form fixture's style is authored in the .tsrx (a subset of the
	// hand-written form-textbox.css — no :state(clearable), no textarea),
	// so the golden is the fixture's own dedented block: extraction must be
	// verbatim, byte for byte.
	test('form-textbox.css equals the fixture style byte for byte', () => {
		expect(formTextbox.component?.css).toBe(`form-textbox {
	display: block;
	width: 100%;

	& label {
		display: block;
		font-size: var(--font-size-s);
		color: var(--color-text);
		margin-bottom: var(--space-xxs);
	}

	& .input {
		position: relative;
	}

	& input {
		display: inline-block;
		box-sizing: border-box;
		background: var(--color-input);
		color: var(--color-text);
		border: none;
		border-bottom: 1px solid var(--color-border);
		padding: var(--space-xs) var(--space-xxs);
		font-size: var(--font-size-m);
		width: 100%;
		height: var(--input-height);

		&::placeholder {
			color: var(--color-text);
			opacity: var(--opacity-translucent);
		}
	}

	&:user-invalid input {
		box-shadow: 0 0 var(--space-xxs) 2px var(--color-error-invalid);
	}

	& .clear {
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
		cursor: pointer;

		&:hover {
			background-color: var(--color-text);
		}
	}

	.error {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-xs);
		line-height: var(--line-height-s);
		color: color-mix(in srgb, var(--color-text) 50%, var(--color-error));

		&:empty {
			display: none;
		}
	}
}
`)
	})
})
