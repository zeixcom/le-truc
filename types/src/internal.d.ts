import type { Signal } from '@zeix/cause-effect';
import type { EffectDescriptor } from './types';
/**
 * How long (ms) to wait for child custom elements to be defined before
 * activating effects anyway (progressive enhancement). See `resolveDependencies`
 * in `src/helpers/dom.ts`.
 */
declare const DEPENDENCY_TIMEOUT = 200;
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
declare const CONTEXT_RETRY_DELAY: number;
/**
 * Module-internal map from component instances to their `ElementInternals`
 * (or `null` if `attachInternals()` failed). Stored here rather than as a
 * private class field so the prototype-installed host-contract getters (added
 * conditionally for form-associated components) can access it — private fields
 * are only reachable inside the class body.
 */
declare const internalsMap: WeakMap<HTMLElement, ElementInternals | null>;
/**
 * Module-internal map from component instances to their retained property
 * initializers, keyed by prop name — the original value passed to
 * `expose({ [prop]: ... })`, captured verbatim before `#initSignals` consumes
 * it. Populated for every prop (not just extension-reserved ones); cheap
 * (a plain object assignment already inside the per-prop loop) and keeps
 * `component.ts` generic — which props are actually read back out of this map
 * is entirely up to whichever extension wants them, not something core needs
 * to know about.
 *
 * Consumers: `formAssociated()`'s managed `formResetCallback` re-runs the
 * retained `value` initializer (a `Parser` is re-parsed against the current
 * `value` attribute; a static value is restored directly) for native
 * `defaultValue`-style reset semantics. `observedAttributes()` re-runs a
 * retained `Parser` for an observed prop when its attribute mutates
 * post-connect.
 */
declare const retainedInitializers: WeakMap<HTMLElement, Record<string, unknown>>;
/** Get the signals map for a component, creating it if needed. */
declare const getSignals: (el: HTMLElement) => Record<string, Signal<unknown & {}>>;
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
declare const withCollector: <T>(collector: EffectDescriptor[], fn: () => T) => T;
/**
 * Push an effect descriptor into the currently active collector.
 *
 * @since 2.3
 * @param {HTMLElement | undefined} host - The component host, used for the error message if no collector is active. `each()` and `reconcile()` have no bound host, so they pass `undefined`.
 * @param {string} helper - Name of the calling helper (`'watch'`, `'on'`, `'pass'`, `'each'`, `'provideContexts'`), used for the error message
 * @param {EffectDescriptor} descriptor - The effect descriptor to collect
 * @throws {NoActiveCollectorError} If no collector is active - i.e. the helper was not called synchronously during factory setup, an `each()` callback, or a `reconcile()` bindItem
 */
declare const pushDescriptor: (host: HTMLElement | undefined, helper: string, descriptor: EffectDescriptor) => void;
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
declare const installActiveCollector: (collector: EffectDescriptor[]) => EffectDescriptor[] | undefined;
/**
 * Restore whatever collector was active before `installActiveCollector()`.
 *
 * @since 2.3
 * @param {EffectDescriptor[] | undefined} previous - The value returned by the matching `installActiveCollector()` call
 */
declare const restoreActiveCollector: (previous: EffectDescriptor[] | undefined) => void;
export { CONTEXT_RETRY_DELAY, DEPENDENCY_TIMEOUT, getSignals, installActiveCollector, internalsMap, pushDescriptor, restoreActiveCollector, retainedInitializers, withCollector, };
