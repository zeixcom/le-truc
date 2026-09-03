import {
	createCell,
	createScope,
	createSlot,
	deriveCell,
	isFunction,
	isMutableSignal,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type MemoCallback,
	type MutableCell,
	type Signal,
	type SlotDescriptor,
	type TaskCallback,
} from '@zeix/cause-effect'
import {
	InvalidComponentNameError,
	InvalidPropertyNameError,
	reportConnectFailure,
	reportEffectFailure,
} from './errors'
import { type ComponentExtension, mergeExtensions } from './extension'
import { debug } from './extensions/debug'
import type {
	FormAssociatedCheckboxExtension,
	FormAssociatedExtension,
} from './extensions/form'
import {
	makeProvideContexts,
	makeRequestContext,
	type ProvideContextsHelper,
	type RequestContextHelper,
} from './helpers/context'
import { type ElementQueries, makeElementQueries } from './helpers/dom'
import { makeOn, type OnHelper } from './helpers/events'
import {
	activateResult,
	type FactoryResult,
	type Falsy,
	forEachUnseen,
	makePass,
	makeWatch,
	type PassHelper,
	type WatchHelper,
} from './helpers/reactive'
import {
	describeDescriptor,
	getSignals,
	internalsHosts,
	internalsMap,
	isUsableInternals,
	retainedInitializers,
	withCollector,
} from './internal'
import {
	type ComponentProps,
	type EffectDescriptor,
	isMethodProducer,
	isParser,
	isReservedWord,
	type MethodProducer,
	type Parser,
} from './types'
import { elementName, isSlotDescriptor } from './util'

/* === Types === */

/**
 * Any value that `#setAccessor` can turn into a signal.
 *
 * - `T` — wrapped in `createState()`.
 * - `Signal<T>` — used directly.
 * - `MemoCallback<T>` — wrapped in `deriveCell()`.
 * - `TaskCallback<T>` — wrapped in `createTask()`.
 * - `SlotDescriptor<T>` (`{ get, set? }`) — used directly as the Slot's backing
 *   signal. Use this form when the property needs both a computed read and a
 *   validated write, e.g.
 *   `expose({ value: { get: () => tokens.get().join(', '), set: v => tokens.set(parse(v)) } })`.
 */
type MaybeSignal<T extends {}> =
	| T
	| Signal<T>
	| MemoCallback<T>
	| TaskCallback<T>
	| SlotDescriptor<T>

/**
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A static value or `Signal` — used directly as the initial signal value.
 * - A `Parser` (branded with `asParser()`) — called with the attribute value string at connect time.
 * - A `MethodProducer` (branded with `defineMethod()`) — assigned directly as the property value.
 * - A `SlotDescriptor` (`{ get, set? }`) — used directly as the property's backing Slot.
 */
type Initializers<P extends ComponentProps> = {
	[K in keyof P]?:
		| P[K]
		| Signal<P[K]>
		| Parser<P[K]>
		| MethodProducer
		| SlotDescriptor<P[K]>
}

/**
 * The native form-control members the generated class defines on the host when `formAssociated: true`.
 *
 * Authors use this interface in the tag-name map: `'my-input': FormAssociatedElement & MyProps`.
 * `value` is not part of this interface; it belongs in the author's props type.
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
 * The host shape of the `formAssociated()` value variant, carrying the managed `defaultValue` reset baseline.
 *
 * Mirrors `<input>.defaultValue`. Setting it moves the baseline for the
 * next form reset; it never changes the live `value`.
 *
 * @since 2.5.1
 */
interface FormAssociatedValueElement extends FormAssociatedElement {
	defaultValue: string | number
}

/**
 * The host shape of the `formAssociatedCheckbox()` variant, carrying the managed `defaultChecked` reset baseline.
 *
 * Mirrors `<input>.defaultChecked`. Setting it moves the baseline for the
 * next form reset; it never changes the live `checked`.
 *
 * @since 2.5.1
 */
interface FormAssociatedCheckboxElement extends FormAssociatedElement {
	defaultChecked: boolean
}

