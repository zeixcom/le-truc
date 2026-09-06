/**
 * Realm-side suppression for unresolvable expressions (ADR 0029 sub-design
 * 1's implementation constraint, LT-165 step 7).
 *
 * The generated client module is the shipped artifact and the realm replays
 * it: for a Simulated-tier component the connect installs EVERY binding,
 * including one whose thunk reads `Date.now()`/`Math.random()`, so without
 * suppression the serialized HTML bakes the build machine's reading into
 * the page permanently — exactly what sub-design 1 forbids ("the realm must
 * not fold one"). The compiler records each unresolvable site
 * (`RegistryEntry.suppressedSites`); the driver snapshots the sites'
 * skeleton state from an INERT parse of the markup — provably pre-connect,
 * because an already-defined tag upgrades DURING the `innerHTML` assignment
 * that parses the markup — and restores that state after the connect window
 * stabilizes, before serializing.
 *
 * The ordering is load-bearing, mapped onto today's mechanism (there is no
 * discrete two-pass gate module; the drain IS the stability mechanism):
 * revert strictly after `drainToQuiescence` has stabilized and before the
 * final serialization snapshot — never inside the drain loop, whose
 * stability comparison must observe the unsuppressed tree. A revert inside
 * the loop would either oscillate against the live binding or mask a
 * genuine non-quiescence.
 *
 * An impure reactive site ALONE does not make a component Simulated (step 5:
 * it stays Folded, phase 1 omits the site, no realm ever runs), so the
 * fixtures carry an impure site (attribute form and text-child form) AND a
 * genuine Simulated-tier routing signal — an unharvested signal, the
 * `module-ticker` shape. Ticker itself is unmigrated (its corpus pin rides
 * its migration), so the synthetic fixture is the pin now, in the step-5
 * synthetic-Static-fixture pattern.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../tsrx'
import { createSimulationRealm } from '../../tsrx/sim/realm'
import { createGeneratedDir } from '../helpers/generated-tsrx'

/**
 * Simulated-tier fixture with all three record forms: an impure reactive
 * ATTRIBUTE (`title`, attribute dispatch), an impure lazy TEXT CHILD
 * (`p`'s sole content — whole-textContent by the emission gate), and an
 * impure DIRTY-FLAG attribute (`value` on an `<input>`, LT-116 property
 * dispatch). The unharvested `seed` is the routing signal that makes the
 * component Simulated (resolution `realm`); its literal initializer keeps
 * the client module realm-executable (an initializer naming a server param
 * has no client representation — emit-client.ts).
 */
const simulatedFixture = `import { asString, createCell } from '@zeix/le-truc'

export function C({ name }: { name: string })
@{
	const seed = createCell('seed')
	expose({ label: asString('') })
	<>
		<c-el>
			<span class="stamp" title={() => host.label + Date.now()}>stamped</span>
			<p class="roll">{host.label.length + Math.random()}</p>
			<input class="field" value={() => host.label + Date.now()} />
		</c-el>

		<style>c-el { color: red }</style>
	</>
}`

/**
 * The same shape with the impure lazy child on the component ROOT — the
 * site the record addresses with the `'host'` sentinel, the one selector
 * the realm resolves against the rendered root rather than the document.
 */
const simulatedRootFixture = `import { asString, createCell } from '@zeix/le-truc'

export function C({ name }: { name: string })
@{
	const seed = createCell('seed')
	expose({ label: asString('') })
	<>
		<r-el>{host.label.length + Math.random()}</r-el>

		<style>r-el { color: red }</style>
	</>
}`

/**
 * The Folded control (step 5's pin, plus the suppression record): the
 * impure attribute site is recorded — unresolvability is per-EXPRESSION,
 * not per-tier — but the component stays Folded (the impure site is not a
 * routing signal), no realm ever opens for it, and its phase-1 output is
 * unchanged.
 */
const foldedFixture = `import { createCell } from '@zeix/le-truc'

export function C({}: {})
@{
	const length = createCell(0)
	expose({ length: length.get })
	<>
		<c-el>
			<span>{length}</span>
			<div title={() => length.get() + Date.now()}></div>
		</c-el>

		<style>c-el { color: red }</style>
	</>
}`

const generated = createGeneratedDir('suppression')
afterAll(() => generated.cleanup())

const simulated = compileComponent(
	simulatedFixture,
	'suppression.tsrx',
	new Set(),
)
const simulatedRoot = compileComponent(
	simulatedRootFixture,
	'suppression-root.tsrx',
	new Set(),
)
const folded = compileComponent(foldedFixture, 'folded.tsrx', new Set())

