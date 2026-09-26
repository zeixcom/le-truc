/**
 * The server emitter's tier flag (ADR 0029 sub-design 4, LT-165 step 4).
 *
 * Every component gets a render module in every tier — the realm PARSES the
 * phase-1 markup before replaying definitions, so the skeleton is simulation's
 * input, not its alternative. One emit path, one skeleton, one flag.
 *
 * What the flag changes is the SETUP BLOCK, filtered by one criterion
 * (LT-182): *retain a statement when the emitted markup depends on its
 * declared name, transitively; drop the rest.*
 *
 * The rule replaces LT-165 step 4's original two-part filter, which dropped
 * signal declarations wholesale. That was unsound: the skeleton and the value
 * harness are not separable layers, because `lazyValueExpression` emits
 * `<name>.get()` INTO the markup — a folded signal is not dead code
 * server-side, and dropping its declaration leaves the generated module
 * referencing an undeclared name (`TS2304` under `check:corpus`).
 *
 * Under the corrected rule, three cases fall out of one criterion instead of
 * being special-cased: plain consts stay when the skeleton interpolates them
 * (`form-combobox` folds `const inputId = \`${name}-input\`` into
 * `<label for>`, `<input id>`, `<p id>` and `aria-describedby`, and NOTHING
 * downstream restores them); folded signals stay for the same reason; and
 * `expose()` goes because it declares no name at all, so no markup expression
 * can reference it (an exposed-prop lazy child resolves through the
 * prop→signal map at COMPILE time to a literal).
 *
 * The Static tier has no corpus member and stays empty until wave 4 (ADR 0029
 * is explicit that the tier is rare by construction, not that the classifier
 * is unwired), so the Static CLASSIFICATION is pinned here with a SYNTHETIC
 * fixture. The Static EMIT path is additionally exercised over the whole
 * corpus below — every real component emitted at every tier — which is the
 * assertion whose absence let the original defect reach review.
 */

import { describe, expect, test } from 'bun:test'
import { emitServerModule } from '../../compiler/emit-server'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import { compileComponent } from '../../compiler/frontend/tsrx/index'
import type { EvaluationTier } from '../../compiler/tier'
import { compileCorpusSource, loadCorpus } from './corpus-fixture'

/**
 * A component whose only routing signal is served-relevant and unresolvable,
 * reached through the HARVEST path: `seed` is never rendered into the DOM
 * (the retired LTC004 shape) and its initializer reads the wall clock, which
 * no phase can answer — limb (b), `not-a-server-fact`. With no
 * realm-answerable signal to pull it up, the conjunction lands on the Static
 * tier. Until step 5 this shape could not compile at all (LTC004 was an
 * error), which is why the fixture originally routed through an impure
 * `hidden` thunk instead; step 5 rewired that route and the fixture was
 * re-pinned deliberately (LT-165).
 *
 * It also carries both setup shapes on purpose, so one fixture pins both
 * halves of the rule: `expose()` (declares no name — dropped) and `labelId`
 * (a plain const the skeleton interpolates — kept).
 */
const staticFixture = `import { asString, createCell } from '@zeix/le-truc'

export function C({ name }: { name: string })
@{
	const labelId = \`\${name}-label\`
	const seed = createCell(Date.now())
	expose({ label: asString('') })
	<>
		<c-el>
			<span class="label" id={labelId}>Label</span>
		</c-el>

		<style>c-el { color: red }</style>
	</>
}`

/**
 * The same component with the SAME unrendered signal, differing only in
 * whether the value has a server answer: a plain initializer is
 * realm-answerable (the realm connects the component for real and serializes
 * whatever the signal settles to). Resolution flips from `none` to `realm`,
 * and the conjunction lands one tier up. The initializer is a literal, not a
 * server arg: the client emits a harvest-less initializer verbatim, so an arg
 * there is LTC005 in every tier (LT-348).
 *
 * This is the control that makes the Static assertion mean something. A plain
 * Folded control would only prove the fixture has a routing signal at all;
 * this one isolates the limb.
 */
const simulatedFixture = staticFixture.replace(
	'createCell(Date.now())',
	'createCell(0)',
)

