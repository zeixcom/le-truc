import type { Signal } from '@zeix/cause-effect'
import { NoActiveCollectorError } from './errors'
import type { EffectDescriptor } from './types'

/* === Constants === */

/**
 * How long (ms) to wait for child custom elements to be defined before
 * activating effects anyway (progressive enhancement). See `resolveDependencies`
 * in `src/helpers/dom.ts`.
 */
const DEPENDENCY_TIMEOUT = 200

/**
 * How long (ms) to wait before the final `context-request` re-dispatch.
 *
 * **Invariant: must strictly exceed {@link DEPENDENCY_TIMEOUT}**, enforced by
 * deriving it from that constant. The retry fires *after* the
 * dependency-resolution window closes, so a provider whose own
 * `provideContexts` listener activated late (it waited on
 * `customElements.whenDefined()` for a slow child) still catches the retry.
 * If this dropped below `DEPENDENCY_TIMEOUT`, late providers would be missed
 * and consumers would permanently lock in their fallback (see ADR-0015).
 * The 10 ms margin covers event-loop scheduling jitter between the dependency
 * timeout firing and the provider's listener activating.
 */
const CONTEXT_RETRY_DELAY = DEPENDENCY_TIMEOUT + 10

/* === Internal Shared State === */

/** Module-internal map from component instances to their signal records. */
const componentSignals = new WeakMap<
	HTMLElement,
	Record<string, Signal<unknown & {}>>
>()

/**
 * Module-internal map from component instances to their `ElementInternals`
 * (or `null` if `attachInternals()` failed). Stored here rather than as a
 * private class field so the prototype-installed host-contract getters (added
 * conditionally for form-associated components) can access it — private fields
 * are only reachable inside the class body.
 */
const internalsMap = new WeakMap<HTMLElement, ElementInternals | null>()

/**
 * Module-internal map from form-associated component instances to the retained
 * `value` initializer (for managed `formResetCallback`). The initializer is the
 * original value passed to `expose({ value: ... })`: a `Parser` is re-run
 * against the current `value` attribute; a static value is restored directly.
 * Enables native `defaultValue`-style reset semantics generically, because prop
 * parsers already encode attribute → value.
 */
const initialValueInitializers = new WeakMap<
	HTMLElement,
	unknown // Parser | MaybeSignal, captured verbatim from expose({ value })
>()

/** Get the signals map for a component, creating it if needed. */
const getSignals = (el: HTMLElement): Record<string, Signal<unknown & {}>> => {
	let signals = componentSignals.get(el)
	if (!signals) {
		signals = {}
		componentSignals.set(el, signals)
	}
	return signals
}

/* === Ambient Effect Descriptor Collector (ADR 0018) === */

/**
 * The currently active effect-descriptor collector, if any.
 *
 * A single mutable slot rather than an explicit array-based stack — nesting is
 * provided by the JS call stack itself, exactly like cause-effect's own
 * `activeOwner`: each `withCollector()` call saves the previous value, installs
 * its own, and restores the previous value in a `finally` block when its
 * (synchronous) callback returns or throws.
 */
let activeCollector: EffectDescriptor[] | undefined

/**
 * Run `fn` with `collector` as the active effect-descriptor collector, restoring
 * the previously active collector (if any) afterward — even if `fn` throws.
 *
 * Used both for a component instance's top-level factory execution and for
 * `each()`'s per-element `mount` callback, which nests a fresh local collector
 * inside whatever collector is already active. Nesting is unbounded: an `each()`
 * callback that itself calls `each()` (e.g. a grid of rows containing columns)
 * establishes another nested collector the same way.
 *
 * @since 2.3
 * @param {EffectDescriptor[]} collector - The collector to activate for the duration of `fn`
 * @param {() => T} fn - Synchronous callback to run with `collector` active
 * @returns {T} The return value of `fn`
 */
const withCollector = <T>(collector: EffectDescriptor[], fn: () => T): T => {
	const previous = activeCollector
	activeCollector = collector
	try {
		return fn()
	} finally {
		activeCollector = previous
	}
}

/**
 * Push an effect descriptor into the currently active collector.
 *
 * Throws `NoActiveCollectorError` if no collector is active — i.e. the helper
 * was not called synchronously during factory setup or an `each()` callback
 * (for example: after an `await`, inside a detached `setTimeout`, or from an
 * event handler defined during setup).
 *
 * @since 2.3
 * @param {HTMLElement | undefined} host - The component host, used for the error message if no collector is active. `each()` has no bound host, so it passes `undefined`.
 * @param {string} helper - Name of the calling helper (`'watch'`, `'on'`, `'pass'`, `'each'`, `'provideContexts'`), used for the error message
 * @param {EffectDescriptor} descriptor - The effect descriptor to collect
 */
const pushDescriptor = (
	host: HTMLElement | undefined,
	helper: string,
	descriptor: EffectDescriptor,
): void => {
	if (!activeCollector) throw new NoActiveCollectorError(host, helper)
	activeCollector.push(descriptor)
}

/**
 * Escape hatch for tests that call collector-consuming helpers (`watch()`,
 * `on()`, `pass()`, `provideContexts()`) directly, outside `defineComponent`'s
 * factory execution or an `each()` callback — where there's no single
 * synchronous callback to wrap with `withCollector()`. Pair with
 * `restoreActiveCollector()`, typically in `beforeEach`/`afterEach`. Prefer
 * `withCollector()` wherever a callback boundary is available.
 *
 * @since 2.3
 * @param {EffectDescriptor[]} collector - The collector to install as active
 * @returns {EffectDescriptor[] | undefined} The previously active collector, to pass to `restoreActiveCollector()`
 */
const installActiveCollector = (
	collector: EffectDescriptor[],
): EffectDescriptor[] | undefined => {
	const previous = activeCollector
	activeCollector = collector
	return previous
}

/**
 * Restore whatever collector was active before `installActiveCollector()`.
 *
 * @since 2.3
 * @param {EffectDescriptor[] | undefined} previous - The value returned by the matching `installActiveCollector()` call
 */
const restoreActiveCollector = (
	previous: EffectDescriptor[] | undefined,
): void => {
	activeCollector = previous
}

export {
	CONTEXT_RETRY_DELAY,
	DEPENDENCY_TIMEOUT,
	getSignals,
	initialValueInitializers,
	installActiveCollector,
	internalsMap,
	pushDescriptor,
	restoreActiveCollector,
	withCollector,
}