for (const [label, result] of [
	['simulated', simulated],
	['simulated-root', simulatedRoot],
	['folded', folded],
] as const) {
	if (!result.component)
		throw new Error(
			`${label} fixture failed to compile: ${JSON.stringify(result.diagnostics)}`,
		)
}

// Emit the artifacts every tier's mechanism runs (the realm replays the
// client module; the phase-1 render fn produces the markup it parses).
for (const [tag, result] of [
	['c-el', simulated],
	['r-el', simulatedRoot],
	['folded', folded],
] as const) {
	const component = result.component
	if (!component) continue
	generated.emit(`${tag}.server.ts`, component.serverCode)
	generated.emit(`${tag}.client.ts`, component.clientCode)
}

/** The phase-1 render function of an emitted fixture module. */
const serverRenderOf = async (
	filename: string,
): Promise<(args: unknown) => string> => {
	const mod = await generated.importModule<{
		renderC: (args: unknown) => string
	}>(filename)
	return mod.renderC
}

/* === The compile-time record === */

describe('the compile-time suppression record', () => {
	test('each unresolvable site is recorded with its realm address', () => {
		// Three forms: attribute dispatch, whole-textContent child, and the
		// dirty-flag attribute whose `prop` names the IDL property the
		// binding writes instead of the attribute (LT-116).
		expect(simulated.component?.entry.tier).toBe('simulated')
		expect(simulated.component?.entry.suppressedSites).toEqual([
			{ kind: 'attr', selector: 'span', attr: 'title' },
			{ kind: 'text', selector: 'p' },
			{ kind: 'attr', selector: 'input', attr: 'value', prop: 'value' },
		])
		expect(simulatedRoot.component?.entry.suppressedSites).toEqual([
			{ kind: 'text', selector: 'host' },
		])
	})

	test('the records are plain data — they ride registry.json', () => {
		for (const entry of [
			simulated.component?.entry,
			simulatedRoot.component?.entry,
			folded.component?.entry,
		])
			expect(JSON.parse(JSON.stringify(entry?.suppressedSites))).toEqual(
				entry?.suppressedSites,
			)
	})

	test('an impure site alone is not what makes the fixture Simulated', () => {
		// The routing signal is the unharvested signal (resolution `realm`);
		// the suppressed sites contribute no signal — the conjunction step 5
		// pinned, restated here so the fixture cannot silently lose the limb
		// that makes the realm run at all.
		expect(
			simulated.component?.entry.routingSignals.map(
				signal => signal.resolution,
			),
		).toEqual([{ by: 'realm' }])
	})

	test('the shipped client still binds every suppressed site', () => {
		// The realm cannot decline to install a binding (ADR 0029 s1's
		// implementation constraint): the generated client is the shipped
		// artifact and stays byte-honest — suppression is realm-side.
		const client = simulated.component?.clientCode ?? ''
		expect(client).toContain('Date.now()')
		expect(client).toContain('Math.random()')
		expect(client).toContain("bindAttribute(span, 'title')")
		expect(client).toContain('bindText(p)')
		expect(client).toContain("bindProperty(input, 'value')")
	})
})

/* === The realm-side revert === */