/** The same component with no routing signal at all — the Folded control. */
const foldedFixture = staticFixture.replace(
	'\tconst seed = createCell(Date.now())\n',
	'',
)

/**
 * The OTHER route to the Static tier, kept pinned because it exercises a
 * different origin: a semantically-loaded attribute (omitted `hidden` means
 * VISIBLE, a real LTC034 site) whose thunk reads the RNG. Step 5 left this
 * route intact — the fixture that used to be the only compilable Static pin.
 */
const impureHiddenFixture = `import { asString } from '@zeix/le-truc'

export function C({ name }: { name: string })
@{
	const labelId = \`\${name}-label\`
	expose({ label: asString('') })
	<>
		<c-el>
			<span class="label" id={labelId}>Label</span>
			<span class="maybe" hidden={() => Math.random() > 0.5}>maybe</span>
		</c-el>

		<style>c-el { color: red }</style>
	</>
}`

const emit = (source: string, tier: EvaluationTier) => {
	const { component } = compileSource(source, 'c.tsrx')
	if (!component) throw new Error('fixture failed to compile')
	return emitServerModule(component, {
		runtimeImport: 'r',
		sourcePath: 'c.tsrx',
		tier,
	}).code
}

/**
 * The module's rendering half: everything from the `__html` accumulator to the
 * end of the render function. That is the whole markup — the `__html.push`
 * lines AND the `@for` loop scaffolding around them, which a push-line filter
 * would miss — and nothing above it, so the setup block the tier flag filters
 * is excluded by construction. (LT-194: the slice must stop at the render
 * function's end — a Folded-tier module that declares the reserved `i18n`
 * parameter now also carries an `argsFromAttrs` export after it, which is
 * page-renderer plumbing, not markup.)
 */
const markupOf = (code: string) => {
	const at = code.indexOf('\tconst __html: string[] = []')
	expect(at).toBeGreaterThan(-1)
	const endMarker = "\treturn __html.join('')\n}"
	const end = code.indexOf(endMarker, at)
	expect(end).toBeGreaterThan(-1)
	return code.slice(at, end + endMarker.length)
}

describe('the synthetic Static-tier fixture', () => {
	test('classifies Static through the harvest path, for the recorded reason', () => {
		const { component, diagnostics } = compileComponent(
			staticFixture,
			'c.tsrx',
			new Set(),
		)
		// The unrendered signal no longer errors (LTC004 left the channel in
		// step 5) — the compile success is itself part of the pin.
		expect(diagnostics.some(d => d.severity === 'error')).toBe(false)
		expect(component?.entry.tier).toBe('static')
		const signals = component?.entry.routingSignals ?? []
		expect(signals).toHaveLength(1)
		expect(signals[0]?.origin).toBe('LTC004')
		expect(signals[0]?.detail).toContain('`seed`')
		expect(signals[0]?.resolution).toEqual({
			by: 'none',
			limb: 'not-a-server-fact',
			reason: 'reads the wall clock, which is a fact about the viewing moment',
		})
		// And the client declares the unharvested signal from its own
		// initializer — the artifact every tier's mechanism runs.
		expect(component?.clientCode).toContain('const seed = createCell(')
	})

	test('the impure-`hidden` route still classifies Static (LTC034 origin)', () => {
		// The route the fixture used before step 5 made the harvest path
		// compilable — kept pinned because the origin differs.
		const { component } = compileComponent(
			impureHiddenFixture,
			'c.tsrx',
			new Set(),
		)
		expect(component?.entry.tier).toBe('static')
		const signals = component?.entry.routingSignals ?? []
		expect(signals).toHaveLength(1)
		expect(signals[0]?.origin).toBe('LTC034')
	})

	test('the same signal with a realm-answerable value is Simulated, not Static', () => {
		// The conjunction, isolated: same component, same LTC004 origin, only
		// the resolution limb differs. Without this the Static assertion above
		// proves the fixture has a routing signal, not that the wall clock is
		// why.
		const { component } = compileComponent(
			simulatedFixture,
			'c.tsrx',
			new Set(),
		)
		expect(component?.entry.tier).toBe('simulated')
		const signals = component?.entry.routingSignals ?? []
		expect(signals).toHaveLength(1)
		expect(signals[0]?.origin).toBe('LTC004')
		expect(signals[0]?.resolution).toEqual({ by: 'realm' })
	})

	test('with no routing signal at all it classifies Folded', () => {
		const { component } = compileComponent(foldedFixture, 'c.tsrx', new Set())
		expect(component?.entry.tier).toBe('folded')
		expect(component?.entry.routingSignals).toHaveLength(0)
	})
})

