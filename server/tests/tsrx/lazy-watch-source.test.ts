/**
 * Tests for lazy-child `watch()`-source lowering (LT-038): a lazy child
 * whose expression is neither a signal identifier nor a string prop-name
 * lowers to an arrow thunk automatically, so `watch()`'s overload
 * resolution succeeds without the author needing to hand-wrap it.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const source = `export type CProps = { value: number }

export function C({}: {})
@{
	expose({ value: asNumber() })
	<>
		<c-el>
			<p>&{String(host.value)}</p>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`

describe('lazy child with an arbitrary (non-identifier, non-prop-name) expression', () => {
	test('is auto-wrapped in an arrow thunk for the watch() thunk-source overload', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain('watch(() => String(host.value)')
	})
})

describe('lazy child already authored as an arrow thunk', () => {
	const explicit = source.replace(
		'&{String(host.value)}',
		'&{() => String(host.value)}',
	)

	test('is not double-wrapped', () => {
		const { component, diagnostics } = compileComponent(
			explicit,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain('watch(() => String(host.value)')
		expect(component?.clientCode).not.toContain(
			'watch(() => () => String(host.value)',
		)
	})
})
