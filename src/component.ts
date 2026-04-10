import {
	createComputed,
	createScope,
	createSlot,
	createState,
	isFunction,
	isMutableSignal,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type MemoCallback,
	type Signal,
	type State,
	type TaskCallback,
} from '@zeix/cause-effect'
import {
	makeProvideContexts,
	makeRequestContext,
	type ProvideContextsHelper,
	type RequestContextHelper,
} from './context'
import {
	type FactoryResult,
	type Falsy,
	makePass,
	makeWatch,
	type PassHelper,
	type WatchHelper,
} from './effects'
import { InvalidComponentNameError } from './errors'
import { makeOn, type OnHelper } from './events'
import { getSignals } from './internal'
import {
	isMethodProducer,
	isParser,
	METHOD_BRAND,
	type Parser,
} from './parsers'
import { type ElementQueries, makeElementQueries } from './ui'

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
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A **static value** or **`Signal`** — used directly as the initial signal value.
 * - A **`Parser`** (branded with `asParser()`) — called with the attribute value string
 *   at connect time; for 4-param form also on every attribute change.
 * - A **`MethodProducer`** (branded with `defineMethod()`) — assigned directly as the property
 *   value; the function IS the method. Per-instance state lives in factory scope.
 */
type Initializers<P extends ComponentProps> = {
	[K in keyof P]?:
		| P[K]
		| Signal<P[K]>
		| Parser<P[K]>
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
 * The context object passed to the v1.1 factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
	host: HTMLElement & P
	expose: (props: Initializers<P>) => void
	watch: WatchHelper<P>
	on: OnHelper<P>
	pass: PassHelper<P>
	provideContexts: ProvideContextsHelper<P>
	requestContext: RequestContextHelper
}

/* === Exported Functions === */

/**
 * Define and register a reactive custom element using the v1.1 factory form.
 *
 * The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
 * the `host` element, and `expose()` for declaring reactive properties. It returns a flat
 * array of effect descriptors created by helpers like `watch()`, `on()`, `pass()`,
 * `provideContexts()`, and `requestContext()`.
 *
 * Effects activate after dependency resolution — child custom elements are guaranteed to
 * be defined before any descriptor runs.
 *
 * @since 2.0
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {function} factory - Factory function that queries elements, calls expose(), and returns effect descriptors
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
): CustomElementConstructor | undefined {
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)

	class Truc extends HTMLElement {
		debug?: boolean
		#cleanup: MaybeCleanup

		/**
		 * Native callback when the custom element is first connected to the document
		 */
		connectedCallback() {
			const [elementQueries, resolveDependencies] = makeElementQueries(this)
			const host = this as unknown as HTMLElement & P

			// Create expose() helper — called inside the factory body to declare reactive properties.
			const expose = (instanceProps: Initializers<P>) => {
				this.#initSignals(instanceProps)
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

			const result = factory(context)
			if (!result) return

			resolveDependencies(() => {
				this.#cleanup = createScope(() => {
					const activate = (res: FactoryResult) => {
						for (const descriptor of res) {
							if (Array.isArray(descriptor)) activate(descriptor)
							else if (descriptor) descriptor()
						}
					}
					activate(result)
				})
			})
		}

		/**
		 * Native callback when the custom element is disconnected from the document
		 */
		disconnectedCallback() {
			if (isFunction(this.#cleanup)) this.#cleanup()
		}

		/**
		 * Initialize signals for each property in the given initializers map.
		 * Dispatch order: Parser → MethodProducer → static/Signal
		 *
		 * @param {Initializers<P>} instanceProps - Property initializers to process
		 */
		#initSignals(instanceProps: Initializers<P>): void {
			const createReactiveProperty = <K extends keyof P & string>(
				key: K,
				initializer: Initializers<P>[K],
			) => {
				if (isParser<P[K]>(initializer)) {
					const result = initializer(this.getAttribute(key))
					if (result != null) this.#setAccessor(key, result)
				} else if (isMethodProducer(initializer)) {
					;(this as any)[key] = initializer
				} else {
					const value = initializer as MaybeSignal<P[K]>
					if (value != null) this.#setAccessor(key, value)
				}
			}
			for (const [prop, initializer] of Object.entries(instanceProps)) {
				if (initializer == null || prop in this) continue
				createReactiveProperty(prop as keyof P & string, initializer)
			}
		}

		/**
		 * Create or replace the Slot-backed property accessor for a reactive property.
		 * Mutable signals are wrapped in a Slot so their backing signal can be swapped
		 * later (e.g. by `pass()`).
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
	return customElements.get(name)
}

export {
	type ComponentProp,
	type ComponentProps,
	defineComponent,
	type FactoryContext,
	type Initializers,
	type MaybeSignal,
	type ReservedWords,
}