describe('the tier flag filters setup to what the markup references', () => {
	test('a Static-tier module omits `expose()` and its runtime imports', () => {
		const code = emit(staticFixture, 'static')
		expect(code).not.toContain('expose(')
		// The import line has to follow the suppression, or the generated
		// module fails `check:corpus` on an unused import rather than on
		// anything to do with tiering.
		expect(code).not.toContain('asString')
		expect(code).not.toContain('expose')
	})

	test('a Static-tier module KEEPS plain setup consts the markup reads', () => {
		const code = emit(staticFixture, 'static')
		expect(code).toContain('const labelId = `${name}-label`')
		// The whole point of keeping it: the fold survives into the markup.
		expect(code).toContain("attr('id', labelId)")
	})

	test('a Simulated-tier module drops exactly what Static does', () => {
		// Sub-design 4 gives the two tiers the SAME skeleton; they differ only
		// in who corrects it afterwards (the realm vs. the client), which is
		// not an emit-time distinction. Pinning equality keeps a future change
		// from quietly giving one tier a richer module than the other.
		expect(emit(staticFixture, 'simulated')).toBe(emit(staticFixture, 'static'))
	})

	test('a Folded-tier module re-declares the whole setup verbatim', () => {
		const code = emit(staticFixture, 'folded')
		expect(code).toContain("expose({ label: asString('') })")
		expect(code).toContain('const labelId = `${name}-label`')
	})

	test('the tier changes only the setup block, never the markup', () => {
		// The load-bearing invariant of "one emit path, one skeleton": the
		// served bytes are the same in every tier, so routing a component
		// downward can never change what a no-JS reader sees before the realm
		// or the client gets involved.
		expect(markupOf(emit(staticFixture, 'static'))).toBe(
			markupOf(emit(staticFixture, 'folded')),
		)
	})

	test('the flag defaults to Folded for callers that do not classify', () => {
		const { component } = compileSource(staticFixture, 'c.tsrx')
		if (!component) throw new Error('fixture failed to compile')
		const withoutTier = emitServerModule(component, {
			runtimeImport: 'r',
			sourcePath: 'c.tsrx',
		}).code
		expect(withoutTier).toBe(emit(staticFixture, 'folded'))
	})
})

/**
 * A folded signal read from the markup: `count.get()` is spliced into the
 * `<span>`, so the declaration is load-bearing server-side. This is the shape
 * LT-165 step 4 dropped — it is `basic-counter` reduced to the one thing that
 * matters, kept synthetic so the assertion cannot be quietly weakened by an
 * edit to the real component.
 */
const foldedSignalFixture = `import { createCell } from '@zeix/le-truc'

export function C({ start = 0 }: { start?: number })
@{
	const count = createCell(start)
	expose({ count: count.get })
	<>
		<c-el>
			<span>{count}</span>
		</c-el>

		<style>c-el { color: red }</style>
	</>
}`

describe('a folded signal the markup reads survives every tier', () => {
	// The regression this task exists to add. Under step 4's original rule the
	// signal declaration went with the harness while `count.get()` stayed in
	// the markup, so the generated module referenced an undeclared name — a
	// `TS2304` build break that no test caught because the only tier fixture
	// had no markup-read signal.
	for (const tier of ['folded', 'simulated', 'static'] as const) {
		test(`\`${tier}\` declares the signal it splices into the markup`, () => {
			const code = emit(foldedSignalFixture, tier)
			expect(markupOf(code)).toContain('count.get()')
			expect(code).toContain('const count = createCell(start)')
			// And the constructor import has to follow the declaration, or the
			// module fails on an unresolved `createCell` instead.
			expect(code).toContain('createCell')
		})
	}

	test('`expose()` still goes, and takes its runtime import with it', () => {
		const code = emit(foldedSignalFixture, 'static')
		expect(code).not.toContain('expose')
		expect(emit(foldedSignalFixture, 'folded')).toContain(
			'expose({ count: count.get })',
		)
	})
})

