import {
	type Cleanup,
	effect,
	isFunction,
	isRecord,
	isSignal,
	isState,
	isString,
	type MaybeCleanup,
	type Signal,
	UNSET,
} from '@zeix/cause-effect'
import type { Component, ComponentProps, ComponentUI } from './component'
import { InvalidEffectsError } from './errors'
import type { UI } from './ui'
import { DEV_MODE, elementName, LOG_ERROR, log, valueString } from './util'

/* === Types === */

type Effect<P extends ComponentProps, E extends Element> = (
	host: Component<P>,
	target: E,
) => MaybeCleanup

type ElementEffects<
	P extends ComponentProps,
	U extends UI,
	K extends keyof U,
> = Awaited<
	Effect<P, K extends keyof U ? Extract<U[K], Element> : Component<P>>
>[]

type Effects<P extends ComponentProps, U extends UI> = {
	[K in keyof U]?: ElementEffects<P, U, K>
}

type Reactive<T, P extends ComponentProps, E extends Element> =
	| keyof P
	| Signal<T & {}>
	| ((target: E) => T | null | undefined)

type UpdateOperation = 'a' | 'c' | 'd' | 'h' | 'm' | 'p' | 's' | 't'

type ElementUpdater<E extends Element, T> = {
	op: UpdateOperation
	name?: string
	read: (element: E) => T | null
	update: (element: E, value: T) => void
	delete?: (element: E) => void
	resolve?: (element: E) => void
	reject?: (error: unknown) => void
}

type ElementInserter<E extends Element> = {
	position?: InsertPosition
	create: (parent: E) => Element | null
	resolve?: (parent: E) => void
	reject?: (error: unknown) => void
}

/* === Constants === */

// Special value explicitly marked as any so it can be used as signal value of any type
const RESET: any = Symbol('RESET')

/* === Internal Functions === */

const getUpdateDescription = (
	op: UpdateOperation,
	name: string = '',
): string => {
	const ops: Record<UpdateOperation, string> = {
		a: 'attribute ',
		c: 'class ',
		d: 'dataset ',
		h: 'inner HTML',
		m: 'method call ',
		p: 'property ',
		s: 'style property ',
		t: 'text content',
	}
	return ops[op] + name
}

/* === Exported Functions === */

/**
 * Run element effects
 *
 * @since 0.15.0
 * @param {U} ui - Component UI
 * @param {K} key - Key of UI elements to get targets from
 * @param {ElementEffects<P, U, E>} effects - Effect functions to run
 * @returns {MaybeCleanup} - Cleanup function that runs collected cleanup functions
 * @throws {InvalidEffectsError} - If the effects are invalid
 */
const runElementEffects = <
	P extends ComponentProps,
	U extends UI,
	K extends keyof U | 'component',
>(
	ui: ComponentUI<P, U>,
	key: K,
	effects: ElementEffects<P, U, K>,
): MaybeCleanup => {
	const element = ui[key]
	const targets = Array.isArray(element) ? element : [element]
	if (!targets.length) return

	try {
		if (effects instanceof Promise) throw effects

		const cleanups: Cleanup[] = []
		for (const fn of effects) {
			targets.forEach(target => {
				const cleanup = fn(ui.component, target)
				if (cleanup) cleanups.push(cleanup)
			})
		}
		return () => {
			cleanups.forEach(cleanup => cleanup())
			cleanups.length = 0
		}
	} catch (error) {
		if (error instanceof Promise)
			error.then(() => runElementEffects(ui, key, effects))
		else
			throw new InvalidEffectsError(
				ui.component,
				error instanceof Error ? error : new Error(String(error)),
			)
	}
}

/**
 * Run component effects
 *
 * @since 0.15.0
 * @param {ComponentUI<P, U>} ui - Component UI
 * @param {Effects<P, U>} effects - Effect functions to run
 * @returns {Cleanup} - Cleanup function that runs collected cleanup functions
 * @throws {InvalidEffectsError} - If the effects are invalid
 */
const runEffects = <P extends ComponentProps, U extends UI>(
	ui: ComponentUI<P, U>,
	effects: Effects<P, U>,
): Cleanup => {
	if (!isRecord(effects)) throw new InvalidEffectsError(ui.component)

	const cleanups: Cleanup[] = []
	const keys = Object.keys(effects)
	for (const key of keys) {
		const k = key as keyof U
		if (!effects[k]) continue
		const cleanup = runElementEffects(
			ui,
			k,
			Array.isArray(effects[k]) ? effects[k] : [effects[k]],
		)
		if (cleanup) cleanups.push(cleanup)
	}
	return () => {
		cleanups.forEach(cleanup => cleanup())
		cleanups.length = 0
	}
}

/**
 * Resolve reactive property name, reader function or signal
 *
 * @param {Reactive<T, P, E>} reactive - Reactive property name, reader function or signal
 * @param {Component<P, U>} host - Component host element
 * @param {E} target - Element to resolve reactive value for
 * @param {string} [context] - Context for error logging
 * @returns {T} - Resolved reactive value
 */
const resolveReactive = <
	T extends {},
	P extends ComponentProps,
	E extends Element,
