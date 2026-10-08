/**
 * The compiler's knowledge of composed children as stylesheet warnings
 * (ADR 0033 s5, LT-502): LTC087 at a downward leak into a composed child's
 * own markup, LTC088 at a top-level rule the component's tag does not
 * contain. Both are tier 2 Contained warnings: the CSS ships as authored.
 */
import { describe, expect, test } from 'bun:test'
import type { CompileDiagnostic } from '../../compiler/diagnostics'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { RegistryEntry } from '../../compiler/registry'

/* === Fixtures === */

const CHILD = `import { css } from '@zeix/le-truc-compiler/macros'

export function ChildEl({ children = '' }: { children?: string }) {
	return (
		<child-el class="card">
			<span class="label">{'Inner'}</span>
			<div class="body">{children}</div>
			<style>{css\`@scope {
	:where(:scope) {
		display: block;
	}
}\`}</style>
		</child-el>
	)
}
`

const WRAP = `import { css } from '@zeix/le-truc-compiler/macros'
import { ChildEl } from '../child/child-el.tsx'

export function WrapEl({}: {}) {
	return (
		<wrap-el>
			<ChildEl />
			<style>{css\`@scope to (child-el > *) {
	:where(:scope) {
		display: block;
	}
}\`}</style>
		</wrap-el>
	)
}
`

/** Compile `files` in order, each against the registry of those before it. */
const compileAll = (
	files: Array<[path: string, source: string]>,
): Map<string, CompileDiagnostic[]> => {
	const registry = new Map<string, RegistryEntry>()
	const results = new Map<string, CompileDiagnostic[]>()
	for (const [path, source] of files) {
		const compile = path.endsWith('.tsx')
			? compileComponentTsx
			: compileComponent
		const { component, diagnostics } = compile(
			source,
			path,
			new Set(),
			undefined,
			registry,
		)
		if (!component)
			throw new Error(`${path} must compile: ${JSON.stringify(diagnostics)}`)
		registry.set(component.entry.source, component.entry)
		results.set(path, diagnostics)
	}
	return results
}

/** The parent's sheet-warning diagnostics, composing what `children` list. */
const parentWarnings = (
	template: string,
	sheet: string,
	{
		imports = `import { ChildEl } from '../child/child-el.tsx'`,
		extra = [] as Array<[string, string]>,
	} = {},
): CompileDiagnostic[] => {
	const parent = `import { css } from '@zeix/le-truc-compiler/macros'
${imports}

export function ParentEl({}: {}) {
	return (
		<parent-el>
			${template}
			<style>{css\`${sheet}\`}</style>
		</parent-el>
	)
}
`
	const results = compileAll([
		['examples/child/child-el.tsx', CHILD],
		...extra,
		['examples/parent/parent-el.tsx', parent],
	])
	return (results.get('examples/parent/parent-el.tsx') ?? []).filter(
		d => d.code === 'LTC087' || d.code === 'LTC088',
	)
}

const codes = (diagnostics: CompileDiagnostic[]) => diagnostics.map(d => d.code)

/* === LTC087: downward leak === */

