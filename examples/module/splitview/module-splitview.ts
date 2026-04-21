import { asNumber, defineComponent } from '../../..'

export type ModuleSplitviewProps = {
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

export default defineComponent<ModuleSplitviewProps>(
	'module-splitview',
	({ expose, first, host, on, watch }) => {
		const divider = first('button.divider', 'Add a button.divider resize handle.')
		const isVertical = host.getAttribute('orientation') === 'vertical'

		let dragging = false

		expose({ split: asNumber(0.5) })

		return [
			on(divider, 'pointerdown', event => {
				dragging = true
				;(event.target as Element).setPointerCapture(event.pointerId)
			}),
			on(divider, 'pointermove', event => {
				if (!dragging) return
				const rect = host.getBoundingClientRect()
				const ratio = isVertical
					? (event.clientY - rect.top) / rect.height
					: (event.clientX - rect.left) / rect.width
				return { split: Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, ratio)) }
			}),
			on(divider, 'pointerup', () => {
				dragging = false
			}),
			on(divider, 'lostpointercapture', () => {
				dragging = false
			}),
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
			}),
			watch('split', split => {
				host.style.setProperty('--split', `${(split * 100).toFixed(2)}%`)
				divider.setAttribute('aria-valuenow', String(Math.round(split * 100)))
			}),
		]
	},
)