>(
	reactive: Reactive<T, P, E>,
	host: Component<P>,
	target: E,
	context?: string,
): T => {
	try {
		return isString(reactive)
			? (host[reactive] as unknown as T)
			: isSignal(reactive)
				? reactive.get()
				: isFunction(reactive)
					? (reactive(target) as unknown as T)
					: RESET
	} catch (error) {
		if (context) {
			log(
				error,
				`Failed to resolve value of ${valueString(reactive)}${
					context ? ` for ${context}` : ''
				} in ${elementName(target)}${
					(host as unknown as E) !== target
						? ` in ${elementName(host)}`
						: ''
				}`,
				LOG_ERROR,
			)
		}
		return RESET
	}
}

/**
 * Core effect function for updating element properties based on reactive values.
 * This function handles the lifecycle of reading, updating, and deleting element properties
 * while providing proper error handling and debugging support.
 *
 * @since 0.9.0
 * @param {Reactive<T, P, E>} reactive - The reactive value that drives the element updates
 * @param {ElementUpdater<E, T>} updater - Configuration object defining how to read, update, and delete the element property
 * @returns {Effect<P, E>} Effect function that manages the element property updates
 */
const updateElement =
	<T extends {}, P extends ComponentProps, E extends Element>(
		reactive: Reactive<T, P, E>,
		updater: ElementUpdater<E, T>,
	): Effect<P, E> =>
	(host, target): Cleanup => {
		const { op, name = '', read, update } = updater
		const operationDesc = getUpdateDescription(op, name)

		const ok = (verb: string) => () => {
			if (DEV_MODE && host.debug) {
				log(
					target,
					`${verb} ${operationDesc} of ${elementName(target)} in ${elementName(host)}`,
				)
			}
			updater.resolve?.(target)
		}

		const err = (verb: string) => (error: unknown) => {
			log(
				error,
				`Failed to ${verb} ${operationDesc} of ${elementName(target)} in ${elementName(host)}`,
				LOG_ERROR,
			)
			updater.reject?.(error)
		}

		const fallback = read(target)

		return effect((): undefined => {
			const value = resolveReactive(reactive, host, target, operationDesc)
			const resolvedValue =
				value === RESET
					? fallback
					: value === UNSET
						? updater.delete
							? null
							: fallback
						: value

			if (updater.delete && resolvedValue === null) {
				try {
					updater.delete!(target)
					ok('delete')()
				} catch (error) {
					err('delete')(error)
				}
			} else if (resolvedValue != null) {
				const current = read(target)
				if (Object.is(resolvedValue, current)) return
				try {
					update(target, resolvedValue)
					ok('update')()
				} catch (error) {
					err('update')(error)
				}
			}
		})
	}

/**
 * Effect for dynamically inserting or removing elements based on a reactive numeric value.
 * Positive values insert elements, negative values remove them.
 *
 * @since 0.12.1
 * @param {Reactive<number, P, E>} reactive - Reactive value determining number of elements to insert (positive) or remove (negative)
 * @param {ElementInserter<E>} inserter - Configuration object defining how to create and position elements
 * @returns {Effect<P, E>} Effect function that manages element insertion and removal
 */
const insertOrRemoveElement =
	<P extends ComponentProps, E extends Element = HTMLElement>(
		reactive: Reactive<number, P, E>,
		inserter?: ElementInserter<E>,
	): Effect<P, E> =>
	(host, target) => {
		const ok = (verb: string) => () => {
			if (DEV_MODE && host.debug) {
				log(
					target,
					`${verb} element in ${elementName(target)} in ${elementName(host)}`,
				)
			}
			if (isFunction(inserter?.resolve)) {
				inserter.resolve(target)
			} else {
				const signal = isSignal<number>(reactive) ? reactive : undefined
				if (isState(signal)) signal.set(0)
			}
		}

		const err = (verb: string) => (error: unknown) => {
			log(
				error,
				`Failed to ${verb} element in ${elementName(target)} in ${elementName(host)}`,
				LOG_ERROR,
			)
			inserter?.reject?.(error)
		}

		return effect((): undefined => {
			const diff = resolveReactive(
				reactive,
				host,
				target,
				'insertion or deletion',
			)
			const resolvedDiff = diff === RESET ? 0 : diff

			if (resolvedDiff > 0) {
				// Positive diff => insert element
				if (!inserter) throw new TypeError(`No inserter provided`)
				try {
					for (let i = 0; i < resolvedDiff; i++) {
						const element = inserter.create(target)
						if (!element) continue
						target.insertAdjacentElement(
							inserter.position ?? 'beforeend',
							element,
						)
					}
					ok('insert')()
				} catch (error) {
					err('insert')(error)
				}
			} else if (resolvedDiff < 0) {
				try {
					if (
						inserter &&
						(inserter.position === 'afterbegin' ||
							inserter.position === 'beforeend')
					) {
						for (let i = 0; i > resolvedDiff; i--) {
							if (inserter.position === 'afterbegin')
								target.firstElementChild?.remove()
							else target.lastElementChild?.remove()
						}
					} else {
						target.remove()
					}
					ok('remove')()
				} catch (error) {
					err('remove')(error)
				}
			}
		})
	}

export {
	type Effect,
	type Effects,
	type ElementEffects,
	type Reactive,
	runEffects,
	runElementEffects,
	resolveReactive,
	updateElement,
	insertOrRemoveElement,
	RESET,
}
