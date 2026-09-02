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
import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'
import { createGeneratedDir } from '../helpers/generated-tsrx'

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
// Child-module map: migrated tags → generated clients. This fixture models a
// FULLY-CUT corpus (every tag served from its generated client) so the
// emit-then-check typecheck resolves; the live pipeline (server/effects/tsrx)
// additionally keeps hand-written twins mapped to their source modules while
// they remain mounted (LT-112 dual-state rule) — basic-button is such a tag
// today, so real module-list.client.ts imports the twin, not the client.
const childImports = new Map<string, string>([
	['basic-counter', './basic-counter.client'],
	['module-tabgroup', './module-tabgroup.client'],
	['form-textbox', './form-textbox.client'],
	['form-checkbox', './form-checkbox.client'],
	['module-list', './module-list.client'],
	['basic-button', './basic-button.client'],
])
const SOURCES = [
	'examples/basic/counter/basic-counter.tsrx',
	'examples/module/tabgroup/module-tabgroup.tsrx',
	'examples/form/textbox/form-textbox.tsrx',
	'examples/form/checkbox/form-checkbox.tsrx',
	'examples/module/list/module-list.tsrx',
] as const
// Compiled for the emit-then-check pass only: reachable from a SOURCES
// client's child-module import, but carrying no snapshot of its own.
const TYPECHECK_DEPS = ['examples/basic/button/basic-button.tsrx'] as const

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
			"import { asInteger, bindText, defineComponent } from '@zeix/le-truc'",
		)
		// Sub-design 16: the authored import line re-emits alongside the
		// synthesized one, which drops the names it provides.
		expect(code).toContain("import { createCell } from '@zeix/le-truc'")
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
			"import { bindAttribute, bindProperty, bindText, defineComponent, formAssociated } from '@zeix/le-truc'",
		)
		// Sub-design 16: authored real-export names ride their own line.
		expect(code).toContain(
			"import { createCell, deriveCell, asString, defineMethod } from '@zeix/le-truc'",
		)
		expect(code).toContain(
			"import type { FormAssociatedElement } from '@zeix/le-truc'",
		)
		// host destructures from the factory context. No `internals` ambient
		// here (LT-060): `:has(.clear)` replaced the imperative
		// `internals?.states.add('clearable')` client-stmt, so the factory
		// never touches internals directly.
		expect(code).toContain('({ expose, first, host, on, watch }) => {')
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
		// non-throwing `first()`, and their effects only run guarded by presence.
		expect(code).toContain("const button = first('button')")
		expect(code).toContain('if (button) {')
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
		// description (LT-113): a WRITABLE createCell whose seed is harvested
		// from the paragraph's own data-remaining attribute (arg-substitution),
		// with the remaining-count as a separate deriveCell display derivation
		// over it — maxlength traced to the input's plain attribute, a
		// descendant site. The paragraph binds the DERIVATION; a prop write
		// flows through the exposed Slot into the cell and re-derives.
		// A TOKEN clause since LT-124 — and the hand-written twin this test
		// checks convergence against wrote `first('.description')`, so the
		// token form converges where the exact-match form diverged.
		expect(code).toContain("const p = first('p.description')")
		expect(code).toContain(
			"const descriptionCell = createCell((p?.getAttribute('data-remaining') ?? ''))",
		)
		expect(code).toContain('const remainingCount = deriveCell(() => {')
		expect(code).toContain(
			"Number((input.getAttribute('maxlength') ?? '')) > 0",
		)
		expect(code).toContain('if (p) {')
		expect(code).toContain('watch(remainingCount, bindText(p))')
		expect(code).toContain('description: descriptionCell,')
	})

	test('form-checkbox: formAssociatedCheckbox leads, checked mirror, return-update handler', () => {
		const code = compiled[3]?.result.component?.clientCode ?? ''
		expect(code).toContain(
			"import { bindProperty, defineComponent, formAssociatedCheckbox } from '@zeix/le-truc'",
		)
		expect(code).toContain("import { asBoolean } from '@zeix/le-truc'")
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
			"import { bindText, defineComponent, reconcile } from '@zeix/le-truc'",
		)
		expect(code).toContain("import { createList } from '@zeix/le-truc'")
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

// A per-run directory for the emit-then-check pass, not the build pipeline's
// output (LT-140). It sits at the same depth under the repo root as the real
// `server/generated/tsrx/`, so relative specifiers in the emitted clients
// resolve identically.
const generated = createGeneratedDir('client-golden')
afterAll(() => generated.cleanup())

describe('client golden — emit-then-check (ADR 0023 sub-design 6)', () => {
	test('generated client modules typecheck against @zeix/le-truc', async () => {
		const files: string[] = []
		for (const { result } of compiled) {
			const component = result.component
			if (!component) throw new Error('corpus must compile')
			files.push(
				generated.emit(component.entry.clientModule, component.clientCode),
			)
		}
		// module-list's client side-effect-imports './basic-button.client'
		// because `childImports` models a fully-cut corpus. basic-button has
		// no snapshot of its own and is deliberately not in SOURCES, but the
		// typecheck program still needs the module to exist. Emit it here:
		// until LT-140 this test passed only when a previous `build-tsrx` had
		// happened to leave the file in the shared output directory.
		for (const rel of TYPECHECK_DEPS) {
			const { component } = compileComponent(
				read(rel),
				rel,
				registry,
				childImports,
			)
			if (!component) throw new Error(`${rel} must compile`)
			generated.emit(component.entry.clientModule, component.clientCode)
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
