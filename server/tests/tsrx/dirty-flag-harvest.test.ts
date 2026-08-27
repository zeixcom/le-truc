/**
 * Direct test for the CHECKLIST §6 hydration BUG fix: `value`/`checked`/
 * `selected` are dirty-flag attributes — between server render and client
 * upgrade, the user can type, or the browser can refill via session
 * restore/autofill/bfcache, so the live IDL property may already diverge
 * from the content attribute the server rendered. A signal harvested from
 * one of these must read the LIVE PROPERTY, not `getAttribute`, or it
 * silently discards whatever the user already typed in that window.
 *
 * Pinned directly rather than only through goldens: no example in the
 * corpus currently harvests a dirty-flag attribute via this path, so a
 * regression here would be invisible in `client.golden.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const harvestFrom = (attr: string, signalInit = "createCell('')"): string => {
	const { component, diagnostics } = compileComponent(
		`export function C({}: {})
	@{
		const ${attr === 'checked' ? 'checked' : 'value'} = ${signalInit}
		expose({ ${attr === 'checked' ? 'checked' : 'value'}: ${attr === 'checked' ? 'checked' : 'value'}.get })
		<>
			<c-el>
				<input ${attr}={() => ${attr === 'checked' ? 'checked' : 'value'}.get()} />
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`,
		'c.tsrx',
		new Set(),
	)
	expect(diagnostics).toEqual([])
	if (!component) throw new Error('expected component to compile')
	return component.clientCode
}

describe('dirty-flag attribute harvest reads the live property (CHECKLIST §6)', () => {
	test('value harvests from the live IDL property, not getAttribute', () => {
		const code = harvestFrom('value')
		expect(code).toContain('createCell(asString()(String(input.value)))')
		expect(code).not.toContain("getAttribute('value')")
	})

	test('checked harvests from the live IDL property, not getAttribute', () => {
		const code = harvestFrom('checked', 'createCell(false)')
		expect(code).toContain('input.checked')
		expect(code).not.toContain("getAttribute('checked')")
	})

	test('an ordinary (non-dirty-flag) attribute still harvests via getAttribute — the content attribute IS the source of truth there', () => {
		const { component, diagnostics } = compileComponent(
			`export function C({}: {})
	@{
		const title = createCell('')
		expose({ title: title.get })
		<>
			<c-el>
				<input title={() => title.get()} />
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain("getAttribute('title')")
		expect(component?.clientCode).not.toContain('input.title')
	})
})
