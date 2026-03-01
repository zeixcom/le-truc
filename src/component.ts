import {
	createComputed,
	createSlot,
	createState,
	isComputed,
	isFunction,
	isMutableSignal,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type MemoCallback,
	type Signal,
	type State,
	type TaskCallback,
	unown,
} from '@zeix/cause-effect'

import { type Effects, runEffects } from './effects'
import { InvalidComponentNameError, InvalidPropertyNameError } from './errors'
import { getSignals } from './internal'
import { isMethodProducer, isParser, type Parser, type Reader } from './parsers'
import { type ElementQueries, getHelpers, type UI } from './ui'
import { validatePropertyName } from './util'

/* === Types === */

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

type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>

type Component<P extends ComponentProps> = HTMLElement & P
type ComponentUI<P extends ComponentProps, U extends UI> = U & {
	host: Component<P>
}

type ComponentSetup<P extends ComponentProps, U extends UI> = (
	ui: ComponentUI<P, U>,
) => Effects<P, ComponentUI<P, U>>

type Initializers<P extends ComponentProps, U extends UI> = {
	[K in keyof P]?:
		| P[K]
		| Signal<P[K]>
		| Parser<P[K], ComponentUI<P, U>>
		| Reader<MaybeSignal<P[K]>, ComponentUI<P, U>>
		| ((ui: ComponentUI<P, U>) => void)
}

type MaybeSignal<T extends {}> =
	| T
	| Signal<T>
	| MemoCallback<T>
	| TaskCallback<T>

/* === Exported Functions === */

/**
 * Define and register a reactive custom element.
 *
 * Calls `customElements.define()` and returns the registered class.
 * Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.
 *
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
	props: Initializers<P, U> = {} as Initializers<P, U>,
	select: (elementQueries: ElementQueries) => U = () => ({}) as U,
	setup: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>> = () => ({}),
): Component<P> {
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)
	for (const prop of Object.keys(props)) {
		const error = validatePropertyName(prop)
		if (error) throw new InvalidPropertyNameError(name, prop, error)
	}

	class Truc extends HTMLElement {
		debug?: boolean
		#ui: ComponentUI<P, U> | undefined
		#cleanup: MaybeCleanup

		static observedAttributes =
			Object.entries(props)
				?.filter(([, initializer]) => isParser(initializer))
				.map(([prop]) => prop) ?? []

		/**
		 * Native callback when the custom element is first connected to the document
		 */
		connectedCallback() {
			// Initialize UI
			const [elementQueries, resolveDependencies] = getHelpers(this)
			const ui = {
				...select(elementQueries),
				host: this as unknown as Component<P>,
			}
			this.#ui = ui
			Object.freeze(this.#ui)

			// Initialize signals — dispatch order: Parser → MethodProducer → Reader → static/Signal
			const createSignal = <K extends keyof P & string>(
				key: K,
				initializer: Initializers<P, U>[K],
			) => {
				if (isParser<P[K], ComponentUI<P, U>>(initializer)) {
					const result = initializer(ui, this.getAttribute(key))
					if (result != null) this.#setAccessor(key, result)
				} else if (isMethodProducer(initializer)) {
					initializer(ui)
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
			for (const [prop, initializer] of Object.entries(props)) {
				if (initializer == null || prop in this) continue
				createSignal(prop, initializer)
			}

			// Resolve dependencies and run setup function
			resolveDependencies(() => {
				this.#cleanup = unown(() => runEffects(ui, setup(ui)))
			})
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
	return customElements.get(name) as unknown as Component<P>
}

export {
	defineComponent,
	type Component,
	type ComponentProp,
	type ComponentProps,
	type ComponentSetup,
	type ComponentUI,
	type Initializers,
	type MaybeSignal,
	type ReservedWords,
}
