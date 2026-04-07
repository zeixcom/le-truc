import { type Cleanup, type MaybeCleanup, type Memo } from '@zeix/cause-effect';
import type { ComponentProps } from './component';
import type { ElementFromKey, UI } from './ui';
/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `run()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup;
/**
 * The return value of the v1.1 factory function.
 *
 * A flat array of effect descriptors (and optional falsy guards for conditional
 * effects). Falsy values (`false`, `undefined`) are filtered out before activation,
 * enabling the `element && run(...)` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | false | undefined>;
/**
 * A single effect function bound to a host component and a target element.
 * Returned by built-in effect factories and by `updateElement`.
 * May return a cleanup function that runs when the component disconnects or
 * when the target element is removed.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 */
type Effect<P extends ComponentProps, E extends Element> = (host: HTMLElement & P, target: E) => MaybeCleanup;
/**
 * One or more effects for a single UI element.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 */
type ElementEffects<P extends ComponentProps, E extends Element> = Effect<P, E> | Effect<P, E>[];
/**
 * The return type of the `setup` function passed to `defineComponent`.
 * Keys correspond to keys of the UI object (queried elements and `host`);
 * values are one or more effects to run for that element.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 */
type Effects<P extends ComponentProps, U extends UI & {
    host: HTMLElement & P;
}> = {
    [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>>;
};
/**
 * Activate effects returned by the setup function inside a reactive scope.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 * @since 0.15.0
 */
declare const runEffects: <P extends ComponentProps, U extends UI & {
    host: HTMLElement & P;
}>(ui: U, effects: Effects<P, U>) => Cleanup;
/**
 * Create per-element reactive effects from a `Memo<Element[]>`.
 *
 * When elements enter the collection, their effects are created in a per-element
 * scope; when they leave, their effects are disposed with that scope.
 *
 * The callback receives a single element and returns a `FactoryResult` (array of
 * `EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
 *
 * @since 1.1
 */
declare function each<E extends Element>(memo: Memo<E[]>, callback: (element: E) => FactoryResult): EffectDescriptor;
declare function each<E extends Element>(memo: Memo<E[]>, callback: (element: E) => EffectDescriptor): EffectDescriptor;
export { type Effect, type EffectDescriptor, type Effects, type ElementEffects, each, type FactoryResult, runEffects, };
