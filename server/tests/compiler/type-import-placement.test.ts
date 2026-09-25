/**
 * An `import type` is placed in every generated module whose carried
 * declarations name it (LT-106). context-media's `ContextMediaProps` names
 * the value types it imports from `media-contexts.ts`. Only type
 * declarations used them, so placement found no use: LTC014 fired and both
 * generated modules referenced types they never imported.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'

const compile = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set())

const source = (imports: string) => `${imports}

export type CProps = {
	readonly mode: Mode
}

declare global {
	interface HTMLElementTagNameMap {
		'c-el': HTMLElement & CProps
	}
}

export function C({ tone }: { tone?: Tone })
@{
	expose({})
	<>
		<c-el data-tone={tone ?? ''}>ok</c-el>
		<style>c-el { display: block }</style>
	</>
}`

describe('type-only imports named by carried declarations', () => {
	test('no LTC014, and both modules import the type', () => {
		const { component, diagnostics } = compile(
			source("import type { Mode, Tone } from './modes'"),
		)
		expect(diagnostics.filter(d => d.code === 'LTC014')).toEqual([])
		// The specifier is rewritten relative to the generated module.
		const typeImport = /import type \{ Mode, Tone \} from ["'][./]*modes["']/
		expect(component?.clientCode).toMatch(typeImport)
		expect(component?.serverCode).toMatch(typeImport)
	})

	test('a type named nowhere still warns', () => {
		const { diagnostics } = compile(
			source(
				"import type { Mode, Tone } from './modes'\nimport type { Unused } from './unused'",
			),
		)
		expect(diagnostics.filter(d => d.code === 'LTC014')).toHaveLength(1)
	})
})
