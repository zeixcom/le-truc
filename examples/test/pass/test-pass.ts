import { defineComponent } from '../../..'

export type TestPassProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'test-pass': HTMLElement & TestPassProps
	}
}

/**
 * Test component for the v1.1 factory `pass()` helper.
 * Exercises: single-element pass, Memo pass, per-element lifecycle.
 *
 * The parent's `count` prop is passed to child `basic-number` elements'
 * `value` prop. The `#output` span reflects the parent's count directly
 * for test assertions independent of child rendering.
 */
export default defineComponent<TestPassProps>(
	'test-pass',
	({ expose, first, all, watch, pass }) => {
		const single = first(
			'basic-number#single',
			'Add basic-number with id="single".',
		)
		const group = all('basic-number.group')
		const output = first('#output', 'Add element with id="output".')

		expose({ count: 0 })

		return [
			watch('count', n => {
				output.textContent = String(n)
			}),
			pass(single, { value: 'count' }),
			pass(group, { value: 'count' }),
		]
	},
)
