import {
	createComputed,
	createEffect,
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
	installFormAssociatedMembers,
	MANAGED_FORM_MEMBERS,
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
import { getSignals, initialValueInitializers, internalsMap } from './internal'
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
	 * When `true`, the generated class gets `static formAssociated = true`, the
	 * managed form-control behavior (value sync, reset, state restore, disabled,
	 * native-parity host contract). The browser treats the element as a
	 * form-associated custom element (FACE). Default: `false`.
	 */
	formAssociated?: boolean
}

/**
 * The native form-control members the generated class defines on the host when
 * `formAssociated: true`, delegating to `internals`. Authors use this interface
 * in the declarations the library cannot write for them, chiefly the tag-name
 * map: `'my-input': FormAssociatedElement & MyProps`.
 *
 * `value` is deliberately **not** part of this interface: it is component-exposed
 * (string for textbox, number for spinbutton) and belongs in the author's props
 * type.
 */
interface FormAssociatedElement extends HTMLElement {
	readonly form: HTMLFormElement | null
	name: string
	disabled: boolean
	readonly labels: NodeList
	readonly validity: ValidityState
	readonly validationMessage: string
	readonly willValidate: boolean
	checkValidity(): boolean
	reportValidity(): boolean
	setCustomValidity(message: string): void
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
	 * `watch()` for typed validity flags
	 * — e.g. `watch('value', v => { internals?.setValidity({ rangeOverflow: v > max }, msg) })` —
	 * or with `bindState()` for custom `:state()` pseudo-classes
	 * — e.g. `watch(overflowEnd, bindState(internals, 'overflow-end'))`.
	 * Note: form value sync (`setFormValue`) is managed automatically —
	 * do NOT call `internals?.setFormValue(v)` from a `watch('value', …)`.
	 * The optional chaining is the graceful-degradation guard.
	 */
	internals: ElementInternals | null
	expose: (props: Initializers<P>) => void
	watch: WatchHelper<P>
	on: OnHelper<P>
	pass: PassHelper<P>
	provideContexts: ProvideContextsHelper<P>
	requestContext: RequestContextHelper
}

/**
 * The factory context for form-associated components. Extends `FactoryContext`
 * with `host` typed as `FormAssociatedElement & P` (the native-parity members)
 * and `watch`/`on`/`pass` accepting the managed `disabled` reactive prop in
 * addition to the author's `P`.
 *
 * `expose` is deliberately typed over `Initializers<P>` (not the widened
 * `P & { disabled: boolean }`) so `expose({ disabled: … })` is a type error —
 * `disabled` is managed by the library and `expose()` throws
 * `InvalidPropertyNameError` for it at runtime.
 */
type FormFactoryContext<P extends ComponentProps> = Omit<
	FactoryContext<P & { disabled: boolean }>,
	'host' | 'expose'
