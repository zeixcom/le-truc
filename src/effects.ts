import {
	type Cleanup,
	createEffect,
	createScope,
	isFunction,
	isMemo,
	isRecord,
	isSignal,
	type MaybeCleanup,
	type Memo,
	type Signal,
	valueString,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import { InvalidEffectsError } from './errors'
import type { ElementFromKey, UI } from './ui'
import { DEV_MODE, elementName, LOG_ERROR, log } from './util'

/* === Types === */

type Effect<P extends ComponentProps, E extends Element> = (
	host: Component<P>,
	target: E,
) => MaybeCleanup

type ElementEffects<P extends ComponentProps, E extends Element> =
	| Effect<P, E>
	| Effect<P, E>[]

type Effects<
	P extends ComponentProps,
	U extends UI & { host: Component<P> },
> = {
	[K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>>
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
 * Run component effects
 *
 * @since 0.15.0
 * @param {ComponentUI<P, U>} ui - Component UI
 * @param {Effects<P, U>} effects - Effect functions to run
 * @returns {Cleanup} - Cleanup function that runs collected cleanup functions
 * @throws {InvalidEffectsError} - If the effects are invalid
 */
const runEffects = <
	P extends ComponentProps,
	U extends UI & { host: Component<P> },
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
		return typeof reactive === 'string'
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
					(host as unknown as E) !== target ? ` in ${elementName(host)}` : ''
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

		return createEffect(() => {
			const value = resolveReactive(reactive, host, target, operationDesc)
			const resolvedValue =
				value === RESET
					? fallback
					: value === null
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

export {
	type Effect,
	type Effects,
	type ElementEffects,
	type ElementUpdater,
	type Reactive,
	type UpdateOperation,
	runEffects,
	resolveReactive,
	updateElement,
	RESET,
}
