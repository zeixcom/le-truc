/**
 * The timer cancellers are client-known globals (LT-452). `JS_GLOBALS` listed
 * `setInterval`, `setTimeout` and `requestAnimationFrame` but none of their
 * cancellers, so a watch whose cleanup cancels the timer it started was
 * refused as a setup statement (LTC005) unless spelled `window.clearInterval`.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'

const cases = [
	['clearInterval', 'setInterval(tick, 10)'],
	['clearTimeout', 'setTimeout(tick, 10)'],
	['cancelAnimationFrame', 'requestAnimationFrame(tick)'],
] as const

const watchCleanup = (cancel: string, start: string) =>
	`watch('running', v => {
		if (!v) return
		const id = ${start}
		return () => ${cancel}(id)
	})`

const tsrx = (cancel: string, start: string) => `export function C({}: {})
@{
	const tick = () => {}
	expose({ running: false })
	${watchCleanup(cancel, start)}
		<c-el>
			<p>ok</p>
			<style>:host {
	  display: block;
	}</style>
		</c-el>
}`

const tsx = (cancel: string, start: string) => `export function C({}: {}) {
	const tick = () => {}
	expose({ running: false })
	${watchCleanup(cancel, start)}
	return (
		<c-el>
			<p>ok</p>
			<style></style>
		</c-el>
	)
}`

describe('timer cancellers in a watch cleanup compile (LT-452)', () => {
	for (const [cancel, start] of cases) {
		test(`${cancel} on .tsrx`, () => {
			const { component, diagnostics } = compileComponent(
				tsrx(cancel, start),
				'c.tsrx',
				new Set(),
			)
			expect(diagnostics).toEqual([])
			expect(component?.clientCode).toContain(`${cancel}(id)`)
			expect(component?.serverCode).not.toContain(cancel)
		})

		test(`${cancel} on .tsx`, () => {
			const { component, diagnostics } = compileComponentTsx(
				tsx(cancel, start),
				'c.tsx',
				new Set(),
			)
			expect(diagnostics).toEqual([])
			expect(component?.clientCode).toContain(`${cancel}(id)`)
			expect(component?.serverCode).not.toContain(cancel)
		})
	}
})
