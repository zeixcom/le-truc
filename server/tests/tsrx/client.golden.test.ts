/**
 * Golden tests — client half (LT-002): the generated `defineComponent()`
 * modules must equal the committed snapshots (regenerate with
 * `UPDATE_SNAPSHOTS=1 bun test server/tests/tsrx` or
 * `bun server/tests/tsrx/update-snapshots.ts`) and must typecheck against
 * the real `@zeix/le-truc` types — emit-then-check, the CI half of ADR
 * 0023 sub-design 6.
 *
 * The snapshots ARE the convergence evidence from
 * spike/tsrx-phase0/expected/unified-lowerings.md: statement-for-statement
 * today's hand-written components, imports solely from '@zeix/le-truc'.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')
const read = (rel: string): string =>
	fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(ROOT, rel), 'utf8')

const registry = new Set<string>([
	'basic-counter',
	'module-tabgroup',
	'form-textbox',
	'form-checkbox',
	'module-list',
	'basic-button',
])
// Child-module map: migrated tags → generated clients, hand-written tags →
// their example sources (the child authors its element interface inline via
// declare global; the generated client side-effect-imports the module).
const childImports = new Map<string, string>([
	['basic-counter', './basic-counter.client'],
	['module-tabgroup', './module-tabgroup.client'],
	['form-textbox', './form-textbox.client'],
	['form-checkbox', './form-checkbox.client'],
	['module-list', './module-list.client'],
	['basic-button', '../../../examples/basic/button/basic-button'],
])
const SOURCES = [
	'examples/basic/counter/basic-counter.tsrx',
	'examples/module/tabgroup/module-tabgroup.tsrx',
	'examples/form/textbox/form-textbox.tsrx',
	'examples/form/checkbox/form-checkbox.tsrx',
	'examples/module/list/module-list.tsrx',
] as const

// module-list composes FormTextbox (ADR 0023 sub-design 10, LT-020) — the
// compose registry must be built before it compiles, keyed by form-textbox's
// own repo-relative source path (mirroring server/effects/tsrx.ts).
const formTextboxResult = compileComponent(
	read('examples/form/textbox/form-textbox.tsrx'),
	'examples/form/textbox/form-textbox.tsrx',
	registry,
	childImports,
)
const composeRegistry = new Map(
	formTextboxResult.component
		? [
				[
					'examples/form/textbox/form-textbox.tsrx',
					formTextboxResult.component.entry,
				],
			]
		: [],
)

const compiled = SOURCES.map(rel => ({
	rel,
	result:
		rel === 'examples/form/textbox/form-textbox.tsrx'
			? formTextboxResult
			: compileComponent(
					read(rel),
					rel,
					registry,
					childImports,
					composeRegistry,
				),
}))

describe('client golden — generated modules match snapshots', () => {
	for (const { rel, result } of compiled) {
		test(`${rel} → snapshot`, () => {
			const { component, diagnostics } = result
			for (const d of diagnostics) console.warn(`[${d.code}] ${d.message}`)
			if (!component) throw new Error(`${rel} did not compile`)
			const snapshotPath = path.join(
				ROOT,
				'server/tests/tsrx/snapshots',
				`${component.entry.tag}.client.ts.snap`,
			)
			if (process.env.UPDATE_SNAPSHOTS === '1') {
				fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
				fs.writeFileSync(snapshotPath, component.clientCode)
				console.log(`updated ${snapshotPath}`)
			}
			expect(component.clientCode).toBe(read(snapshotPath))
		})
	}
})

describe('client golden — convergence with the hand-written trio', () => {
	test('basic-counter: same seed, handler, and binding as the hand-written component', () => {
		const code = compiled[0]?.result.component?.clientCode ?? ''
		expect(code).toContain(
			"import { asInteger, bindText, createCell, defineComponent } from '@zeix/le-truc'",
		)
		expect(code).toContain("first('span'")
		expect(code).toContain('createCell(asInteger()(span.textContent))')
		expect(code).toContain(
			"on(button, 'click', () => count.set(count.get() + 1))",
		)
		expect(code).toContain('watch(count, bindText(span))')
	})

	test('module-tabgroup: DOM-seeded selection, per-tab effects, hoisted-const rebinding', () => {
		const code = compiled[1]?.result.component?.clientCode ?? ''
		expect(code).toContain('all(\'button[role="tab"]\'')
		expect(code).toContain('all(\'[role="tabpanel"]\'')
		expect(code).toContain(
			"tabs.get().find(el => el.ariaSelected === 'true')?.getAttribute('aria-controls') ?? ''",
		)
		expect(code).toContain('each(tabs, tab => {')
		expect(code).toContain("const pid = tab.getAttribute('aria-controls')!")
		expect(code).toContain(
			"watch(() => String(selected.get() === pid), bindAttribute(tab, 'aria-selected'))",
		)
		expect(code).toContain("on(tab, 'click', () => selected.set(pid))")
		expect(code).toContain('const pid = tab.id')
		expect(code).toContain(
			"watch(() => selected.get() !== pid, bindAttribute(tab, 'hidden'))",
		)
	})

	test('form-textbox: extensions array, Parser-expose, defineMethod, host-mirror, managed watch', () => {
		const code = compiled[2]?.result.component?.clientCode ?? ''
		// Extension activation (sub-design 8): formAssociated leads the
		// emitted array — the FormFactoryContext overload selector.
		// `value` is deliberately not in observedAttributes (LT-057): the
		// attribute is the reset baseline, not a live-value channel.
		expect(code).toContain('\t[formAssociated()],')
		expect(code).toContain(
			"import { asString, bindAttribute, bindProperty, bindText, createCell, defineComponent, defineMethod, deriveCell, formAssociated } from '@zeix/le-truc'",
		)
		expect(code).toContain(
			"import type { FormAssociatedElement } from '@zeix/le-truc'",
		)
		// host/internals destructure from the factory context (ambients —
		// internals arrives via the client-only setup side effect)
		expect(code).toContain(
			'({ expose, first, host, internals, on, watch }) => {',
		)
		// Attribute-driven prop + method producer, verbatim expose shape
		expect(code).toContain("value: asString(''),")
		expect(code).toContain('length: length.get,')
		// Arg-substituted seed (LT-008): the param's mirror site is the live
		// input — the hand-written seeds createState(textbox.value.length).
		expect(code).toContain('const length = createCell(input.value.length)')
		// @if union addressing: whichever branch rendered is the element found.
		// The message is the author's own first()-declared reason (LT-055),
		// not the usual auto-generated one — the one part of the source
		// `first()` call that flows into the generated code verbatim.
		expect(code).toContain(
			"const input = first('textarea, input', 'text control')",
		)
		// `clearable`/`validatable` each gate an optional element (LT-008,
		// single-branch @if, no @else): the button/error-paragraph queries are
		// non-throwing `first()`, and their effects — including the bare
		// client-only `internals?.states.add('clearable')` statement sitting
		// beside the button in the branch — only run guarded by presence.
		expect(code).toContain("const button = first('button')")
		expect(code).toContain('if (button) {')
		expect(code).toContain("internals?.states.add('clearable')")
		expect(code).toContain('clear: defineMethod(() => {')
		// The host-prop mirror lowers to a property dispatch (AGENTS.md rule)
		expect(code).toContain(
			"watch(() => host.value, bindProperty(input, 'value'))",
		)
		// Managed form prop as watch source. Since LT-052 the source spelling
		// is a `host.<prop>` read lowering to watch()'s thunk overload, not
		// the FormFactoryContext string-key overload — `host.validationMessage`
		// still typechecks only against a FormAssociatedElement-typed host, so
		// the extension ordering stays type-enforced, just via the host type
		// rather than the watch() key.
		// (named p2: the description paragraph claimed `p` first, harvested
		// via arg-substitution rather than a direct site — ADR 0023 sub-design 12)
		expect(code).toContain('const p2 = first(\'p[role="alert"]\')')
		expect(code).toContain('watch(() => host.validationMessage, bindText(p2))')
		// description: a deriveCell harvested via arg-substitution (LT-024) —
		// the raw template is traced to the paragraph's own data-remaining
		// attribute (not the root), and `maxlength` to the input's plain
		// attribute — both descendant sites, not the root's own mirror.
		expect(code).toContain('const p = first(\'p[class="description"]\')')
		expect(code).toContain('const descriptionCell = deriveCell(() => {')
		expect(code).toContain(
			"const template = (p?.getAttribute('data-remaining') ?? '');",
		)
		expect(code).toContain(
			"Number((input.getAttribute('maxlength') ?? '')) > 0",
		)
		expect(code).toContain('if (p) {')
		expect(code).toContain('watch(descriptionCell, bindText(p))')
	})

	test('form-checkbox: formAssociatedCheckbox leads, checked mirror, return-update handler', () => {
		const code = compiled[3]?.result.component?.clientCode ?? ''
		expect(code).toContain(
			"import { asBoolean, bindProperty, defineComponent, formAssociatedCheckbox } from '@zeix/le-truc'",
		)
		expect(code).toContain('\t[formAssociatedCheckbox()],')
		expect(code).toContain('checked: asBoolean(false),')
		// Both mirrors dispatch as properties — checked from the parser-exposed
		// prop, disabled from the extension member (FormAssociatedElement).
		expect(code).toContain(
			"watch(() => host.checked, bindProperty(checkbox, 'checked'))",
		)
		expect(code).toContain(
			"watch(() => host.disabled, bindProperty(checkbox, 'disabled'))",
		)
		// The on() return-update form passes through verbatim
		expect(code).toContain(
			"on(checkbox, 'change', () => ({ checked: checkbox.checked }))",
		)
	})

	test('module-list: reconcile() with generated bindItem, DOM-seeded list, pass() on registry child', () => {
		const code = compiled[4]?.result.component?.clientCode ?? ''
		expect(code).toContain(
			"import { bindText, createList, defineComponent, reconcile } from '@zeix/le-truc'",
		)
		// Static seed passes through verbatim — the server rendered from the
		// same literal, so the DOM agrees by construction.
		expect(code).toContain('const items = createList<string>([], {')
		expect(code).toContain(
			"const template = first('template', 'module-list: template missing')",
		)
		// The spec lowering (unified-lowerings.md §3), hardened in review: the
		// value site is bound reactively (bindItem runs once per entering
		// element — a one-shot read goes stale on in-place updates), and the
		// textContent write is idempotent for adopted items while replacing
		// the template's slot in clones.
		expect(code).toContain(
			'reconcile(container, template, items, (_element, item, k, first) => {',
		)
		expect(code).toContain(
			"watch(item, bindText(first('span', 'module-list: span missing')))",
		)
		expect(code).toContain(
			"const button = first('button', 'module-list: button missing')",
		)
		expect(code).toContain("on(button, 'click', () => items.remove(k))")
		// Registry-aware dispatch: basic-button is a known component, so the
		// reactive attribute lowers to mediated pass(), not bindProperty.
		expect(code).toContain(
			'pass(basicButton, { disabled: { get: () => !textbox.length } })',
		)
	})

	test('registry entry records both halves', () => {
		for (const { result } of compiled) {
			const entry = result.component?.entry
			expect(entry?.serverModule).toMatch(/\.server\.ts$/)
			expect(entry?.clientModule).toMatch(/\.client\.ts$/)
			expect(entry?.css).toMatch(/\.css$/)
		}
	})
})

describe('client golden — emit-then-check (ADR 0023 sub-design 6)', () => {
	test('generated client modules typecheck against @zeix/le-truc', async () => {
		const files: string[] = []
		for (const { result } of compiled) {
			const component = result.component
			if (!component) throw new Error('corpus must compile')
			const out = path.join(
				ROOT,
				'server/generated/tsrx',
				component.entry.clientModule,
			)
			fs.mkdirSync(path.dirname(out), { recursive: true })
			fs.writeFileSync(out, component.clientCode)
			files.push(out)
		}
		const proc = Bun.spawn(
			[
				'bunx',
				'tsc',
				'--ignoreConfig',
				'--noEmit',
				'--strict',
				'--target',
				'esnext',
				'--module',
				'esnext',
				'--moduleResolution',
				'bundler',
				'--lib',
				'esnext,dom',
				'--skipLibCheck',
				// Child-module side-effect imports pull hand-written examples
				// (and through them src/) into the program; src/ reads
				// process.env.DEV_MODE, typed by @types/node as in tsconfig.
				'--types',
				'node',
				...files,
			],
			{ stdout: 'pipe', stderr: 'pipe', cwd: ROOT },
		)
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		])
		expect(`${stdout}${stderr}`).toBe('')
		expect(exitCode).toBe(0)
	}, 60000)
})
