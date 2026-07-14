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
import { InvalidComponentNameError, InvalidPropertyNameError } from './errors'
import {
	makeProvideContexts,
	makeRequestContext,
	type ProvideContextsHelper,
	type RequestContextHelper,
} from './helpers/context'
import { type ElementQueries, makeElementQueries } from './helpers/dom'
import { makeOn, type OnHelper } from './helpers/events'
import {
	type FormHelpers,
	makeFormHelpers,
	type OnFormAssociatedHelper,
	type OnFormDisabledHelper,
	type OnFormResetHelper,
	type OnFormStateRestoreHelper,
} from './helpers/form'
import {
	activateResult,
	type FactoryResult,
	type Falsy,
	makePass,
	makeWatch,
	type PassHelper,
	type WatchHelper,
} from './helpers/reactive'
import {
	type FormHandlers,
	type FormState,
	getFormHandlers,
	getSignals,
} from './internal'
import {
	type ComponentProps,
	isMethodProducer,
	isParser,
	isReservedWord,
	type MethodProducer,
	type Parser,
} from './types'
import { DEV_MODE, elementName } from './util'

/* === Types === */

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
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A **static value** or **`Signal`** — used directly as the initial signal value.
 * - A **`Parser`** (branded with `asParser()`) — called with the attribute value string
 *   at connect time.
 * - A **`MethodProducer`** (branded with `defineMethod()`) — assigned directly as the property
 *   value; the function IS the method. Per-instance state lives in factory scope.
 */
type Initializers<P extends ComponentProps> = {
	[K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K]> | MethodProducer
}

/**
 * Static class-level configuration for a component.
 *
 * Passed as the third (optional) argument to `defineComponent`. Currently
 * carries only `formAssociated`, but is extensible for future class-level
 * options without further signature changes.
 */
type ComponentOptions = {
	/**
	 * When `true`, the generated class gets `static formAssociated = true` and
	 * the four form-lifecycle callback stubs. The browser then treats the
	 * element as a form-associated custom element (FACE), enabling
	 * `setFormValue`, `setValidity`, and the `formAssociatedCallback` /
	 * `formDisabledCallback` / `formResetCallback` / `formStateRestoreCallback`
	 * lifecycle. Default: `false`.
	 */
	formAssociated?: boolean
}

/**
 * The context object passed to the v2.x factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
	host: HTMLElement & P
	/**
	 * The `ElementInternals` object, or `null` if `attachInternals()` failed
	 * (pre-upgrade / parser-ordering edge case). Use imperatively inside
	 * `watch()` — e.g. `watch('value', v => { internals?.setFormValue(v) })`.
	 * The optional chaining is the graceful-degradation guard.
	 */
	internals: ElementInternals | null
	expose: (props: Initializers<P>) => void
	watch: WatchHelper<P>
	on: OnHelper<P>
	pass: PassHelper<P>
	provideContexts: ProvideContextsHelper<P>
	requestContext: RequestContextHelper
	onFormAssociated: OnFormAssociatedHelper
	onFormDisabled: OnFormDisabledHelper
	onFormReset: OnFormResetHelper
	onFormStateRestore: OnFormStateRestoreHelper
}

/* === Exported Functions === */

/**
 * Define and register a reactive custom element using the v2.x factory form.
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
 * @param {ComponentOptions} [options] - Static class-level configuration (e.g. `{ formAssociated: true }`)
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
	options?: ComponentOptions,
): CustomElementConstructor | undefined {
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)
	const formAssociated = options?.formAssociated ?? false
	class Truc extends HTMLElement {
		static formAssociated = formAssociated

		#initialized = false
		#setup: FactoryResult = []
		#cleanup: MaybeCleanup
		#internals: ElementInternals | null = null
		#internalsAccessed = false

		constructor() {
			super()
			try {
				this.#internals = this.attachInternals()
			} catch {
				// attachInternals() throws NotSupportedError for pre-upgrade
				// instances or parser-ordering edge cases. The component
				// degrades gracefully — internals is null, a DEV_MODE warning
				// fires on first access.
				this.#internals = null
			}
		}

		/**
		 * Native callback when the custom element is first connected to the document
		 */
		connectedCallback() {
			const runSetup = () => {
				this.#cleanup = createScope(
					() => {
						activateResult(this.#setup)
					},
					{
						root: true,
					},
				)
			}

			if (this.#initialized) {
				// Re-connect: dispose the previous activation's scope (event listeners,
				// pass() slot restores, each() per-element scopes, provideContexts
				// listeners) before re-activating #setup in a fresh root scope.
				// Without this, every reparent/reslot cycle accumulates effects and
				// listeners — the prior cleanup was overwritten without running.
				if (isFunction(this.#cleanup)) this.#cleanup()
				runSetup()
			} else {
				const instance = this
				const host = this as unknown as HTMLElement & P
				const [elementQueries, resolveDependencies] = makeElementQueries(host)
				const formHelpers = makeFormHelpers(host)
				const context: FactoryContext<P> = {
					expose: this.#initSignals.bind(this),
					host,
					...elementQueries,
					...formHelpers,
					get internals() {
						if (
							DEV_MODE &&
							instance.#internals === null &&
							!instance.#internalsAccessed
						) {
							instance.#internalsAccessed = true
							console.warn(
								`internals is null — attachInternals() failed in ${elementName(host)}. The component works but cannot participate in form association, custom states, or ARIA reflection.`,
							)
						}
						return instance.#internals
					},
					watch: makeWatch(host),
					on: makeOn(host),
					pass: makePass(host),
					provideContexts: makeProvideContexts(host),
					requestContext: makeRequestContext(host),
				}

				const result = factory(context)
				if (result) this.#setup = result
				this.#initialized = true
				if (!this.#setup.length) return
				resolveDependencies(runSetup)
			}
		}

		/**
		 * Native callback when the custom element is disconnected from the document
		 */
		disconnectedCallback() {
			if (isFunction(this.#cleanup)) this.#cleanup()
		}

		/* === Form-associated custom element lifecycle callbacks === */
		//
		// The browser looks for these methods on the class. They delegate to
		// handlers registered via the `onForm*()` factory helpers. The handlers
		// activate after dependency resolution, so `formAssociatedCallback` may
		// fire before any handler is registered — the `form` field in
		// `FormHandlers` caches the value for late replay.

		formAssociatedCallback(form: HTMLFormElement | null) {
			const handlers = getFormHandlers(this)
			handlers.form = form
			handlers.associated?.(form)
		}

		formDisabledCallback(disabled: boolean) {
			getFormHandlers(this).disabled?.(disabled)
		}

		formResetCallback() {
			getFormHandlers(this).reset?.()
		}

		formStateRestoreCallback(state: FormState, mode: string) {
			getFormHandlers(this).stateRestore?.(state, mode)
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
				if (initializer == null) continue
				// Reject reserved property names that the type-level ReservedWords
				// exclusion can't catch at runtime (e.g. asJSON-parsed keys or
				// Record<string, …> casts). This check must run BEFORE the
				// `prop in this` guard below: every ReservedWord is an inherited
				// own-property of Object (constructor, __proto__, toString, …), so
				// `prop in this` is always true for them and would silently skip
				// them instead of throwing a named, actionable error.
				if (isReservedWord(prop))
					throw new InvalidPropertyNameError(
						this.localName,
						prop,
						'reserved word or Object builtin — cannot be used as a reactive property',
					)
				// Skip properties already set on the host (explicit DOM value wins).
				if (prop in this) continue
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
	type ComponentOptions,
	defineComponent,
	type FactoryContext,
	type Initializers,
	type MaybeSignal,
}
