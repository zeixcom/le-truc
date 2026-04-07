import {
	createComputed,
	createScope,
	createSlot,
	createState,
	isComputed,
	isFunction,
	isMutableSignal,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type Memo,
	type MemoCallback,
	type Signal,
	type State,
	type TaskCallback,
	unown,
} from '@zeix/cause-effect'
import type { Context } from './context'
import {
	type EffectDescriptor,
	type Effects,
	type FactoryResult,
	runEffects,
} from './effects'
import { InvalidComponentNameError, InvalidPropertyNameError } from './errors'
import type { PassedProps } from './factory'
import {
	makeOn,
	makePass,
	makeProvideContexts,
	makeRequestContext,
	makeWatch,
	type WatchHandlers,
} from './factory'
import { getSignals } from './internal'
import {
	isMethodProducer,
	isParser,
	METHOD_BRAND,
	type Parser,
	type Reader,
} from './parsers'
import { type ElementQueries, getHelpers, type UI } from './ui'
import { validatePropertyName } from './util'

/* === Types === */

/**
 * Property names that must not be used as reactive component properties
 * because they are fundamental JavaScript / `Object` builtins.
 */
type ReservedWords =
	| 'constructor'
	| 'prototype'
	| '__proto__'
	| 'toString'
	| 'valueOf'
	| 'hasOwnProperty'
	| 'isPrototypeOf'
	| 'propertyIsEnumerable'
	| 'toLocaleString'

/** A valid reactive property name — any string that is not an `HTMLElement` or `ReservedWords` key. */
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>

/** A record of reactive property names to their value types, used to type a component's props. */
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>

/**
 * An `HTMLElement` extended with a component's reactive properties as
 * signal-backed accessors.
 *
 * @deprecated Use `HTMLElement & P` instead.
 **/
type Component<P extends ComponentProps> = HTMLElement & P

/**
 * The UI object passed to the `setup` function: the result of the `select`
 * function merged with a `host` key pointing to the component element itself.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`. Use the v1.1 factory form with `FactoryContext` instead.
 */
type ComponentUI<P extends ComponentProps, U extends UI> = U & {
	host: HTMLElement & P
}

/**
 * The type of the `setup` function passed to `defineComponent`.
 * Receives the frozen UI object (including `host`) and returns an `Effects` record.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`. Use the v1.1 factory form with `FactoryContext` instead.
 */
type ComponentSetup<P extends ComponentProps, U extends UI> = (
	ui: ComponentUI<P, U>,
) => Effects<P, ComponentUI<P, U>>

/**
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A **static value** or **`Signal`** — used directly as the initial signal value.
 * - A **`Parser`** (two-argument function branded with `asParser()`) — called with
 *   `(ui, attributeValue)` at connect time and again on every attribute change.
 * - A **`Reader`** (one-argument function) — called with `ui` at connect time; if it
 *   returns a function or `TaskCallback`, a computed/task signal is created; otherwise
 *   a mutable state signal is created.
 * - A **`MethodProducer`** (branded with `asMethod()`) — assigned directly as the property
 *   value; the function IS the method. Per-instance state lives in factory scope.
 */
type Initializers<P extends ComponentProps, U extends UI> = {
	[K in keyof P]?:
		| P[K]
		| Signal<P[K]>
		| Parser<P[K], ComponentUI<P, U>>
		| Reader<MaybeSignal<P[K]>, ComponentUI<P, U>>
		| (P[K] extends (...args: any[]) => any
				? P[K] & { readonly [METHOD_BRAND]: true }
				: never)
}

/**
 * Any value that `#setAccessor` can turn into a signal:
 * - `T` — wrapped in `createState()`
 * - `Signal<T>` — used directly
 * - `MemoCallback<T>` — wrapped in `createComputed()`
 * - `TaskCallback<T>` — wrapped in `createTask()`
 */
type MaybeSignal<T extends {}> =
	| T
	| Signal<T>
	| MemoCallback<T>
	| TaskCallback<T>

