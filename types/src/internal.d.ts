import { type Signal } from '@zeix/cause-effect';
import type { EffectDescriptor } from './types';
/**
 * Milliseconds to wait for child custom elements to be defined before activating effects anyway.
 *
 * See `resolveDependencies` in `src/helpers/dom.ts`.
 */
declare const DEPENDENCY_TIMEOUT = 200;
/**
 * Milliseconds to wait before the final `context-request` re-dispatch.
 *
 * Must exceed {@link DEPENDENCY_TIMEOUT}; see ADR-0015.
 */
declare const CONTEXT_RETRY_DELAY: number;
/**
 * Map from component instances to their `ElementInternals`, or `null` if `attachInternals()` failed.
 *
 * Stored here, not as a private class field, so prototype-installed
 * host-contract getters can access it too.
 */
declare const internalsMap: WeakMap<HTMLElement, ElementInternals | null>;
/**
 * Map from `ElementInternals` to their host element — the reverse of {@link internalsMap}.
 *
 * `bindAria()` uses this to find the element whose shadowing attribute it
 * must remove (ADR 0026). Library-private; not exposed.
 */
declare const internalsHosts: WeakMap<ElementInternals, HTMLElement>;
/**
 * Map from component instances to their retained property initializers, keyed by prop name.
 *
 * Extensions read these back: `formAssociated()` re-runs the retained
 * `value` initializer on form reset; `observedAttributes()` re-runs a
 * retained `Parser` when its attribute mutates post-connect.
 */
declare const retainedInitializers: WeakMap<HTMLElement, Record<string, unknown>>;
/** Gets the signals map for a component, creating it if needed. */
declare const getSignals: (el: HTMLElement) => Record<string, Signal<unknown & {}>>;
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
declare const withCollector: <T>(collector: EffectDescriptor[], fn: () => T) => T;
/**
 * Pushes an effect descriptor into the currently active collector.
 *
 * @since 2.3
 * @param host - Component host, used in the error message; `each()` and `reconcile()` pass `undefined`.
 * @param helper - Name of the calling helper (`'watch'`, `'on'`, `'pass'`, `'each'`, `'provideContexts'`), used in the error message.
 * @param descriptor - Effect descriptor to collect.
 * @throws {NoActiveCollectorError} If no collector is active.
 */
declare const pushDescriptor: (host: HTMLElement | undefined, helper: string, descriptor: EffectDescriptor) => void;
/**
 * Describes an effect descriptor for a diagnostic message.
 *
 * @since 3.0.0
 * @param descriptor - Descriptor to describe
 * @returns e.g. `"watch()"`, or a generic label for a hand-authored descriptor
 */
declare const describeDescriptor: (descriptor: EffectDescriptor) => string;
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
declare const installActiveCollector: (collector: EffectDescriptor[]) => EffectDescriptor[] | undefined;
/**
 * Restores whatever collector was active before `installActiveCollector()`.
 *
 * @since 2.3
 * @param previous - Value returned by the matching `installActiveCollector()` call.
 */
declare const restoreActiveCollector: (previous: EffectDescriptor[] | undefined) => void;
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
declare const isUsableInternals: (internals: ElementInternals | null | undefined, formAssociated: boolean) => internals is ElementInternals;
/**
 * Checks whether an `ElementInternals` object is a complete implementation.
 *
 * Every engine that ships `ElementInternals` at all ships it with the
 * form-association members, because form association is the feature it was
 * introduced for — so their presence is a reliable proxy for "this object's
 * ARIA reflection reaches the platform". An implementation missing them is
 * skeletal: jsdom's `attachInternals()` hands back an object whose `aria*`
 * properties store a value and read it back while reaching nothing at all,
 * and no serialized markup follows from writing to it. `bindAria()` uses
 * this to pick its channel (ADR 0026 §2, *Capability fallback*).
 *
 * Presence only — the members are never called. On a non-form-associated
 * element they exist but throw `NotSupportedError` by spec, which is why
 * {@link isUsableInternals} reads the *values* of the form members only when
 * the component is form-associated, while this reads nothing.
 *
 * @param internals - An `ElementInternals` (or anything claiming to be one)
 * @returns True if the object is a complete `ElementInternals` implementation
 */
declare const isCompleteInternals: (internals: ElementInternals) => boolean;
export { CONTEXT_RETRY_DELAY, DEPENDENCY_TIMEOUT, describeDescriptor, getSignals, installActiveCollector, internalsHosts, internalsMap, isCompleteInternals, isUsableInternals, pushDescriptor, restoreActiveCollector, retainedInitializers, withCollector, };