> & {
	host: FormAssociatedElement & P
	expose: (props: Initializers<P>) => void
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
function defineComponent<P extends ComponentProps & { value: string | number }>(
	name: string,
	factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void,
	options: ComponentOptions & { formAssociated: true },
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
	options?: ComponentOptions,
): CustomElementConstructor | undefined
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
		#internalsAccessed = false

		constructor() {
			super()
			try {
				internalsMap.set(this, this.attachInternals())
			} catch {
				// attachInternals() throws NotSupportedError for pre-upgrade
				// instances or parser-ordering edge cases. The component
				// degrades gracefully — internals is null, a DEV_MODE warning
				// fires on first access.
				internalsMap.set(this, null)
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
				const context: FactoryContext<P> = {
					expose: this.#initSignals.bind(this),
					host,
					...elementQueries,
					get internals() {
						const internals = internalsMap.get(instance) ?? null
						if (
							DEV_MODE &&
							internals === null &&
							!instance.#internalsAccessed
						) {
							instance.#internalsAccessed = true
							console.warn(
								`internals is null — attachInternals() failed in ${elementName(host)}. The component works but cannot participate in form association, custom states, or ARIA reflection.`,
							)
						}
						return internals
					},
					watch: makeWatch(host),
					on: makeOn(host),
					pass: makePass(host),
					provideContexts: makeProvideContexts(host),
					requestContext: makeRequestContext(host),
				}

				const result = factory(context)
				if (result) this.#setup = result

				// Managed form-control behavior: register the library-internal
				// value-sync effect in the same deferred-activation pipeline as
				// author effects. A DEV_MODE warning fires if the factory completed
				// without exposing a reactive `value` (required by the convention).
				const internals = internalsMap.get(this)
				if (formAssociated && internals) {
					const hasValueSignal = 'value' in this && getSignals(this).value
					if (DEV_MODE && !hasValueSignal)
						console.warn(
							`form-associated component ${elementName(host)} did not expose a reactive 'value' property. The managed form-control convention requires a reactive 'value' for form value sync, reset, and state restore.`,
						)
					// Create the managed `disabled` reactive property (Slot-backed
					// so formDisabledCallback can write to it). The property
					// setter reflects to the `disabled` content attribute, giving
					// native FACE behavior for free (:disabled, barred from
					// validation/submission). formDisabledCallback writes the
					// effective state (including fieldset inheritance) into this.
					this.#createManagedDisabledProperty()
					this.#setup.push(this.#managedValueSyncDescriptor(internals))
				}

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

		/**
		 * Build the managed form-control value-sync effect descriptor. Returns an
		 * `EffectDescriptor` (a thunk) that activates after dependency resolution
		 * in the same pipeline as author effects. Watches `value` and calls
		 * `internals.setFormValue(String(value))`.
		 */
		#managedValueSyncDescriptor(
			internals: ElementInternals,
		): () => MaybeCleanup {
			const instance = this
			// Thunk — activated lazily inside the component scope, like author
			// effect descriptors. Reading `(instance as any).value` inside
			// createEffect registers the Slot-backed accessor as a dependency.
			return () =>
				createEffect(() => {
					const v = (instance as any).value
					internals.setFormValue(typeof v === 'string' ? v : String(v ?? ''))
				})
		}

		/**
		 * Create the managed `disabled` reactive property on this form-associated
		 * host. Slot-backed so `formDisabledCallback` can write the effective
		 * disabled state (including `<fieldset disabled>` inheritance). The
		 * property getter and setter go through the Slot (not the raw backing
		 * signal) so that `pass()` replacing the Slot's delegate stays
		 * consistent — `host.disabled`, `watch('disabled')`, and
		 * `formDisabledCallback` all read and write the same source of truth.
		 * The setter also reflects to the `disabled` content attribute so FACE
		 * gives native `:disabled` / barred-from-validation for free.
		 */
		#createManagedDisabledProperty(): void {
			const initial = this.hasAttribute('disabled')
			const slot = createSlot(createState(initial))
			const signals = getSignals(this)
			signals['disabled'] = slot
			const host = this as unknown as HTMLElement
			Object.defineProperty(this, 'disabled', {
				get: () => slot.get(),
				set: (v: boolean) => {
					slot.set(v)
					if (v) host.setAttribute('disabled', '')
					else host.removeAttribute('disabled')
				},
				enumerable: true,
				configurable: true,
			})
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
				// On form-associated components, reject managed member names
				// (form, name, labels, validity, validationMessage, willValidate,
				// checkValidity, reportValidity, setCustomValidity, disabled).
				// These are prototype-defined, so the `prop in this` guard below
				// would otherwise *silently skip* the colliding initializer — the
				// worst failure mode. `value` is the deliberate exception: the
				// component must expose it. This check runs before that guard.
				if (formAssociated && MANAGED_FORM_MEMBERS.has(prop))
					throw new InvalidPropertyNameError(
						this.localName,
						prop,
						'is a managed form-control member on form-associated components — use the native-parity host contract instead; expose `value` for the form value',
					)
				// Skip properties already set on the host (explicit DOM value wins).
				if (prop in this) continue
				// Retain the `value` initializer for managed formResetCallback
				// (native defaultValue-style reset). Captured verbatim before
				// createReactiveProperty consumes it.
				if (formAssociated && prop === 'value')
					initialValueInitializers.set(this, initializer)
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

	// Install the native-parity host contract and managed form lifecycle
	// callbacks on the prototype only for form-associated components. The
	// descriptors and reserved-name set are driven from one table in
	// helpers/form.ts — see installFormAssociatedMembers. Defining these
	// unconditionally would shadow same-named reactive props on non-form-
	// associated components (the `prop in this` guard would silently skip them).
	if (formAssociated) {
		installFormAssociatedMembers(Truc.prototype as unknown as HTMLElement)
	}

	customElements.define(name, Truc)
	return customElements.get(name)
}

export {
	type ComponentOptions,
	defineComponent,
	type FactoryContext,
	type FormAssociatedElement,
	type Initializers,
	type MaybeSignal,
}
