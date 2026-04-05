import { type Component, defineComponent } from '../../..'

export type BasicOnProps = {
	count: number
	focused: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-on': Component<BasicOnProps>
	}
}

/**
 * Test component for the v1.1 factory `on()` helper.
 * Exercises: Element target, Memo delegation, non-bubbling event per-element fallback,
 * and handler return value → batch host update.
 */
export default defineComponent<BasicOnProps>(
	'basic-on',
	({ expose, first, all, on, run }) => {
		const btn = first('button', 'Add a <button> element.')
		const inputs = all('input')
		const output = first('#output', 'Add element with id="output".')
		const focusLog = first('#focus-log', 'Add element with id="focus-log".')

		expose({ count: 0, focused: false })

		return [
			// Element target: click handler returns { prop: value } to update host
			on(btn, 'click', () => ({ count: 1 })),

			// run to reflect count in DOM
			run('count', n => {
				output.textContent = String(n)
			}),

			// Memo target: delegation — click on any input increments count
			on(inputs, 'click', (_, el) => ({
				count: Number(el.dataset.value ?? 0),
			})),

			// Non-bubbling event (focus) with Memo target — per-element fallback
			on(inputs, 'focus', () => ({ focused: true })),

			// run to reflect focused in DOM
			run('focused', f => {
				focusLog.textContent = f ? 'focused' : 'blurred'
			}),
		]
	},
)
