import { type MaybeCleanup } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
type Effect<P extends ComponentProps, E extends Element> = (host: Component<P>, element: E) => MaybeCleanup;
type Effects<P extends ComponentProps, E extends Element> = Effect<P, E> | Effect<P, E>[] | Promise<Effect<P, E>> | Promise<Effect<P, E>[]>;
/**
 * Run one or more effect functions on a component's element
 *
 * @since 0.14.0
 * @param {Effects<P, E>} effects - Effect functions to run
 * @param {Component<P>} host - Component host element
 * @param {E} target - Target element
 * @returns {Cleanup} - Cleanup function that runs collected cleanup functions
 * @throws {InvalidEffectsError} - If the effects are invalid
 */
declare const runEffects: <P extends ComponentProps, E extends Element = Component<P>>(effects: Effects<P, E>, host: Component<P>, target?: E) => MaybeCleanup;
export { type Effect, type Effects, runEffects };
