import type { Signal } from '@zeix/cause-effect'
import { NoActiveCollectorError } from './errors'
import type { EffectDescriptor } from './types'

/* === Constants === */

/**
 * Milliseconds to wait for child custom elements to be defined before activating effects anyway.
 *
 * See `resolveDependencies` in `src/helpers/dom.ts`.
 */
const DEPENDENCY_TIMEOUT = 200

/**
 * Milliseconds to wait before the final `context-request` re-dispatch.
 *
 * Must exceed {@link DEPENDENCY_TIMEOUT}; see ADR-0015.
 */
const CONTEXT_RETRY_DELAY = DEPENDENCY_TIMEOUT + 10

/* === Internal Shared State === */

/** Map from component instances to their signal records. */
const componentSignals = new WeakMap<
	HTMLElement,
	Record<string, Signal<unknown & {}>>
>()

/**
 * Map from component instances to their `ElementInternals`, or `null` if `attachInternals()` failed.
 *
 * Stored here, not as a private class field, so prototype-installed
 * host-contract getters can access it too.
 */
const internalsMap = new WeakMap<HTMLElement, ElementInternals | null>()

/**
 * Map from `ElementInternals` to their host element — the reverse of {@link internalsMap}.
 *
 * `bindAria()` uses this to find the element whose shadowing attribute it
 * must remove (ADR 0026). Library-private; not exposed.
 */
const internalsHosts = new WeakMap<ElementInternals, HTMLElement>()

/**
 * Map from component instances to their retained property initializers, keyed by prop name.
 *
 * Extensions read these back: `formAssociated()` re-runs the retained
 * `value` initializer on form reset; `observedAttributes()` re-runs a
 * retained `Parser` when its attribute mutates post-connect.
 */
const retainedInitializers = new WeakMap<HTMLElement, Record<string, unknown>>()

/** Gets the signals map for a component, creating it if needed. */
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
 * Nesting comes from the JS call stack: each `withCollector()` call saves
 * the previous value and restores it when its callback returns or throws.
 */
let activeCollector: EffectDescriptor[] | undefined

/**
 * Runs `fn` with `collector` as the active effect-descriptor collector, restoring the previous collector afterward.
 *
 * Used for a component's top-level factory execution and for `each()`'s
 * per-element `mount` callback, which nests inside the outer collector.
 *
 * @since 2.3
 * @param collector - Collector to activate for the duration of `fn`.
 * @param fn - Synchronous callback to run with `collector` active.
 * @returns The return value of `fn`.
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
 * Pushes an effect descriptor into the currently active collector.
 *
 * @since 2.3
 * @param host - Component host, used in the error message; `each()` and `reconcile()` pass `undefined`.
 * @param helper - Name of the calling helper (`'watch'`, `'on'`, `'pass'`, `'each'`, `'provideContexts'`), used in the error message.
 * @param descriptor - Effect descriptor to collect.
 * @throws {NoActiveCollectorError} If no collector is active.
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
 * Escape hatch for tests that call collector-consuming helpers directly, outside a `withCollector()` boundary.
 *
 * Pair with `restoreActiveCollector()`, typically in `beforeEach`/`afterEach`.
 * Prefer `withCollector()` wherever a callback boundary is available.
 *
 * @since 2.3
 * @param collector - Collector to install as active.
 * @returns The previously active collector, to pass to `restoreActiveCollector()`.
 */
const installActiveCollector = (
	collector: EffectDescriptor[],
): EffectDescriptor[] | undefined => {
	const previous = activeCollector
	activeCollector = collector
	return previous
}

/**
 * Restores whatever collector was active before `installActiveCollector()`.
 *
 * @since 2.3
 * @param previous - Value returned by the matching `installActiveCollector()` call.
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
	installActiveCollector,
	internalsHosts,
	internalsMap,
	pushDescriptor,
	restoreActiveCollector,
	retainedInitializers,
	withCollector,
}
