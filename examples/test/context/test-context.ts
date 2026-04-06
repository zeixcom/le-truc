import { type Component, type Context, defineComponent } from '../../..'

/* === Context key === */

export const TEST_COUNT_CONTEXT = 'count' as Context<'count', () => number>

/* === Provider === */

export type TestContextProviderProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'test-context-provider': Component<TestContextProviderProps>
		'test-context-consumer': Component<TestContextConsumerProps>
	}
}

/**
 * Test provider: exposes `count` as context using v1.1 `provideContexts` helper.
 */
export const TestContextProvider = defineComponent<TestContextProviderProps>(
	'test-context-provider',
	({ expose, provideContexts }) => {
		expose({ count: 0 })
		return [provideContexts(['count'])]
	},
)

/* === Consumer === */

export type TestContextConsumerProps = {
	count: number
}

/**
 * Test consumer: requests `test-count` context using v1.1 `requestContext` helper.
 * Displays the resolved value in `#output`.
 */
export const TestContextConsumer = defineComponent<TestContextConsumerProps>(
	'test-context-consumer',
	({ expose, first, run, requestContext }) => {
		const output = first('#output', 'Add element with id="output".')

		expose({
			count: requestContext(TEST_COUNT_CONTEXT, -1),
		})

		return [
			run('count', n => {
				output.textContent = String(n)
			}),
		]
	},
)