describe('the realm reverts suppressed sites before serializing', () => {
	// One realm for both Simulated fixtures (ADR 0027 sub-design 2/10).
	const realm = createSimulationRealm({
		suppressedSites: tag =>
			tag === 'c-el'
				? (simulated.component?.entry.suppressedSites ?? [])
				: tag === 'r-el'
					? (simulatedRoot.component?.entry.suppressedSites ?? [])
					: [],
	})
	afterAll(() => realm.dispose())

	test('fixtures loaded exactly once', async () => {
		await realm.load(() => generated.importModule('c-el.client.ts'))
		await realm.load(() => generated.importModule('r-el.client.ts'))
		expect(realm.definitions.map(entry => entry.name)).toEqual(['c-el', 'r-el'])
	})

	test('attribute site: the build machine’s clock does not reach the HTML', async () => {
		const render = await serverRenderOf('c-el.server.ts')
		const html = await realm.render({
			markup: render({ name: 'x' }),
			component: 'c-el',
		})
		// (a) Neither the attribute value nor a Date-derived string ships —
		// matched on the reading's SHAPE (13-digit epoch millis), not its
		// value, so the assertion cannot pass by coincidence of the seed.
		expect(html).not.toContain('title=')
		expect(html).not.toMatch(/\d{13}/)
		// (c) The site's server-rendered skeleton state (omission) is what
		// ships — the pre-connect snapshot, restored verbatim.
		expect(html).toContain('<span class="stamp">stamped</span>')
	})

	test('text-child site: the RNG reading does not reach the HTML', async () => {
		const render = await serverRenderOf('c-el.server.ts')
		const html = await realm.render({
			markup: render({ name: 'x' }),
			component: 'c-el',
		})
		expect(html).not.toMatch(/0\.\d{4,}/)
		expect(html).toContain('<p class="roll"></p>')
		// The dirty-flag site rides along: the attribute never serializes a
		// property write, but the IDL property must be reverted too.
		const input = realm.document.querySelector('input')
		expect(input?.getAttribute('value')).toBe(null)
		expect((input as unknown as { value: string }).value).toBe('')
	})

	test('root form: the host sentinel resolves against the rendered root', async () => {
		const render = await serverRenderOf('r-el.server.ts')
		const html = await realm.render({
			markup: render({ name: 'x' }),
			component: 'r-el',
		})
		expect(html).not.toMatch(/0\.\d{4,}/)
		expect(html).toContain('<r-el></r-el>')
		// The REPEAT render is the harder ordering case: r-el is already
		// defined in the realm, so jsdom upgrades it DURING the innerHTML
		// assignment that parses the markup — the binding writes before the
		// connect window's define replay even runs. The inert-skeleton
		// snapshot must still revert it.
		const second = await realm.render({ markup: html, component: 'r-el' })
		expect(second).toBe(html)
	})

	test('the render is still a connect fixed point, and quiescent (sub-designs 8/9)', async () => {
		const render = await serverRenderOf('c-el.server.ts')
		const markup = render({ name: 'x' })
		const first = await realm.render({ markup, component: 'c-el' })
		const second = await realm.render({ markup: first, component: 'c-el' })
		expect(second).toBe(first)
		const overruns = realm.diagnostics.filter(
			entry => entry.kind === 'non-quiescent',
		)
		expect(overruns).toEqual([])
	})

	test('without the wiring the pre-suppression tree DID carry the readings', async () => {
		// The standing in-test mutation control: the same component, the same
		// client module (copied tree — one module cache per process), a realm
		// wired WITHOUT `suppressedSites`. The binding's writes survive to
		// serialization, which is what the assertions above are measured
		// against — and what the build shipped before step 7.
		const unwired = createGeneratedDir('suppression-unwired')
		try {
			cpSync(generated.path, unwired.path, { recursive: true })
			const realm2 = createSimulationRealm()
			try {
				await realm2.load(
					() =>
						import(pathToFileURL(join(unwired.path, 'c-el.client.ts')).href),
				)
				const render = await serverRenderOf('c-el.server.ts')
				const html = await realm2.render({
					markup: render({ name: 'x' }),
					component: 'c-el',
				})
				expect(html).toMatch(/title="\d{13}"/)
				expect(html).toMatch(/<p class="roll">0\.\d+<\/p>/)
				// The dirty-flag case: the stale reading survives in the IDL
				// property even where the attribute does not serialize it —
				// the property revert is what removes it.
				const input = realm2.document.querySelector('input')
				expect((input as unknown as { value: string }).value).toMatch(
					/^\d{13}$/,
				)
			} finally {
				// LIFO against the file-level realm (its restores re-install
				// the outer realm's patches) — disposed before this file's
				// afterAll runs.
				realm2.dispose()
			}
		} finally {
			unwired.cleanup()
		}
	})
})

/* === The Folded tier is unaffected === */

describe('a Folded-tier component with an impure site', () => {
	test('stays Folded, keeps its output, and needs no realm', async () => {
		expect(folded.component?.entry.tier).toBe('folded')
		expect(folded.component?.entry.routingSignals).toHaveLength(0)
		// The record is per-expression, not per-tier — but inert: no realm
		// ever opens for a Folded-tier component, so nothing consumes it.
		expect(folded.component?.entry.suppressedSites).toEqual([
			{ kind: 'attr', selector: 'div', attr: 'title' },
		])
		// Phase-1 output unchanged: the site is omitted exactly as before
		// step 7, the rendered signal still renders.
		expect(folded.component?.serverCode).not.toContain('Date.now')
		const render = (
			await generated.importModule<{
				renderC: (args: unknown) => string
			}>('folded.server.ts')
		).renderC
		expect(await render({})).toBe('<c-el><span>0</span><div></div></c-el>')
	})
})
