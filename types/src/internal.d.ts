import type { Signal } from '@zeix/cause-effect';
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
 * Module-internal map from form-associated component instances to the retained
 * `value` initializer (for managed `formResetCallback`). The initializer is the
 * original value passed to `expose({ value: ... })`: a `Parser` is re-run
 * against the current `value` attribute; a static value is restored directly.
 * Enables native `defaultValue`-style reset semantics generically, because prop
 * parsers already encode attribute → value.
 */
declare const initialValueInitializers: WeakMap<HTMLElement, unknown>;
/** Get the signals map for a component, creating it if needed. */
declare const getSignals: (el: HTMLElement) => Record<string, Signal<unknown & {}>>;
export { CONTEXT_RETRY_DELAY, DEPENDENCY_TIMEOUT, getSignals, initialValueInitializers, internalsMap, };
