/**
 * Dirty-flag attribute DISPATCH tests (LT-116): `value`/`checked`/`selected`
 * on native form controls must lower reactive thunks to PROPERTY writes
 * (`bindProperty`), not attribute writes — the write direction of the same
 * dirty-flag divergence `dirty-flag-harvest.test.ts` covers on the READ side
 * (CHECKLIST §6). Once the user has interacted with the control (or any JS
 * has written the property), removing/rewriting the content attribute no
 * longer clears the live IDL property, so a `bindAttribute` mirror silently
 * stops tracking — the form-radiogroup mutual-exclusion break that stopped
 * its cutover (NOTES LT-092). The twin wrote `radio.checked = isChecked` —
 * a property write — inside its `each()` callback; the compiler must match.
 *
 * Scoping (the LT-037-deferred nuance, now decided):
 * - the widening is keyed on ATTR ∈ DIRTY_FLAG_ATTRS × TAG ∈ the native
 *   form-control set, in BOTH dispatch paths (loop body and top level);
 * - the thunk's own shape is irrelevant to the hazard — a string-valued
 *   `value` thunk over an `<input>` diverges from the attribute exactly as
 *   a boolean `checked` thunk does once the control is dirty, so both
 *   dispatch as properties;
 * - a string thunk over an ordinary attribute, and a dirty-flag attr on a
 *   non-form-control element (`<meter value>`), keep the attribute dispatch
 *   unchanged — the widening is not blanket.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const compiled = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set(['c-el']))

describe('dirty-flag dispatch — loop bodies (@for → each())', () => {
	test('boolean comparison thunk over `checked` on a native input lowers to a property write', () => {
		const { component, diagnostics } =
			compiled(`import { asString } from '@zeix/le-truc'
export function C({ options }: { options: { value: string }[] })
@{
	expose({ value: asString('') })
	<>
		<c-el>
			@for (const option of options) {
				const optValue = option.value
				<label data-value={optValue}>
					<input
						type="radio"
						value={optValue}
						checked={() => host.value === optValue}
						onChange={() => ({ value: optValue })}
					/>
				</label>
			}
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		// The loop-body descendant target needs the precise element type for
		// bindProperty's keyed setter to typecheck — querySelector is emitted
		// with the tag's interface as its type argument.
		expect(code).toContain(
			"const input = option.querySelector<HTMLInputElement>('input')!",
		)
		expect(code).toContain(
			"watch(() => host.value === optValue, bindProperty(input, 'checked'))",
		)
		expect(code).not.toContain("bindAttribute(input, 'checked')")
	})

	test('string-valued thunk over an ordinary attribute keeps the attribute dispatch', () => {
		const { component, diagnostics } =
			compiled(`import { createCell } from '@zeix/le-truc'
export function C({ options }: { options: { value: string }[] })
@{
	const tip = createCell('hint')
	expose({})
	<>
		<c-el>
			@for (const option of options) {
				const optValue = option.value
				<label data-value={optValue}>
					<input type="radio" value={optValue} title={() => tip.get()} />
				</label>
			}
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(
			"watch(() => tip.get(), bindAttribute(input, 'title'))",
		)
		expect(code).not.toContain('bindProperty')
	})

	test('dirty-flag attr on the loop OUTPUT ROOT dispatches as a property too', () => {
		const { component, diagnostics } =
			compiled(`import { asString } from '@zeix/le-truc'
export function C({ options }: { options: { value: string }[] })
@{
	expose({ value: asString('') })
	<>
		<c-el>
			@for (const option of options) {
				const optValue = option.value
				<option value={optValue} selected={() => host.value === optValue}>{optValue}</option>
			}
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(
			"watch(() => host.value === optValue, bindProperty(option, 'selected'))",
		)
		expect(code).not.toContain("bindAttribute(option, 'selected')")
	})
})

describe('dirty-flag dispatch — top-level constructs', () => {
	test('boolean thunk over `checked` on a native input (not a bare host mirror) lowers to a property write', () => {
		const { component, diagnostics } =
			compiled(`import { createCell } from '@zeix/le-truc'
export function C({}: {})
@{
	const on = createCell(false)
	expose({})
	<>
		<c-el>
			<input type="checkbox" checked={() => on.get()} />
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(
			"watch(() => on.get(), bindProperty(input, 'checked'))",
		)
		expect(code).not.toContain("bindAttribute(input, 'checked')")
	})

	test('non-mirror string thunk over `value` on a native input lowers to a property write (spinbutton shape)', () => {
		const { component, diagnostics } = compiled(`export function C({}: {})
@{
	expose({})
	<>
		<c-el>
			<input type="number" value={() => String(host.value)} />
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(
			"watch(() => String(host.value), bindProperty(input, 'value'))",
		)
		expect(code).not.toContain("bindAttribute(input, 'value')")
	})

	test('dirty-flag attr on a NON-form-control element keeps the attribute dispatch', () => {
		const { component, diagnostics } = compiled(`export function C({}: {})
@{
	expose({})
	<>
		<c-el>
			<meter min="0" max="100" value={() => String(host.value)} />
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(
			"watch(() => String(host.value), bindAttribute(meter, 'value'))",
		)
		expect(code).not.toContain("bindProperty(meter, 'value')")
	})

	test('number-valued thunk over `value` on a native input still stringifies for the property setter', () => {
		// `returnsNumber`'s heuristic: number literals and conditionals over
		// them. A bare number-signal read (`count.get()`) is NOT detected —
		// a pre-existing heuristic gap shared with the attribute dispatch,
		// flagged in NOTES.md, not introduced or worsened here.
		const { component, diagnostics } = compiled(`export function C({}: {})
@{
	expose({})
	<>
		<c-el>
			<input type="number" value={() => (host.value === '' ? 1 : 2)} />
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(
			"watch(() => String((() => (host.value === '' ? 1 : 2))()), bindProperty(input, 'value'))",
		)
	})
})
