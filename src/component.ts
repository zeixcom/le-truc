import {
	type ComputedCallback,
	computed,
	isComputed,
	isComputedCallback,
	isFunction,
	isMutableSignal,
	isSignal,
	isState,
	isStore,
	type MaybeCleanup,
	type Signal,
	state,
	UNSET,
} from '@zeix/cause-effect'

import { type Effects, runEffects } from './effects'
import {
	DependencyTimeoutError,
	InvalidComponentNameError,
	InvalidPropertyNameError,
} from './errors'
import { type Extractor } from './extractors'
import { isParser, type Parser } from './parsers'
import { getHelpers, type Helpers, type UI } from './ui'
import {
	DEV_MODE,
	elementName,
	LOG_WARN,
	log,
	typeString,
	validatePropertyName,
	valueString,
} from './util'

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

type ComponentUI<P extends ComponentProps, U extends UI> = {
	component: Component<P>
} & U

type ComponentSetup<P extends ComponentProps, U extends UI> = (
	ui: ComponentUI<P, U>,
	helpers: Helpers<P>,
) => Effects<P, Component<P>>

type ComponentConfig<P extends ComponentProps, U extends UI> = {
	name: string
	select?: (helpers: Helpers<P>) => U
	props?: P
	setup?: ComponentSetup<P, U>
}

type Component<P extends ComponentProps> = HTMLElement & P & { debug?: boolean }

type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>

type Initializer<
	K extends ComponentProp,
	P extends ComponentProps,
	U extends UI,
> =
	| P[K]
	| Parser<P[K], ComponentUI<P, U>>
	| Extractor<MaybeSignal<P[K]>, ComponentUI<P, U>>
	| ((ui: ComponentUI<P, U>) => void)

/* === Constants === */

const DEPENDENCY_TIMEOUT = 50

/* === Exported Functions === */

/**
 * Define a component with dependency resolution and setup function (connectedCallback)
 *
 * @since 0.15.0
 * @param {ComponentConfig<P>} config - Config object for the component
 * @throws {InvalidComponentNameError} If component name is invalid
 * @throws {InvalidPropertyNameError} If property name is invalid
 */
function component<P extends ComponentProps, U extends UI>(
	config: ComponentConfig<P, U>,
): Component<P> {
	const {
		name,
		select = () => ({}) as U,
		props = {} as P,
		setup = () => [],
	} = config
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)
	for (const prop of Object.keys(props)) {
		const error = validatePropertyName(prop)
		if (error) throw new InvalidPropertyNameError(name, prop, error)
	}

	class CustomElement extends HTMLElement {
		debug?: boolean
		#ui = {} as ComponentUI<P, U>
		#signals = {} as { [K in keyof P]: Signal<P[K]> }
		#cleanup: MaybeCleanup

		static observedAttributes =
			Object.entries(props)
				?.filter(([, initializer]) => isParser(initializer))
				.map(([prop]) => prop) ?? []

		/**
		 * Native callback function when the custom element is first connected to the document
		 */
		connectedCallback() {
			if (DEV_MODE) {
				this.debug = this.hasAttribute('debug')
				if (this.debug) log(this, 'Connected')
			}

			// Initialize UI
			const [helpers, getDependencies] = getHelpers(
				this as unknown as Component<P>,
			)
			this.#ui = {
				...select(helpers),
				component: this as unknown as Component<P>,
			}

			// Initialize signals
			const createSignal = <K extends keyof P & string>(
				key: K,
				initializer: Initializer<K, P, U>,
			) => {
				const result = isFunction<MaybeSignal<P[K]>>(initializer)
					? initializer(this as unknown as Component<P>)
					: (initializer as P[K])
				if (result != null) this.#setAccessor(key, result)
			}
			for (const [prop, initializer] of Object.entries(props)) {
				if (initializer == null || prop in this) continue
				createSignal(
					prop,
					initializer as Initializer<keyof P & string, P, U>,
				)
			}

			// Getting effects collects dependencies as a side-effect
			const effects = setup(this.#ui, helpers)

			// Resolve dependencies and run setup function
			const deps = getDependencies()
			const runSetup = () => {
				const cleanup = runEffects(
					effects,
					this as unknown as Component<P>,
				)
				if (cleanup) this.#cleanup = cleanup
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
					.catch(error => {
						if (DEV_MODE)
							log(
								error,
								`Error during setup of <${name}>. Trying to run effects anyway.`,
								LOG_WARN,
							)
						runSetup()
					})
			} else {
				runSetup()
			}
		}

		/**
		 * Native callback function when the custom element is disconnected from the document
		 */
		disconnectedCallback() {
			if (isFunction(this.#cleanup)) this.#cleanup()
			if (DEV_MODE && this.debug) log(this, 'Disconnected')
		}

		/**
		 * Native callback function when an observed attribute of the custom element changes
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
			if (newValue === oldValue || isComputed(this.#signals[name])) return // unchanged or controlled by computed
			const parser = props[name]
			if (!isParser<P[K]>(parser)) return
			const parsed = parser(this.#ui, newValue, oldValue)
			if (DEV_MODE && this.debug)
				log(
					newValue,
					`Attribute "${String(name)}" of ${elementName(this)} changed from ${valueString(oldValue)} to ${valueString(newValue)}, parsed as <${typeString(parsed)}> ${valueString(parsed)}`,
				)
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
					? computed(value)
					: state(value)
			const prev = this.#signals[key]
			const mutable = isMutableSignal(signal)
			this.#signals[key] = signal
			Object.defineProperty(this, key, {
				get: signal.get,
				set: mutable ? signal.set : undefined,
				enumerable: true,
				configurable: mutable,
			})
			if ((prev && isState(prev)) || isStore(prev)) prev.set(UNSET)
			if (DEV_MODE && this.debug)
				log(
					signal,
					`Set ${typeString(signal)} "${String(key)}" in ${elementName(this)}`,
				)
		}
	}

	customElements.define(name, CustomElement)
	return customElements.get(name) as unknown as Component<P>
}

export {
	type Component,
	type ComponentConfig,
	type ComponentProp,
	type ComponentProps,
	type ComponentSetup,
	type ComponentUI,
	type MaybeSignal,
	type ReservedWords,
	type Initializer,
	component,
}
