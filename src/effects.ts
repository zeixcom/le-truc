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
import { DEV_MODE, elementName, LOG_ERROR, LOG_WARN, log } from './util'

/* === Types === */

/**
 * A single effect function bound to a host component and a target element.
 * Returned by built-in effect factories (`setText`, `setAttribute`, `on`, etc.)
 * and by `updateElement`. May return a cleanup function that runs when the
 * component disconnects or when the target element is removed.
 */
type Effect<P extends ComponentProps, E extends Element> = (
	host: Component<P>,
	target: E,
) => MaybeCleanup

/**
 * One or more effects for a single UI element.
 * The setup function may return a single `Effect` or an array of `Effect`s
 * for each key of the UI object.
 */
type ElementEffects<P extends ComponentProps, E extends Element> =
	| Effect<P, E>
	| Effect<P, E>[]

/**
 * The return type of the `setup` function passed to `defineComponent`.
 * Keys correspond to keys of the UI object (queried elements and `host`);
 * values are one or more effects to run for that element.
 */
type Effects<
	P extends ComponentProps,
	U extends UI & { host: Component<P> },
> = {
	[K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>>
}

/**
 * A reactive value driving a DOM update inside an `updateElement` effect.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the effect.
 * - `(target: E) => T | null | undefined` — a reader function receiving the
 *   target element; return `null` to delete the DOM value, `undefined` to
 *   restore the original fallback captured at setup time.
 */
type Reactive<T, P extends ComponentProps, E extends Element> =
	| keyof P
	| Signal<T & {}>
	| ((target: E) => T | null | undefined)

/**
 * Operation code used internally by `updateElement` for debug logging.
 *
 * | Code | Operation      |
 * |------|----------------|
 * | `a`  | attribute      |
 * | `c`  | CSS class      |
 * | `d`  | dataset        |
 * | `h`  | innerHTML      |
 * | `m`  | method call    |
 * | `p`  | property       |
 * | `s`  | style property |
 * | `t`  | text content   |
 */
type UpdateOperation = 'a' | 'c' | 'd' | 'h' | 'm' | 'p' | 's' | 't'

/**
 * Descriptor passed to `updateElement` that defines how to read, update, and
 * optionally delete a single DOM property or attribute.
 *
 * - `read` — captures the current DOM value as the fallback at setup time.
 * - `update` — called with the resolved reactive value when it changes.
 * - `delete` — called when the reactive returns `null` (removes the value).
 * - `resolve` / `reject` — optional lifecycle hooks for debug instrumentation.
 */
type ElementUpdater<E extends Element, T> = {
	op: UpdateOperation
	name?: string
	read: (element: E) => T | null
	update: (element: E, value: T) => void
	delete?: (element: E) => void
	resolve?: (element: E) => void
	reject?: (error: unknown) => void
}

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
 * Activate effects returned by the setup function inside a reactive scope.
 *
 * For Memo targets (from `all()`), wraps iteration in a `createEffect` so the
 * loop re-runs when elements are added or removed. For single Element targets
 * (from `first()`), runs effects directly in the scope.
 *
 * @since 0.15.0
 * @param {U} ui - Frozen UI object containing queried DOM elements and `host`
 * @param {Effects<P, U>} effects - Effects keyed by UI element name, returned by the setup function
 * @returns {Cleanup} Cleanup function that disposes the reactive scope and all child effects
 * @throws {InvalidEffectsError} If the effects argument is not a plain object
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
 * Resolve a `Reactive<T>` to a concrete value inside a reactive tracking context.
 *
 * Handles all three forms of `Reactive<T>`:
 * - `keyof P` string → reads `host[name]` (registers signal dependency)
 * - `Signal<T>` → calls `.get()` (registers signal dependency)
 * - `(target: E) => T` → calls the reader function
 *
 * Returns `undefined` on error, which causes `updateElement` to restore the original DOM value.
 *
 * @param {Reactive<T, P, E>} reactive - Reactive property name, signal, or reader function
 * @param {Component<P>} host - The component host element
 * @param {E} target - The target element the effect operates on
 * @param {string} [context] - Description used in error log messages
 * @returns {T | undefined} Resolved value, or `undefined` if resolution failed
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
): T | undefined => {
	try {
		if (typeof reactive === 'string') {
			if (DEV_MODE && !(reactive in host)) {
				log(
					reactive,
					`resolveReactive: property '${reactive}' does not exist on ${elementName(host)}`,
					LOG_WARN,
				)
			}
			return host[reactive] as unknown as T
		}
		return isSignal(reactive)
			? reactive.get()
			: isFunction(reactive)
				? (reactive(target) as unknown as T)
				: undefined
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
		return undefined
	}
}

/**
 * Shared abstraction used by all built-in DOM effects.
 *
 * Captures the current DOM value as a fallback, then creates a `createEffect` that
 * re-runs whenever the reactive value changes. On each run:
 * - `undefined` → restore the original DOM value
 * - `null` → call `updater.delete` if available, else restore fallback
 * - anything else → call `updater.update` if the value changed
 *
 * @since 0.9.0
 * @param {Reactive<T, P, E>} reactive - Reactive value driving the DOM update (property name, signal, or reader function)
 * @param {ElementUpdater<E, T>} updater - Describes how to read, update, and optionally delete the DOM property
 * @returns {Effect<P, E>} Effect that manages the reactive DOM update and returns a cleanup function
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
				value === undefined
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
	resolveReactive,
	runEffects,
	type UpdateOperation,
	updateElement,
}