/**
 * The context object passed to the factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
	host: HTMLElement & P
	/**
	 * The `ElementInternals` object, or `null` if `attachInternals()` failed.
	 *
	 * Use it inside `watch()` for validity flags or with `bindState()` for
	 * custom `:state()` pseudo-classes. The library manages form value sync
	 * (`setFormValue`) automatically; do not call it from a `watch('value', …)`.
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
 * The factory context for form-associated components.
 *
 * Extends `FactoryContext` with `host` typed as `HostElement & P` and with
 * `watch`/`on`/`pass` accepting the managed `disabled`, `validationMessage`,
 * and `validity` reactive props in addition to `P`. `expose()` stays typed
 * over `Initializers<P>`: setting `disabled`, `validationMessage`, or
 * `validity` through `expose()` is a type error, since the library manages
 * them and throws `InvalidPropertyNameError` at runtime for any attempt.
 *
 * @since 2.6
 */
type FormFactoryContext<
	P extends ComponentProps,
	HostElement extends FormAssociatedElement = FormAssociatedValueElement,
> = Omit<
	FactoryContext<
		P & {
			disabled: boolean
			validationMessage: string
			validity: ValidityState
		}
	>,
	'host' | 'expose'
> & {
	host: HostElement & P
	expose: (props: Initializers<P>) => void
}

/* === Internal Functions === */

/** Whether the unusable-internals warning has already fired (per page, DEV_MODE only). */
let unusableInternalsWarned = false

/**
 * Page-global registry for the ElementInternals declaration community protocol.
 *
 * Not exposed as a host property. See ADR 0026 §3.
 */
const elementInternalsRegistry = (): WeakMap<Element, ElementInternals> => {
	const g = globalThis as {
		_elementInternals?: WeakMap<Element, ElementInternals>
	}
	g._elementInternals ??= new WeakMap()
	return g._elementInternals
}

/* === Exported Functions === */

/**
 * Defines and registers a reactive custom element.
 *
 * The factory receives a `FactoryContext` at connect time: query helpers
 * (`first`, `all`), the `host` element, and `expose()` for declaring
 * reactive properties. It returns effect descriptors created by helpers
 * like `watch()`, `on()`, `pass()`, `provideContexts()`, and
 * `requestContext()`. Effects activate after dependency resolution, so
 * child custom elements are defined before any descriptor runs.
 *
 * @since 2.0
 * @param name - Custom element name; must contain a hyphen and start with a lowercase letter.
 * @param factory - Function that queries elements, calls `expose()`, and returns effect descriptors.
 * @param extensions - Dependency-injected features, e.g. `[formAssociated()]`, `[observedAttributes([...])]`. If present, `formAssociated()`/`formAssociatedCheckbox()` must be first.
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name.
 */