describe('LTC087 — a scoped rule reaching into a composed child (ADR 0033 s5)', () => {
	test("a rule on the child's internal class leaks, and the message names rule, child and fix", () => {
		const warnings = parentWarnings(
			'<ChildEl />',
			'@scope {\n\t.label {\n\t\tcolor: red;\n\t}\n}',
		)
		expect(codes(warnings)).toEqual(['LTC087'])
		const [leak] = warnings
		expect(leak?.severity).toBe('warning')
		expect(leak?.message).toContain('`.label`')
		expect(leak?.message).toContain('<child-el>')
		expect(leak?.message).toContain('`@scope to (child-el > *) { … }`')
	})

	test('a type selector the child renders leaks too', () => {
		expect(
			codes(
				parentWarnings(
					'<ChildEl />',
					'@scope {\n\tspan {\n\t\tcolor: red;\n\t}\n}',
				),
			),
		).toEqual(['LTC087'])
	})

	test('no leak when an authored limit excludes the child', () => {
		for (const limit of ['child-el > *', 'child-el', '.card', '.card > *'])
			expect(
				parentWarnings(
					'<ChildEl />',
					`@scope to (${limit}) {\n\t.label {\n\t\tcolor: red;\n\t}\n}`,
				),
			).toEqual([])
	})

	test("a limit on an inner element of the child excludes that element's own matches", () => {
		expect(
			parentWarnings(
				'<ChildEl />',
				'@scope to (.label) {\n\tspan {\n\t\tcolor: red;\n\t}\n}',
			),
		).toEqual([])
	})

	test('no leak into content the component passes as children (ADR 0048 s5)', () => {
		expect(
			parentWarnings(
				'<ChildEl><em class="mine">{\'Mine\'}</em></ChildEl>',
				'@scope {\n\t.mine {\n\t\tcolor: blue;\n\t}\n\tem {\n\t\tfont-style: normal;\n\t}\n}',
			),
		).toEqual([])
	})

	test('a rule the child cannot render, or the child host itself, does not leak', () => {
		expect(
			parentWarnings(
				'<ChildEl />',
				'@scope {\n\t:where(:scope) {\n\t\tdisplay: block;\n\t}\n\tchild-el {\n\t\tmargin: 0;\n\t}\n\t.absent {\n\t\tcolor: red;\n\t}\n\tp {\n\t\tcolor: red;\n\t}\n}',
			),
		).toEqual([])
	})

	test('a child-combinator chain from the scope root stays above the child', () => {
		expect(
			parentWarnings(
				'<ChildEl />',
				'@scope {\n\t> span {\n\t\tcolor: red;\n\t}\n\t:where(:scope) > div > span {\n\t\tcolor: red;\n\t}\n}',
			),
		).toEqual([])
		// …unless the chain passes through the child's host.
		expect(
			codes(
				parentWarnings(
					'<ChildEl />',
					'@scope {\n\t> child-el > span {\n\t\tcolor: red;\n\t}\n}',
				),
			),
		).toEqual(['LTC087'])
	})

	test("a grandchild's markup leaks through the child, and the fix names the direct child", () => {
		const warnings = parentWarnings(
			'<WrapEl />',
			'@scope {\n\t.label {\n\t\tcolor: red;\n\t}\n}',
			{
				imports: `import { WrapEl } from '../wrap/wrap-el.tsx'`,
				extra: [['examples/wrap/wrap-el.tsx', WRAP]],
			},
		)
		expect(codes(warnings)).toEqual(['LTC087'])
		expect(warnings[0]?.message).toContain('<wrap-el>')
		expect(warnings[0]?.message).toContain('wrap-el > *')
		// A limit at the grandchild's host stops it as well.
		expect(
			parentWarnings(
				'<WrapEl />',
				'@scope to (child-el > *) {\n\t.label {\n\t\tcolor: red;\n\t}\n}',
				{
					imports: `import { WrapEl } from '../wrap/wrap-el.tsx'`,
					extra: [['examples/wrap/wrap-el.tsx', WRAP]],
				},
			),
		).toEqual([])
	})

	test('a raw custom element has no registry shapes and never warns', () => {
		expect(
			parentWarnings(
				'<x-widget><span class="label">{\'Raw\'}</span></x-widget>',
				'@scope {\n\t.label {\n\t\tcolor: red;\n\t}\n}',
				{ imports: '' },
			),
		).toEqual([])
	})

	test('the .tsrx surface warns alike', () => {
		const parent = `import { ChildEl } from '../child/child-el.tsx'

export function ParentEl({}: {})
	@{
		<parent-el>
			<ChildEl />
			<style>@scope {
	.label {
		color: red;
	}
}</style>
		</parent-el>
	}`
		const results = compileAll([
			['examples/child/child-el.tsx', CHILD],
			['examples/parent/parent-el.tsrx', parent],
		])
		expect(
			codes(
				(results.get('examples/parent/parent-el.tsrx') ?? []).filter(
					d => d.code === 'LTC087',
				),
			),
		).toEqual(['LTC087'])
	})
})

/* === LTC088: unscoped rule === */

describe('LTC088 — a top-level rule the tag does not contain (ADR 0033 s5)', () => {
	test('an unscoped `.x` warns; `parent-el .x` does not', () => {
		const warnings = parentWarnings(
			'<p class="x">{\'X\'}</p>',
			'.x {\n\tcolor: red;\n}\nparent-el .x {\n\tcolor: blue;\n}\n@scope {\n\t:where(:scope) {\n\t\tdisplay: block;\n\t}\n}',
			{ imports: '' },
		)
		expect(codes(warnings)).toEqual(['LTC088'])
		expect(warnings[0]?.severity).toBe('warning')
		expect(warnings[0]?.message).toContain('`.x`')
		expect(warnings[0]?.message).toContain('`parent-el .x`')
	})

	test('a rule in a top-level conditional group warns; @keyframes, @font-face and @property do not', () => {
		const warnings = parentWarnings(
			"<p>{'X'}</p>",
			"@media (width > 1px) {\n\t.x {\n\t\tcolor: red;\n\t}\n}\n@keyframes spin {\n\tfrom {\n\t\topacity: 0;\n\t}\n}\n@font-face {\n\tfont-family: x;\n\tsrc: url(x.woff2);\n}\n@property --x {\n\tsyntax: '*';\n\tinherits: false;\n}",
			{ imports: '' },
		)
		expect(codes(warnings)).toEqual(['LTC088'])
	})
})