/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from a signal source (property name, Signal, or array).
 * Only the declared sources trigger re-runs — incidental reads inside the handler
 * are not tracked. Returns an `EffectDescriptor`.
 */
type FactoryWatchHelper<P extends ComponentProps> = {
	<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybeCleanup | void,
	): EffectDescriptor
	<K extends keyof P & string>(
		source: K,
		handlers: WatchHandlers<P[K]>,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybeCleanup | void,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handlers: WatchHandlers<T>,
	): EffectDescriptor
	(
		source: Array<string | Signal<any>>,
		handler: (values: any[]) => MaybeCleanup | void,
	): EffectDescriptor
}

/**
 * The `on` helper type in `FactoryContext`.
 *
 * Attaches an event listener. The handler always receives `(event, element)`.
 * For Memo targets, uses event delegation (or per-element fallback for non-bubbling events).
 */
type FactoryOnHelper<P extends ComponentProps> = {
	<E extends Element, T extends keyof HTMLElementEventMap>(
		target: E,
		type: T,
		handler: (
			event: HTMLElementEventMap[T],
			element: E,
		) => { [K in keyof P]?: P[K] } | void,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element>(
		target: E,
		type: string,
		handler: (event: Event, element: E) => { [K in keyof P]?: P[K] } | void,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element, T extends keyof HTMLElementEventMap>(
		target: Memo<E[]>,
		type: T,
		handler: (
			event: HTMLElementEventMap[T],
			element: E,
		) => { [K in keyof P]?: P[K] } | void,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element>(
		target: Memo<E[]>,
		type: string,
		handler: (event: Event, element: E) => { [K in keyof P]?: P[K] } | void,
		options?: AddEventListenerOptions,
	): EffectDescriptor
}

/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 */
type FactoryPassHelper<P extends ComponentProps> = {
	<Q extends ComponentProps>(
		target: HTMLElement & Q,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	<Q extends ComponentProps>(
		target: Memo<(HTMLElement & Q)[]>,
		props: PassedProps<P, Q>,
	): EffectDescriptor
}

/**
 * The `provideContexts` helper type in `FactoryContext`.
 *
 * Attaches a `context-request` listener to the host, providing the listed
 * property values as context to descendant consumers. Returns an `EffectDescriptor`.
 */
type FactoryProvideContextsHelper<P extends ComponentProps> = (
	contexts: Array<keyof P>,
) => EffectDescriptor

/**
 * The `requestContext` helper type in `FactoryContext`.
 *
 * Dispatches a `context-request` event from the host and returns a `Memo<T>`
 * that tracks the provider's value. Falls back to `fallback` if no provider responds.
 * For use inside `expose()` as a property initializer.
 */
type FactoryRequestContextHelper = <T extends {}>(
	context: Context<string, () => T>,
	fallback: T,
) => Memo<T>

/**
 * The context object passed to the v1.1 factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
	host: HTMLElement & P
	expose: (props: Initializers<P, {}>) => void
	watch: FactoryWatchHelper<P>
	on: FactoryOnHelper<P>
	pass: FactoryPassHelper<P>
	provideContexts: FactoryProvideContextsHelper<P>
	requestContext: FactoryRequestContextHelper
}

/* === Exported Functions === */

/**
 * Define and register a reactive custom element using the v1.1 factory form.
 *
 * The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
 * the `host` element, and `expose()` for declaring reactive properties. It returns a flat
 * array of effect descriptors created by helpers like `watch()`, `on()`, `each()`, `pass()`,
 * and `provideContexts()`.
 *
 * Effects activate after dependency resolution — child custom elements are guaranteed to
 * be defined before any descriptor runs.
 *
 * @since 1.1
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {function} factory - Factory function that queries elements, calls expose(), and returns effect descriptors
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult,
): HTMLElement & P

/**
 * Define and register a reactive custom element using the v1.0 4-param form.
 *
 * Calls `customElements.define()` and returns the registered class.
 * Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.
 *
 * @deprecated Use the v1.1 factory form `defineComponent(name, factory)` with `expose()` and effect descriptors instead.
 * The 4-param form remains fully supported for components that require attribute-reactive `observedAttributes`.
 * @since 0.15.0
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {Initializers<P, U>} props - Initializers for reactive properties: static values, signals, parsers, or readers
 * @param {function} select - Receives `{ first, all }` query helpers; returns the UI object (queried DOM elements used by effects)
 * @param {function} setup - Receives the frozen UI object (plus `host`) and returns effects keyed by UI element name
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 * @throws {InvalidPropertyNameError} If a property name conflicts with reserved words or inherited HTMLElement properties
 */
function defineComponent<P extends ComponentProps, U extends UI = {}>(
	name: string,
	props?: Initializers<P, U>,
	select?: (elementQueries: ElementQueries) => U,
	setup?: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>,
): HTMLElement & P

function defineComponent<P extends ComponentProps, U extends UI = {}>(
	name: string,
	propsOrFactory:
		| Initializers<P, U>
		| ((context: FactoryContext<P>) => FactoryResult) = {} as Initializers<
		P,
		U
	>,
	select: (elementQueries: ElementQueries) => U = () => ({}) as U,
	setup: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>> = () => ({}),
): HTMLElement & P {
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)

	const factory = isFunction(propsOrFactory)
		? (propsOrFactory as (context: FactoryContext<P>) => FactoryResult)
		: null
	const props = factory
		? ({} as Initializers<P, U>)
		: (propsOrFactory as Initializers<P, U>)

	if (!factory) {
		for (const prop of Object.keys(props)) {
			const error = validatePropertyName(prop)
			if (error) throw new InvalidPropertyNameError(name, prop, error)
		}
	}

	class Truc extends HTMLElement {
		debug?: boolean
		#ui: ComponentUI<P, U> | undefined
		#cleanup: MaybeCleanup

		static observedAttributes = factory
			? []
			: (Object.entries(props)
					?.filter(([, initializer]) => isParser(initializer))
					.map(([prop]) => prop) ?? [])

		/**
		 * Native callback when the custom element is first connected to the document
		 */
		connectedCallback() {
			const [elementQueries, resolveDependencies] = getHelpers(this)
			const host = this as unknown as HTMLElement & P

			if (factory) {
				// Create expose() helper for the v1.1 factory form.
				// Called inside the factory body to declare reactive properties.
				const expose = (instanceProps: Initializers<P, {}>) => {
					const minimalUi = Object.freeze({ host }) as ComponentUI<P, U>
					this.#ui = minimalUi
					this.#initSignals(
						minimalUi,
						instanceProps as unknown as Initializers<P, U>,
					)
				}

				const context: FactoryContext<P> = {
					...elementQueries,
					host,
					expose,
					watch: makeWatch(host),
					on: makeOn(host),
					pass: makePass(host),
					provideContexts: makeProvideContexts(host),
					requestContext: makeRequestContext(host),
				}

				const result = (factory as (ctx: FactoryContext<P>) => FactoryResult)(
					context,
				)

				if (Array.isArray(result)) {
					// v1.1 factory form: result is a flat array of effect descriptors.
					// expose() was called inside the factory body; signals are already initialized.
					if (!this.#ui) {
						this.#ui = Object.freeze({ host }) as ComponentUI<P, U>
					}
					resolveDependencies(() => {
						this.#cleanup = createScope(() => {
							for (const descriptor of result as FactoryResult) {
								if (descriptor) descriptor()
							}
						})
					})
				}
			} else {
				// 4-param form: observedAttributes derived from props parsers
				const ui = {
					...select(elementQueries),
					host,
				} as ComponentUI<P, U>
				this.#ui = ui
				Object.freeze(this.#ui)
				this.#initSignals(ui, props)
				resolveDependencies(() => {
					this.#cleanup = unown(() => runEffects(ui, setup(ui)))
				})
			}
		}

		/**
		 * Native callback when the custom element is disconnected from the document
		 */
		disconnectedCallback() {
			if (isFunction(this.#cleanup)) this.#cleanup()
		}

		/**
		 * Native callback when an observed attribute of the custom element changes
		 *
		 * @param {K} name - Name of the modified attribute
		 * @param {string | null} oldValue - Old value of the modified attribute
		 * @param {string | null} newValue - New value of the modified attribute
		 */
		attributeChangedCallback<K extends keyof P>(
			name: K,
			oldValue: string | null,
			newValue: string | null,
		) {
			// Not connected yet, unchanged value or controlled by computed
			if (
				!this.#ui ||
				newValue === oldValue ||
				isComputed(getSignals(this)[name as string])
			)
				return

			// Check whether we have a parser for the attribute
			const parser = props[name]
			if (!isParser<P[K], ComponentUI<P, U>>(parser)) return

			const parsed = parser(this.#ui, newValue, oldValue)
			if (name in this) (this as unknown as P)[name] = parsed
			else this.#setAccessor(name, parsed)
		}

		/**
		 * Initialize signals for each property in the given initializers map.
		 * Dispatch order: Parser → MethodProducer → Reader → static/Signal
		 *
		 * @param {ComponentUI<P, U>} ui - Frozen UI object (including host)
		 * @param {Initializers<P, U>} instanceProps - Property initializers to process
		 */
		#initSignals(
			ui: ComponentUI<P, U>,
			instanceProps: Initializers<P, U>,
		): void {
			const createSignal = <K extends keyof P & string>(
				key: K,
				initializer: Initializers<P, U>[K],
			) => {
				if (isParser<P[K], ComponentUI<P, U>>(initializer)) {
					const result = initializer(ui, this.getAttribute(key))
					if (result != null) this.#setAccessor(key, result)
				} else if (isMethodProducer(initializer)) {
					;(this as any)[key] = initializer
				} else if (isFunction<MaybeSignal<P[K]>>(initializer)) {
					const result = (
						initializer as Reader<MaybeSignal<P[K]>, ComponentUI<P, U>>
					)(ui)
					if (result != null) this.#setAccessor(key, result)
				} else {
					const value = initializer as MaybeSignal<P[K]>
					if (value != null) this.#setAccessor(key, value)
				}
			}
			for (const [prop, initializer] of Object.entries(instanceProps)) {
				if (initializer == null || prop in this) continue
				createSignal(prop as keyof P & string, initializer)
			}
		}

		/**
		 * Create or replace the Slot-backed property accessor for a reactive property.
		 * Mutable signals are wrapped in a Slot so their backing signal can be swapped
		 * later (e.g. by `attributeChangedCallback` or `pass()`).
		 *
		 * @since 0.15.0
		 * @param {K} key - Reactive property name
		 * @param {MaybeSignal<P[K]>} value - Static value, signal, or computed callback
		 */
		#setAccessor<K extends keyof P>(key: K, value: MaybeSignal<P[K]>): void {
			const signal = isSignal(value)
				? value
				: isFunction<P[K]>(value)
					? createComputed(value)
					: (createState(value) as State<P[K]>)
			const signals = getSignals(this)
			const k = key as string
			const prev = signals[k]
			if (isSlot(prev)) {
				prev.replace(signal)
			} else if (isMutableSignal(signal)) {
				const slot = createSlot<P[K]>(signal)
				signals[k] = slot
				Object.defineProperty(this, key, slot)
			} else {
				signals[k] = signal
				Object.defineProperty(this, key, {
					get: signal.get,
					enumerable: true,
				})
			}
		}
	}

	customElements.define(name, Truc)
	return customElements.get(name) as unknown as HTMLElement & P
}

export {
	type Component,
	type ComponentProp,
	type ComponentProps,
	type ComponentSetup,
	type ComponentUI,
	defineComponent,
	type FactoryContext,
	type FactoryOnHelper,
	type FactoryPassHelper,
	type FactoryProvideContextsHelper,
	type FactoryRequestContextHelper,
	type FactoryWatchHelper,
	type Initializers,
	type MaybeSignal,
	type ReservedWords,
}
