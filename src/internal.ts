import { isFunction, type Signal } from '@zeix/cause-effect'
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
	descriptorHelpers.set(descriptor, helper)
	activeCollector.push(descriptor)
}

/**
 * Which helper created each effect descriptor, for diagnostics only.
 *
 * Activation is contained per descriptor (ADR 0028 sub-design 3), so a
 * failure report has to say *which* effect failed. Descriptors are anonymous
 * thunks, and a hand-authored one never passes through `pushDescriptor()` at
 * all — hence a lookup rather than a property on the function, which would
 * mean mutating a consumer's own function object.
 */
const descriptorHelpers = new WeakMap<EffectDescriptor, string>()

/**
 * Describes an effect descriptor for a diagnostic message.
 *
 * @since 3.0.0
 * @param descriptor - Descriptor to describe
 * @returns e.g. `"watch()"`, or a generic label for a hand-authored descriptor
 */
const describeDescriptor = (descriptor: EffectDescriptor): string => {
	const helper = descriptorHelpers.get(descriptor)
	return helper ? `${helper}()` : 'A hand-authored effect descriptor'
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

/**
 * Checks whether an `ElementInternals` object is usable by the form machinery.
 *
 * `attachInternals()` throwing is already handled, but a *partial*
 * implementation is worse than none: it succeeds and hands back an object
 * whose `validity`/`validationMessage` are `undefined`, which then blows up
 * in `createCell()` far from the cause (LT-150). Validate the surface the
 * form extensions actually rely on, once, at acquisition.
 *
 * Only meaningful for a form-associated component: on any other element the
 * form-related members of `ElementInternals` throw `NotSupportedError` by
 * spec, so reading them as a health check would condemn every non-form
 * component to the degradation path.
 *
 * @param internals - Return value of `attachInternals()`
 * @param formAssociated - Whether the component is form-associated
 * @returns True if the surface the component needs is present and callable
 */
const isUsableInternals = /*#__PURE__*/ (
	internals: ElementInternals | null | undefined,
	formAssociated: boolean,
): internals is ElementInternals => {
	if (internals == null) return false
	if (!formAssociated) return true
	try {
		return (
			internals.validity != null &&
			internals.validationMessage != null &&
			isFunction(internals.setFormValue) &&
			isFunction(internals.setValidity)
		)
	} catch {
		return false
	}
}

export {
	CONTEXT_RETRY_DELAY,
	DEPENDENCY_TIMEOUT,
	describeDescriptor,
	getSignals,
	installActiveCollector,
	internalsHosts,
	internalsMap,
	isUsableInternals,
	pushDescriptor,
	restoreActiveCollector,
	retainedInitializers,
	withCollector,
}
