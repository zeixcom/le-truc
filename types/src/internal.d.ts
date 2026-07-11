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
/** Get the signals map for a component, creating it if needed. */
declare const getSignals: (el: HTMLElement) => Record<string, Signal<unknown & {}>>;
export { CONTEXT_RETRY_DELAY, DEPENDENCY_TIMEOUT, getSignals };
