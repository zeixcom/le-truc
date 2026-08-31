import { type Context, defineComponent } from '@zeix/le-truc'

/* === Context key === */

export const TEST_COUNT_CONTEXT = 'count' as Context<'count', () => number>

/* === Provider === */

export type TestContextProviderProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'test-context-provider': HTMLElement & TestContextProviderProps
		'test-context-consumer': HTMLElement & TestContextConsumerProps
	}
}

/**
 * Test provider: exposes `count` as context using v2.x `provideContexts` helper.
 */
export const TestContextProvider = defineComponent<TestContextProviderProps>(
	'test-context-provider',
	({ expose, provideContexts }) => {
		expose({ count: 0 })
		provideContexts(['count'])
	},
)

/* === Consumer === */

export type TestContextConsumerProps = {
	count: number
}

/**
 * Test consumer: requests `test-count` context using v2.x `requestContext` helper.
 * Displays the resolved value in `#output`.
 */
export const TestContextConsumer = defineComponent<TestContextConsumerProps>(
	'test-context-consumer',
	({ expose, first, watch, requestContext }) => {
		const output = first('#output', 'Add element with id="output".')

		expose({
			count: requestContext(TEST_COUNT_CONTEXT, -1),
		})

		watch('count', n => {
			output.textContent = String(n)
		})
	},
)