/**
 * The invariant, over every real component instead of one fixture.
 *
 * `emit-tier.test.ts` originally asserted markup byte-identity only for the
 * synthetic fixture, which had no markup-read signal — that gap is precisely
 * why LT-165 step 4's unsound filter reached review. The corpus is where the
 * rule meets folded signals, `@for` scaffolding, compose sites and setup
 * chains, so the corpus is where the invariant has to be pinned.
 *
 * Compiled per file with `compileCorpusSource` rather than through the corpus
 * runner: the tier flag is an `emitServerModule` option, and the runner emits
 * each component at its OWN classified tier only. Cross-tier comparison needs
 * all three from one IR. No compose registry is threaded in for the same
 * reason — it is identical across the three emits, so it cannot affect a
 * difference between them.
 */
const corpus = await loadCorpus()

const emitCorpus = (tier: EvaluationTier) =>
	corpus.map(file => {
		const { component } = compileCorpusSource(file.content, file.filename)
		if (!component) throw new Error(`${file.filename} failed to compile`)
		return {
			component,
			code: emitServerModule(component, {
				runtimeImport: 'r',
				sourcePath: file.filename,
				tier,
			}).code,
		}
	})

describe('every corpus component, emitted at every tier', () => {
	test('the corpus is non-empty', () => {
		// Guards every loop below: an empty corpus would make them vacuous.
		expect(corpus.length).toBeGreaterThan(0)
	})

	for (const tier of ['simulated', 'static'] as const) {
		test(`\`${tier}\` serves markup byte-identical to Folded`, () => {
			// The property that makes the tier flag safe at all: routing a
			// component downward can never change what a no-JS reader sees
			// before the realm or the client gets involved.
			const folded = emitCorpus('folded')
			emitCorpus(tier).forEach(({ component, code }, index) => {
				expect(`${component.tag}\n${markupOf(code)}`).toBe(
					`${component.tag}\n${markupOf(folded[index]?.code ?? '')}`,
				)
			})
		})

		test(`\`${tier}\` declares every setup name the module still uses`, () => {
			// The acceptance criterion, and the defect's own failure mode: a
			// statement dropped while its name survives elsewhere in the module
			// is an undeclared reference — `TS2304` under `check:corpus`. Stated
			// as "dropped ⇒ absent" rather than over a markup slice, so it
			// covers loop scaffolding and retained statements' own bodies too.
			const undeclared: string[] = []
			for (const { component, code } of emitCorpus(tier)) {
				// Comments are not references: a JSDoc word that equals a setup
				// name (module-coloreditor's "color") would read as a use.
				const uncommented = code
					.replace(/\/\*[\s\S]*?\*\//g, '')
					.replace(/^\s*\/\/.*$/gm, '')
				const identifiers = new Set(
					uncommented.match(/[A-Za-z_$][\w$]*/g) ?? [],
				)
				for (const stmt of component.setup)
					if (
						stmt.name !== null &&
						!code.includes(`const ${stmt.name} `) &&
						identifiers.has(stmt.name)
					)
						undeclared.push(`${component.tag}: ${stmt.name}`)
			}
			expect(undeclared).toEqual([])
		})
	}

	test('every tier still drops `expose()`', () => {
		// `expose()` declares no name, so the retention rule can never keep it
		// — but it is the construct the tier flag exists to remove, so the
		// corpus pins that it actually goes, in both suppressed tiers.
		for (const tier of ['simulated', 'static'] as const) {
			const kept = emitCorpus(tier)
				.filter(({ code }) => code.includes('expose('))
				.map(({ component }) => component.tag)
			expect(kept).toEqual([])
		}
	})

	test('the Folded emit is what an unclassified caller still gets', () => {
		// The default is the pre-LT-165 behaviour for the whole corpus, not
		// just the fixture: no caller that skips classification loses setup.
		emitCorpus('folded').forEach(({ component, code }, index) => {
			const file = corpus[index]
			if (!file) throw new Error('corpus index out of range')
			expect(
				emitServerModule(component, {
					runtimeImport: 'r',
					sourcePath: file.filename,
				}).code,
			).toBe(code)
		})
	})
})
