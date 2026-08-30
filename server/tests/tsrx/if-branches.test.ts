/**
 * `@if`/`@else` addressing (LT-118): union addressing over branch roots,
 * extended to structurally DIFFERING branch roots via per-branch addressing.
 *
 * - Identical construct text on every branch root keeps union addressing
 *   byte-for-byte: ONE throwing query whose selector unions both roots —
 *   whichever branch rendered is the element found (LT-008).
 * - DIFFERING constructs (different construct key sets, or the same key with
 *   different text — the shapes that used to be TSRX005/"constructs differ"
 *   and TSRX031/asymmetric) now route to per-branch addressing: each branch
 *   is addressed independently with a non-throwing `first()` and a
 *   `'guarded'` effect block — exactly how a plain `@try`'s two arms are
 *   addressed (LT-025), since the branches are different content, not the
 *   same construct duplicated.
 * - Exclusivity is structural: at most one branch's root exists in the DOM,
 *   so at most one guard is ever true — mutually-exclusive branches never
 *   double-bind. But only if each branch root's selector cannot match the
 *   OTHER branch's markup; roots indistinguishable by statics keep an error
 *   (TSRX007) naming the fix, because two existence guards over one
 *   selector would BOTH be true on the one rendered element.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')

// `text` (the server arg) and `note` (the Parser-exposed prop) are
// deliberately DIFFERENT names: a site rendering an arg that is also
// a Parser prop is TSRX039 (LT-122, one value through two channels),
// which these fixtures are not about.
const wrap = (template: string, tag = 'c-el'): string =>
	`export function C({ big, text }: { big?: boolean; text?: string })
@{
	expose({ note: asString('') })
	<>
		<${tag}>
			${template}
		</${tag}>
		<style>${tag} { color: red }</style>
	</>
}
import { asString } from '@zeix/le-truc'`

const compile = (template: string) =>
	compileComponent(wrap(template), 'c.tsrx', new Set(['c-el']))

/** Every `const x = first('sel')` maybe-query in the generated client. */
const maybeQueries = (code: string): string[] =>
	[...code.matchAll(/const (\w+) = first\('([^']*)'\)/g)].map(m => m[2] ?? '')

/** Every `if (x) { … }` guarded block's body (one nesting level deep). */
const guardBodies = (code: string): string[] =>
	[...code.matchAll(/if \(\w+\) \{\n([\s\S]*?)\n\t\t\}/g)].map(m => m[1] ?? '')

describe('@if/@else union addressing over differing branch roots (LT-118)', () => {
	test('differing constructs on distinguishable roots are addressable, each branch scoped to its own guard', () => {
		const { component, diagnostics } = compile(`@if (big) {
			<button type="button" class="cta" onClick={() => { host.stepDown() }}>{text}</button>
		} @else {
			<input class="qty" value={() => String(host.note.length)} onChange={() => {}} />
		}`)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		const code = component?.clientCode ?? ''
		// Two DISTINCT non-throwing queries (the maybe cardinality carries no
		// required-reason argument), never one union selector.
		const queries = maybeQueries(code)
		expect(queries.length).toBe(2)
		for (const selector of queries) expect(selector).not.toContain(',')
		// No union query at all — a 'one'-cardinality query always carries
		// its message argument.
		expect(code).not.toMatch(/first\('[^']*, '/)
		// Each branch's effects sit inside its own existence guard, scoped
		// to that branch's constructs only — the @if branch's handler never
		// shares a guard with the @else branch's thunk.
		const guards = guardBodies(code)
		expect(guards.length).toBe(2)
		const [ifGuard, elseGuard] = guards
		expect(ifGuard).toContain('host.stepDown')
		expect(ifGuard).not.toContain('host.note')
		expect(elseGuard).toContain('host.note')
		expect(elseGuard).not.toContain('host.stepDown')
	})

	test('a construct on only one branch root is addressable when the roots are distinguishable (was TSRX031)', () => {
		const { component, diagnostics } = compile(`@if (big) {
			<button type="button" class="cta" onClick={() => {}}>a</button>
		} @else {
			<input class="qty" value={text} />
		}`)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		const code = component?.clientCode ?? ''
		// The bare `button` candidate is unique in the template and matches
		// nothing under the @else branch (an <input>), so it wins over the
		// type discriminator — one maybe query, one guard.
		expect(maybeQueries(code)).toEqual(['button'])
		expect(guardBodies(code).length).toBe(1)
	})

	test('mutually-exclusive branches never double-bind: indistinguishable roots stay an error (TSRX007)', () => {
		// Both branch roots are bare <strong> — per-branch guards could not
		// tell the branches apart (both queries would find the one rendered
		// element), and union addressing cannot carry the asymmetric
		// construct. This is the shape the old TSRX031 protected; an
		// error is still reported, naming the fix.
		const { diagnostics } = compile(`@if (big) {
			<strong>a</strong>
		} @else {
			<strong onClick={() => {}}>b</strong>
		}`)
		const hit = diagnostics.find(d => d.code === 'TSRX007')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('distinguishing')
	})

	test('differing construct text on same-tag, same-class roots is TSRX007 (the old "constructs differ" shape)', () => {
		const { diagnostics } = compile(`@if (big) {
			<strong onClick={() => {}}>a</strong>
		} @else {
			<strong onClick={() => { }}>b</strong>
		}`)
		const hit = diagnostics.find(d => d.code === 'TSRX007')
		expect(hit).toBeDefined()
	})

	test('distinctly-classed same-tag roots with differing construct text address per-branch', () => {
		const { component, diagnostics } = compile(`@if (big) {
			<button type="button" class="buy" onClick={() => {}}>a</button>
		} @else {
			<button type="button" class="sell" onClick={() => { }}>b</button>
		}`)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		const code = component?.clientCode ?? ''
		// The bare-tag and type candidates match BOTH branches (exclusivity-
		// aware counting calls them unique) — per-branch resolution must
		// skip them for the class discriminator, or the two guards would
		// both bind the one rendered button.
		// Class discriminators are TOKEN clauses since LT-124, and
		// `matchesSelector` must recognize them or the collision check
		// above silently stops rejecting anything.
		expect(maybeQueries(code).sort()).toEqual(['button.buy', 'button.sell'])
	})

	test('identical constructs on both branch roots keep union addressing (one throwing query, no guards)', () => {
		const { component, diagnostics } = compile(`@if (big) {
			<strong onClick={() => {}}>a</strong>
		} @else {
			<strong onClick={() => {}}>b</strong>
		}`)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		const code = component?.clientCode ?? ''
		expect(code).toMatch(/const \w+ = first\('strong', '/)
		expect(maybeQueries(code)).toEqual([])
	})

	test('a bare client-only statement in a per-branch-addressed branch is guarded, not rejected', () => {
		const { component, diagnostics } = compile(`@if (big) {
			internals?.states.add('cta')
			<button type="button" class="cta" onClick={() => {}}>a</button>
		} @else {
			<input class="qty" value={text} />
		}`)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		const code = component?.clientCode ?? ''
		expect(code).toContain("internals?.states.add('cta')")
		// The statement runs only when its branch rendered — inside the
		// branch root's existence guard, never bare at factory top level.
		const wrapping = code.match(
			/if \(\w+\) \{\n[\s\S]*?internals\?\.states\.add\('cta'\)[\s\S]*?\n\t\t\}/,
		)
		expect(wrapping).toBeDefined()
	})

	test('a branch root selector matching a DEEP element of the other branch is TSRX007', () => {
		// The @else branch's static inner <button class="cta"> would be
		// found by the @if branch's per-branch query when the @else branch
		// rendered — the wrong element gets the @if branch's effects.
		const { diagnostics } = compile(`@if (big) {
			<button type="button" class="cta" onClick={() => {}}>a</button>
		} @else {
			<p class="fallback"><button type="button" class="cta">b</button></p>
		}`)
		const hit = diagnostics.find(d => d.code === 'TSRX007')
		expect(hit).toBeDefined()
	})

	test('a construct-free @else with a constructed @if root addresses per-branch (no throwing query)', () => {
		// The union query is cardinality 'one' — an @else guarantees SOME
		// branch rendered — which would throw MissingElementError whenever
		// the construct-free branch is the one that rendered. The
		// constructed root must be addressed as maybe instead.
		const { component, diagnostics } = compile(`@if (big) {
			<strong class="cta" onClick={() => {}}>a</strong>
		} @else {
			<span class="plain">fallback</span>
		}`)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		const code = component?.clientCode ?? ''
		expect(maybeQueries(code)).toEqual(['strong'])
		expect(guardBodies(code).length).toBe(1)
	})

	test('a control-flow arm cannot hold bare text — it is statement context', () => {
		// Not a Le Truc restriction: an `@if`/`@else` block body is parsed as
		// STATEMENTS, so `+` or `plain text` is read as JavaScript, not as a
		// text child. Pinned because assuming otherwise is what produced both
		// an unparseable form-spinbutton source and this file's original
		// version of the test above (LT-118). Wrap text in an element.
		const bare = compile(`@if (big) {
			<strong class="cta" onClick={() => {}}>a</strong>
		} @else {
			+
		}`)
		expect(bare.diagnostics.some(d => d.code === 'TSRX008')).toBe(true)

		// A bare word parses (as an expression statement) and is then
		// rejected by the sanctioned-statement gate rather than the parser.
		const word = compile(`@if (big) {
			<strong class="cta" onClick={() => {}}>a</strong>
		} @else {
			fallback
		}`)
		expect(word.diagnostics.some(d => d.code === 'TSRX005')).toBe(true)
	})

	test('server render picks the branch per args for per-branch-addressed constructs', async () => {
		// Its own tag: the executed-module import below caches by file path,
		// which other suites' `c-el` fixtures share.
		const template = `@if (big) {
			<button type="button" class="cta" onClick={() => {}}>a</button>
		} @else {
			<input class="qty" value={text} />
		}`
		const { component } = compileComponent(
			wrap(template, 'c-if-branch'),
			'c.tsrx',
			new Set(['c-if-branch']),
		)
		expect(component).not.toBeNull()
		const out = path.join(
			ROOT,
			'server/generated/tsrx',
			'c-if-branch.server.ts',
		)
		fs.mkdirSync(path.dirname(out), { recursive: true })
		fs.writeFileSync(out, component?.serverCode ?? '')
		const mod = await import(out)
		const thenHtml = mod.renderC({ big: true, text: 'x' })
		const elseHtml = mod.renderC({ text: 'x' })
		expect(thenHtml).toContain('class="cta"')
		expect(thenHtml).not.toContain('class="qty"')
		expect(elseHtml).toContain('class="qty"')
		expect(elseHtml).not.toContain('class="cta"')
	})
})

describe('two ref-addressed elements in one @if branch (LT-130)', () => {
	// A separate fixture from `wrap` above: these need `first()` consts in
	// setup, which is the whole point — an element the author addressed
	// explicitly does not need the branch's synthesized union selector.
	const withRefs = (setup: string, template: string): string =>
		`export function C({ big, text }: { big?: boolean; text?: string })
@{
${setup}
	expose({ note: asString('') })
	<>
		<c-el>
			${template}
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { asString } from '@zeix/le-truc'`

	const compileRefs = (setup: string, template: string) =>
		compileComponent(withRefs(setup, template), 'c.tsrx', new Set(['c-el']))

	test('each keeps its own optional query and its own existence guard', () => {
		const { component, diagnostics } = compileRefs(
			`	const zeroSpan = first('span.zero')
	const otherSpan = first('span.other')`,
			`@if (big) {
				<>
					<span class="zero" hidden={() => host.note === 'x'}>{text}</span>
					<span class="other" hidden={() => Boolean(zeroSpan)}>+</span>
				</>
			} @else {
				<>+</>
			}`,
		)
		// The exact shape LT-118 could not express: two elements in one
		// branch, each with its own client constructs and its own `first()`.
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		const code = component?.clientCode ?? ''
		expect(maybeQueries(code)).toEqual(
			expect.arrayContaining(['span.zero', 'span.other']),
		)
		const guards = guardBodies(code)
		const zeroGuard = guards.find(g => g.includes('zeroSpan,'))
		const otherGuard = guards.find(g => g.includes('otherSpan,'))
		expect(zeroGuard).toBeDefined()
		expect(otherGuard).toBeDefined()
		// Separate guards, not one block covering both — each span is
		// addressed on its own, exactly as it would be outside the branch.
		expect(zeroGuard).not.toBe(otherGuard)
		expect(zeroGuard).not.toContain('otherSpan')
	})

	test('the server renders both spans in the taken branch and neither in the other', async () => {
		const { component, diagnostics } = compileRefs(
			`	const zeroSpan = first('span.zero')
	const otherSpan = first('span.other')`,
			`@if (big) {
				<>
					<span class="zero" hidden={() => host.note === 'x'}>{text}</span>
					<span class="other" hidden={() => Boolean(zeroSpan)}>+</span>
				</>
			} @else {
				<>+</>
			}`,
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		const out = path.join(ROOT, 'server/generated/tsrx', 'c-el.server.ts')
		fs.mkdirSync(path.dirname(out), { recursive: true })
		fs.writeFileSync(out, component.serverCode)
		const mod = (await import(`${out}?lt130`)) as {
			renderC: (args: Record<string, unknown>) => string
		}
		const taken = mod.renderC({ big: true, text: 'Add to Cart' })
		expect(taken).toContain('class="zero"')
		expect(taken).toContain('class="other"')
		const notTaken = mod.renderC({ big: false, text: 'Add to Cart' })
		expect(notTaken).not.toContain('class="zero"')
		expect(notTaken).not.toContain('class="other"')
		expect(notTaken).toContain('+')
	})

	test('two UNADDRESSED constructed elements in one branch stay rejected', () => {
		const { diagnostics } = compileRefs(
			'',
			`@if (big) {
				<>
					<span class="zero" hidden={() => host.note === 'x'}>{text}</span>
					<span class="other" hidden={() => host.note === 'y'}>+</span>
				</>
			} @else {
				<>+</>
			}`,
		)
		// The one-root limit is about the SYNTHESIZED branch-root selector,
		// which addresses a single root per branch. Nothing about LT-130
		// weakens it for elements the author did not address.
		expect(
			diagnostics.some(
				d =>
					d.severity === 'error' &&
					d.message.includes('Multiple addressable elements'),
			),
		).toBe(true)
	})

	test('one addressed + one unaddressed element in a branch is fine', () => {
		const { diagnostics } = compileRefs(
			`	const otherSpan = first('span.other')`,
			`@if (big) {
				<>
					<span class="zero" hidden={() => host.note === 'x'}>{text}</span>
					<span class="other" hidden={() => Boolean(otherSpan)}>+</span>
				</>
			} @else {
				<>+</>
			}`,
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})
})
