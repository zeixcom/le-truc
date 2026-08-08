import { asNumber, defineComponent } from '../../..'

export type ModuleSplitviewProps = {
	/** Split ratio between 0.1 and 0.9 (e.g. 0.5 = 50/50). Read from the `split` attribute at connect time. */
	split: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-splitview': HTMLElement & ModuleSplitviewProps
	}
}

const MIN_SPLIT = 0.1
const MAX_SPLIT = 0.9
const STEP = 0.05

/**
 * A resizable split view with a draggable divider and keyboard support.
 * Use it for two-panel layouts where the user should control the split — provides
 * ARIA separator semantics and Arrow key support on the divider for accessibility.
 * Set `orientation="vertical"` for a top/bottom split.
 * @attribute {'horizontal'|'vertical'} [orientation=horizontal] - Layout direction of the split. Read once at connect time; not a reactive property.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-splitview} Interactive preview and usage examples
 **/
export default defineComponent<ModuleSplitviewProps>(
	'module-splitview',
	({ expose, first, host, on, watch }) => {
		expose({ split: asNumber(0.5) })

		const divider = first(
			'button.divider',
			'Add a button.divider resize handle.',
		)
		const isVertical = host.getAttribute('orientation') === 'vertical'
		let dragging = false

		on(divider, 'pointerdown', event => {
			dragging = true
			divider.setPointerCapture(event.pointerId)
		})
		on(divider, 'pointermove', event => {
			if (!dragging) return
			const rect = host.getBoundingClientRect()
			const ratio = isVertical
				? (event.clientY - rect.top) / rect.height
				: (event.clientX - rect.left) / rect.width
			return { split: Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, ratio)) }
		})
		on(divider, 'pointerup', () => {
			dragging = false
		})
		on(divider, 'lostpointercapture', () => {
			dragging = false
		})
		on(divider, 'keydown', event => {
			const { key } = event
			const decrement = isVertical ? key === 'ArrowUp' : key === 'ArrowLeft'
			const increment = isVertical ? key === 'ArrowDown' : key === 'ArrowRight'
			if (decrement || increment || key === 'Home' || key === 'End') {
				event.preventDefault()
			}
			if (decrement) return { split: Math.max(MIN_SPLIT, host.split - STEP) }
			if (increment) return { split: Math.min(MAX_SPLIT, host.split + STEP) }
			if (key === 'Home') return { split: MIN_SPLIT }
			if (key === 'End') return { split: MAX_SPLIT }
		})
		watch('split', split => {
			host.style.setProperty('--module-splitview-ratio', `${(split * 100).toFixed(2)}%`)
			divider.setAttribute('aria-valuenow', String(Math.round(split * 100)))
		})
	},
)
