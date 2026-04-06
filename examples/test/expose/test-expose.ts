import { defineComponent } from '../../..'

export type TestExposeProps = {
	greeting: string
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-expose': HTMLElement & TestExposeProps
	}
}

/**
 * Minimal v1.1 factory form component for Phase 1 engine tests.
 * Uses expose() only — no effects. Verifies that signals are created
 * and accessible via host properties when the return array is empty.
 */
export default defineComponent<TestExposeProps>(
	'basic-expose',
	({ expose }) => {
		expose({
			greeting: 'Hello',
			count: 0,
		})

		return []
	},
)
