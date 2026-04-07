import {
	type Cleanup,
	createEffect,
	createScope,
	isMemo,
	isRecord,
	type MaybeCleanup,
	type Memo,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import { InvalidEffectsError } from './errors'
import type { ElementFromKey, UI } from './ui'

/* === Types === */

/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `run()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup

/**
 * The return value of the v1.1 factory function.
 *
 * A flat array of effect descriptors (and optional falsy guards for conditional
 * effects). Falsy values (`false`, `undefined`) are filtered out before activation,
 * enabling the `element && run(...)` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | false | undefined>

/**
 * A single effect function bound to a host component and a target element.
 * Returned by built-in effect factories and by `updateElement`.
 * May return a cleanup function that runs when the component disconnects or
 * when the target element is removed.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 */
type Effect<P extends ComponentProps, E extends Element> = (
	host: HTMLElement & P,
	target: E,
) => MaybeCleanup

/**
 * One or more effects for a single UI element.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 */
type ElementEffects<P extends ComponentProps, E extends Element> =
	| Effect<P, E>
	| Effect<P, E>[]

/**
 * The return type of the `setup` function passed to `defineComponent`.
 * Keys correspond to keys of the UI object (queried elements and `host`);
 * values are one or more effects to run for that element.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 */
type Effects<
	P extends ComponentProps,
	U extends UI & { host: HTMLElement & P },
> = {
	[K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>>
}

/* === Exported Functions === */

/**
 * Activate effects returned by the setup function inside a reactive scope.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`.
 * @since 0.15.0
 */
const runEffects = <
	P extends ComponentProps,
	U extends UI & { host: HTMLElement & P },
>(
	ui: U,
	effects: Effects<P, U>,
): Cleanup => {
	if (!isRecord(effects)) throw new InvalidEffectsError(ui.host)

	return createScope(() => {
		for (const key of Object.keys(effects)) {
			const k = key as keyof U
			if (!effects[k]) continue

			const fns = Array.isArray(effects[k]) ? effects[k] : [effects[k]]
			if (isMemo<ElementFromKey<U, typeof k>[]>(ui[k])) {
				createEffect(() => {
					for (const target of (ui[k] as Memo<Element[]>).get())
						for (const fn of fns)
							fn(ui.host, target as ElementFromKey<U, typeof k>)
				})
			} else if (ui[k]) {
				for (const fn of fns) fn(ui.host, ui[k] as ElementFromKey<U, typeof k>)
			}
		}
	})
}

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
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult,
): EffectDescriptor
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => EffectDescriptor,
): EffectDescriptor
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult | EffectDescriptor,
): EffectDescriptor {
	return () => {
		createEffect(() => {
			for (const element of memo.get()) {
				createScope(() => {
					const result = callback(element)
					if (Array.isArray(result)) {
						for (const descriptor of result) {
							if (descriptor) descriptor()
						}
					} else if (typeof result === 'function') {
						result()
					}
				})
			}
		})
	}
}

export {
	type Effect,
	type EffectDescriptor,
	type Effects,
	type ElementEffects,
	each,
	type FactoryResult,
	runEffects,
}
