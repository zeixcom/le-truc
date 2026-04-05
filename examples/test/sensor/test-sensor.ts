import { type Component, createEventsSensor, defineComponent } from '../../..'

export type TestSensorProps = {
	length: number
	value: string
}

declare global {
	interface HTMLElementTagNameMap {
		'test-sensor': Component<TestSensorProps>
	}
}

/**
 * Test component for the v1.1 `createEventsSensor(target, init, events)` form.
 *
 * Uses a direct element reference instead of a UI key string. The sensor
 * attaches its listener to the input element and returns a Sensor<T> directly
 * (no Reader wrapper needed). The handler receives `{ event, target, prev }`.
 */
export default defineComponent<TestSensorProps>(
	'test-sensor',
	({ expose, first, run }) => {
		const input = first('input', 'Add an <input> element.')
		const output = first('#output', 'Add element with id="output".')

		expose({
			// v1.1 form: element target, plain init value, no `read()` wrapper
			length: createEventsSensor(input, input.value.length, {
				input: ({ target }) => target.value.length,
			}),
			value: input.value,
		})

		return [
			run('length', n => {
				output.textContent = String(n)
			}),
		]
	},
)