function defineComponent<P extends ComponentProps & { value: string | number }>(
	name: string,
	factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void,
	extensions: readonly [FormAssociatedExtension, ...ComponentExtension[]],
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps & { checked: boolean }>(
	name: string,
	factory: (
		context: FormFactoryContext<P, FormAssociatedCheckboxElement>,
	) => FactoryResult | Falsy | void,
	extensions: readonly [
		FormAssociatedCheckboxExtension,
		...ComponentExtension[],
	],
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
	extensions?: readonly ComponentExtension[],
): CustomElementConstructor | undefined
function defineComponent<P extends ComponentProps>(
	name: string,
	factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
	extensions?: readonly ComponentExtension[],
): CustomElementConstructor | undefined {
	if (!name.includes('-') || !name.match(/^[a-z][a-z0-9-]*$/))
		throw new InvalidComponentNameError(name)
	// Exception to the "never imports a concrete feature module" invariant
	// (ADR 0019): debug() is not opt-in. See ADR 0022.
	const exts: readonly ComponentExtension[] =
		process.env.DEV_MODE === 'true'
			? [...(extensions ?? []), debug()]
			: (extensions ?? [])
	const merged = mergeExtensions(name, exts)
	class Truc extends HTMLElement {
		// formAssociated() overrides this to `true` via the staticProps merge
		// below, before customElements.define.
		static formAssociated = false
		static observedAttributes = merged.observedAttributes

		#initialized = false
		#setup: FactoryResult = []
		#cleanup: MaybeCleanup
		#internalsAccessed = false
		/** Set when the factory or an extension threw — the component never enhances. */
		#connectFailed = false
		/** Descriptors already reported as failing, so a reslot cycle does not re-report. */
		#reportedFailures: WeakSet<EffectDescriptor> | undefined

		constructor() {
			super()
			try {
				const internals = this.attachInternals()
				// A half-implemented ElementInternals succeeds and so defeats
				// the catch below, but is worse than none — it fails later,
				// deep inside the form machinery. Treat it as none (LT-150).
				if (
					!isUsableInternals(
						internals,
						(this.constructor as typeof Truc).formAssociated,
					)
				) {
					internalsMap.set(this, null)
					if (process.env.DEV_MODE === 'true' && !unusableInternalsWarned) {
						unusableInternalsWarned = true
						console.warn(
							`attachInternals() returned an incomplete ElementInternals in ${elementName(this)}. This environment's implementation is missing validity, validationMessage, setFormValue, or setValidity. Treating it as no internals: form association, custom states, and ARIA reflection are unavailable.`,
						)
					}
					return
				}
				internalsMap.set(this, internals)
				// Reverse lookup for bindAria()'s stale-attribute rule (ADR 0026 §1).
				internalsHosts.set(internals, this)
				// ElementInternals declaration registry (ADR 0026 §3).
				elementInternalsRegistry().set(this, internals)
			} catch {
				// No ElementInternals support (Safari <16.4, Firefox <93) or a
				// non-DOM test environment. Degrades gracefully: internals is
				// null, and a DEV_MODE warning fires on first access.
				internalsMap.set(this, null)
			}
		}

		/** Runs when the custom element is first connected to the document. */
		connectedCallback() {
			// Activation is contained per descriptor (ADR 0028 sub-design 3):
			// a throwing effect costs only itself, and every sibling still
			// activates. Reported once per descriptor per instance, so an
			// element that reslots repeatedly does not flood the console with
			// the same failure.
			const onDescriptorError = (
				error: unknown,
				descriptor: EffectDescriptor,
			) => {
				const reported = (this.#reportedFailures ??= new WeakSet())
				if (reported.has(descriptor)) return
				reported.add(descriptor)
				reportEffectFailure(this, describeDescriptor(descriptor), error)
			}

			const runSetup = () => {
				this.#cleanup = createScope(
					() => {
						activateResult(this.#setup, onDescriptorError)
					},
					{
						root: true,
					},
				)
			}

			// A component whose factory or extension threw never enhances, and
			// a reconnect re-runs neither — so it stays inert and silent
			// rather than re-reporting a failure the console already carries.
			if (this.#connectFailed) return

			if (this.#initialized) {
				// Dispose the previous scope before re-activating #setup, or
				// every reparent/reslot cycle leaks effects and listeners.
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
							process.env.DEV_MODE === 'true' &&
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

				// The factory's return value is reconciled too, so a raw
				// EffectDescriptor authored by hand (bypassing every helper)
				// still activates. forEachUnseen skips anything already
				// collected, so nothing activates twice. See ADR 0018.
				const collector: EffectDescriptor[] = []

				// The factory phase is contained whole-component: a factory is
				// one indivisible consumer function and cannot be resumed past
				// a throw (ADR 0028 sub-design 3). Nothing has activated yet,
				// so there is no scope to dispose — dropping the partial
				// descriptor list is the whole teardown.
				const failConnect = (phase: string, error: unknown) => {
					this.#setup = []
					this.#initialized = true
					this.#connectFailed = true
					reportConnectFailure(this, phase, error)
				}

				try {
					const result = withCollector(collector, () => factory(context))
					this.#setup = collector
					if (result) {
						const seen = new Set(collector)
						forEachUnseen(result, seen, d => this.#setup.push(d))
					}
				} catch (error) {
					failConnect('the component factory', error)
					return
				}

				// Let each extension register extra effects (e.g.
				// formAssociated()'s managed value-sync), in array order.
				// Its own try, so the diagnostic names the failing extension
				// rather than sending the reader to the factory.
				const internals = internalsMap.get(this) ?? null
				for (const ext of exts) {
					try {
						const extra = ext.onConnect?.(this, internals)
						if (extra) {
							const seen = new Set(this.#setup as EffectDescriptor[])
							forEachUnseen(extra, seen, d => this.#setup.push(d))
						}
					} catch (error) {
						failConnect(`the '${ext.name}' extension`, error)
						return
					}
				}

				this.#initialized = true
				if (!this.#setup.length) return
				resolveDependencies(runSetup)
			}
		}

		/** Runs when an observed attribute changes; dispatches to each extension in array order. */
		attributeChangedCallback(
			attrName: string,
			oldValue: string | null,
			newValue: string | null,
		) {
			for (const ext of exts)
				ext.onAttributeChanged?.(this, attrName, oldValue, newValue)
		}

		/** Runs when the custom element is disconnected from the document. */
		disconnectedCallback() {
			if (isFunction(this.#cleanup)) this.#cleanup()
		}

		/**
		 * Initializes signals for each property in the given initializers map.
		 *
		 * Dispatch order: Parser, then MethodProducer, then static value/Signal.
		 *
		 * @param instanceProps - Property initializers to process.
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
				// Every ReservedWord is an inherited own-property of Object, so
				// this must run before the `prop in this` guard below, or that
				// guard would silently skip them.
				if (isReservedWord(prop))
					throw new InvalidPropertyNameError(
						this.localName,
						prop,
						'reserved word or Object builtin — cannot be used as a reactive property',
					)
				// Extension-reserved names (e.g. form, name, labels, validity)
				// are prototype-defined, so `prop in this` would otherwise
				// silently skip the colliding initializer.
				if (merged.reservedMembers.has(prop)) {
					let reason = 'is a member reserved by an extension'
					if (process.env.DEV_MODE === 'true')
						reason += ` ('${merged.reservedMemberOwners.get(prop)}') — it is managed automatically and cannot be set via expose()`
					throw new InvalidPropertyNameError(this.localName, prop, reason)
				}
				// Skip properties already set on the host (explicit DOM value wins).
				if (prop in this) continue
				// Retain the initializer before createReactiveProperty consumes
				// it: formAssociated()'s formResetCallback re-runs a retained
				// `value`, and observedAttributes() re-runs a retained Parser
				// when its attribute mutates post-connect.
				let retained = retainedInitializers.get(this)
				if (!retained) {
					retained = {}
					retainedInitializers.set(this, retained)
				}
				retained[prop] = initializer
				createReactiveProperty(prop as keyof P & string, initializer)
			}
		}

		/**
		 * Creates or replaces the Slot-backed property accessor for a reactive property.
		 *
		 * Mutable signals and `{ get, set? }` descriptors are wrapped in a
		 * Slot so their backing signal can be swapped later, e.g. by `pass()`.
		 *
		 * @since 0.15.0
		 * @param key - Reactive property name.
		 * @param value - Static value, signal, computed callback, or `{ get, set? }` descriptor.
		 */
		#setAccessor<K extends keyof P>(key: K, value: MaybeSignal<P[K]>): void {
			const signal = isSignal(value)
				? value
				: isSlotDescriptor<P[K]>(value)
					? value
					: isFunction<P[K]>(value)
						? deriveCell(value)
						: (createCell(value) as MutableCell<P[K]>)
			const signals = getSignals(this)
			const k = key as string
			const prev = signals[k]
			if (isSlot(prev)) {
				prev.replace(signal)
			} else if (isMutableSignal(signal) || isSlotDescriptor<P[K]>(signal)) {
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

	// Static class properties are installed before customElements.define,
	// since the browser reads them once at definition time.
	Object.assign(Truc, merged.staticProps)

	// Prototype members are opt-in per extension, or they would shadow
	// same-named reactive props on every component.
	for (const ext of exts)
		ext.installOnPrototype?.(Truc.prototype as unknown as HTMLElement)

	customElements.define(name, Truc)
	return customElements.get(name)
}

export {
	defineComponent,
	type FactoryContext,
	type FormAssociatedCheckboxElement,
	type FormAssociatedElement,
	type FormAssociatedValueElement,
	type FormFactoryContext,
	type Initializers,
	type MaybeSignal,
}
