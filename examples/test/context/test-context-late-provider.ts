import { type Context, defineComponent } from '../../../index'
import { TEST_COUNT_CONTEXT } from './test-context'

/* === Late provider === */

export type TestContextLateProviderProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'test-context-late-provider': HTMLElement & TestContextLateProviderProps
	}
}

/**
 * Test provider whose `customElements.define()` is deliberately deferred via
 * `setTimeout`, simulating a provider that upgrades *after* the consumer
 * already dispatched its context request. Exercises the `requestContext`
 * retry/recovery path: the consumer should first show the fallback, then
 * switch to the provider's value once the late provider upgrades — with no
 * user interaction.
 *
 * `defineComponent` registers the custom element as a side effect of the call,
 * so wrapping the call in `setTimeout` defers the registration: the element is
 * in the DOM but `:not(:defined)` at the consumer's first connect.
 */
setTimeout(() => {
	defineComponent<TestContextLateProviderProps>(
		'test-context-late-provider',
		({ expose, provideContexts }) => {
		expose({ count: 42 })
		provideContexts(['count'])
	})
}, 50)

export { type Context, TEST_COUNT_CONTEXT }
