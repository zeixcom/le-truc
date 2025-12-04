import {
	type ComputedCallback,
	createComputed,
	createState,
	isComputed,
	isComputedCallback,
	isFunction,
	isMutableSignal,
	isSignal,
	isState,
	isStore,
	type MaybeCleanup,
	type Signal,
	UNSET,
} from '@zeix/cause-effect'

import { type Effects, runEffects } from './effects'
import {
	DependencyTimeoutError,
	InvalidComponentNameError,
	InvalidPropertyNameError,
} from './errors'
import { isParser, type Parser } from './parsers'
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
		| ((ui: ComponentUI<P, U>) => MaybeSignal<P[K]> | void)
}

type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>

/* === Constants === */

const DEPENDENCY_TIMEOUT = 50

/* === Exported Functions === */

/**
 * Define a component with dependency resolution and setup function (connectedCallback)
 *
 * @since 0.15.0
 * @param {string} name - Custom element name
 * @param {object} props - Component properties
 * @param {function} select - Function to select UI elements
 * @param {function} setup - Setup function
 * @throws {InvalidComponentNameError} If component name is invalid
 * @throws {InvalidPropertyNameError} If property name is invalid
 */
function defineComponent<P extends ComponentProps, U extends UI = {}>(
	name: string,
	props: Initializers<P, U> = {} as Initializers<P, U>,
	select: (elementQueries: ElementQueries) => U = () => ({}) as U,
	setup: (
		ui: ComponentUI<P, U>,
	) => Effects<P, ComponentUI<P, U>> = () => ({}),
): Component<P> {
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)
	for (const prop of Object.keys(props)) {
		const error = validatePropertyName(prop)
		if (error) throw new InvalidPropertyNameError(name, prop, error)
	}

	class Truc extends HTMLElement {
		debug?: boolean
		#ui = {} as ComponentUI<P, U>
		#signals = {} as { [K in keyof P]: Signal<P[K]> }
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
			const [elementQueries, getDependencies] = getHelpers(this)
			this.#ui = {
				...select(elementQueries),
				host: this as unknown as Component<P>,
			}
			Object.freeze(this.#ui)

			// Initialize signals
			const createSignal = <K extends keyof P & string>(
				key: K,
				initializer: Initializers<P, U>[K],
			) => {
				const result = isFunction(initializer)
					? isParser(initializer)
						? (initializer as Parser<P[K], U>)(this.#ui, null)
						: (
								initializer as (
									ui: ComponentUI<P, U>,
								) => MaybeSignal<P[K]> | void
							)(this.#ui)
					: (initializer as MaybeSignal<P[K]>)
				if (result != null) this.#setAccessor(key, result)
			}
			for (const [prop, initializer] of Object.entries(props)) {
				if (initializer == null || prop in this) continue
				createSignal(prop, initializer)
			}

			// Initialize effects
			const effects = setup(this.#ui)

			// Resolve dependencies and run setup function
			const deps = getDependencies()
			const runSetup = () => {
				this.#cleanup = runEffects(this.#ui, effects)
			}

			if (deps.length) {
				Promise.race([
					Promise.all(
						deps.map(dep => customElements.whenDefined(dep)),
					),
					new Promise((_, reject) => {
						setTimeout(() => {
							reject(
								new DependencyTimeoutError(
									this,
									deps.filter(
										dep => !customElements.get(dep),
									),
								),
							)
						}, DEPENDENCY_TIMEOUT)
					}),
				])
					.then(runSetup)
					.catch(() => {
						// Error during setup of <${name}>. Trying to run effects anyway.
						runSetup()
					})
			} else {
				runSetup()
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
			// Unchanged or controlled by computed
			if (newValue === oldValue || isComputed(this.#signals[name])) return

			// Check whether we have a parser for the attribute
			const parser = props[name]
			if (!isParser<P[K], U>(parser)) return

			const parsed = parser(this.#ui, newValue, oldValue)
			if (name in this) (this as unknown as P)[name] = parsed
			else this.#setAccessor(name, parsed)
		}

		/**
		 * Set the signal for a given key
		 *
		 * @since 0.15.0
		 * @param {K} key - Key to set accessor for
		 * @param {MaybeSignal<P[K]>} value - Initial value, signal or computed callback to create signal
		 */
		#setAccessor<K extends keyof P>(
			key: K,
			value: MaybeSignal<P[K]>,
		): void {
			const signal = isSignal(value)
				? value
				: isComputedCallback(value)
					? createComputed(value)
					: createState(value)
			const prev = this.#signals[key]
			const mutable = isMutableSignal(signal)
			this.#signals[key] = signal as Signal<P[K]>
			Object.defineProperty(this, key, {
				get: signal.get,
				set: mutable ? signal.set : undefined,
				enumerable: true,
				configurable: mutable,
			})
			if ((prev && isState(prev)) || isStore(prev)) prev.set(UNSET)
		}
	}

	customElements.define(name, Truc)
	return customElements.get(name) as unknown as Component<P>
}

export {
	type Component,
	type ComponentProp,
	type ComponentProps,
	type ComponentUI,
	type ComponentSetup,
	type MaybeSignal,
	type ReservedWords,
	type Initializers,
	defineComponent,
}
