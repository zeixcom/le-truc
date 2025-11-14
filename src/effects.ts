import { isFunction, type MaybeCleanup } from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import { InvalidEffectsError } from './errors'

/* === Types === */

type Effect<P extends ComponentProps, E extends Element> = (
	host: Component<P>,
	element: E,
) => MaybeCleanup

type Effects<P extends ComponentProps, E extends Element> =
	| Effect<P, E>
	| Effect<P, E>[]
	| Promise<Effect<P, E>>
	| Promise<Effect<P, E>[]>

/* === Exported Functions === */

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
const runEffects = <P extends ComponentProps, E extends Element = Component<P>>(
	effects: Effects<P, E>,
	host: Component<P>,
	target: E = host as unknown as E,
): MaybeCleanup => {
	try {
		if (effects instanceof Promise) throw effects
		if (!Array.isArray(effects)) return effects(host, target)
		const cleanups = effects
			.filter(isFunction)
			.map(effect => effect(host, target))
		return () => {
			cleanups.filter(isFunction).forEach(cleanup => cleanup())
			cleanups.length = 0
		}
	} catch (error) {
		if (error instanceof Promise) {
			error.then(() => runEffects(effects, host, target))
		} else {
			throw new InvalidEffectsError(
				host,
				error instanceof Error ? error : new Error(String(error)),
			)
		}
	}
}

export { type Effect, type Effects, runEffects }
