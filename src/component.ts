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
import { InvalidComponentNameError, InvalidPropertyNameError } from './errors'
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
	type EffectDescriptor,
	type FactoryResult,
	type Falsy,
	forEachUnseen,
	makePass,
	makeWatch,
	type PassHelper,
	type WatchHelper,
} from './helpers/reactive'
import {
	getSignals,
	internalsHosts,
	internalsMap,
	retainedInitializers,
	withCollector,
} from './internal'
import {
	type ComponentProps,
	isMethodProducer,
	isParser,
	isReservedWord,
	type MethodProducer,
	type Parser,
} from './types'
import { elementName, isSlotDescriptor } from './util'

/* === Types === */

/**
 * Any value that `#setAccessor` can turn into a signal:
 * - `T` — wrapped in `createState()`
 * - `Signal<T>` — used directly
 * - `MemoCallback<T>` — wrapped in `deriveCell()`
 * - `TaskCallback<T>` — wrapped in `createTask()`
 * - `SlotDescriptor<T>` (`{ get, set? }`) — used directly as the Slot's backing
 *   signal, mirroring the mediated form `pass()` accepts. Distinguished from `T`
 *   by `isSlotDescriptor()`: a plain object with a `get` function and no `Signal`
 *   brand (`Symbol.toStringTag`). Use this form when the property needs both a
 *   computed read and a validated write — e.g.
 *   `expose({ value: { get: () => tokens.get().join(', '), set: v => tokens.set(parse(v)) } })`
 *   replaces a pair of `watch()` calls kept in sync by hand.
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
 * - A **static value** or **`Signal`** — used directly as the initial signal value.
 * - A **`Parser`** (branded with `asParser()`) — called with the attribute value string
 *   at connect time.
 * - A **`MethodProducer`** (branded with `defineMethod()`) — assigned directly as the property
 *   value; the function IS the method. Per-instance state lives in factory scope.
 * - A **`SlotDescriptor`** (`{ get, set? }`) — used directly as the property's backing
 *   Slot, mirroring the mediated form `pass()` accepts. Listed explicitly (not left to
 *   structurally match `Signal<P[K]>`) so an object literal with `set` type-checks without
 *   excess-property errors.
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
 * The host shape of the `formAssociated()` value variant: additionally carries
 * the managed `defaultValue` reset-baseline property, mirroring
 * `<input>.defaultValue`. The getter re-parses the `value` content attribute
 * through the same retained `Parser` as the live prop, so in practice it yields
 * the component's own `value` type — declared as `string | number` because the
 * parserless fallback path yields the raw attribute string. Setting it moves
 * the baseline for the next form reset; it never changes the live `value`.
 *
 * @since 2.5.1
 */
interface FormAssociatedValueElement extends FormAssociatedElement {
	defaultValue: string | number
}

/**
 * The host shape of the `formAssociatedCheckbox()` variant: additionally
 * carries the managed `defaultChecked` reset-baseline property, mirroring
 * `<input>.defaultChecked`. It reflects the `checked` attribute's presence.
 * Setting it moves the baseline for the next form reset; it never changes the
 * live `checked`.
 *
 * @since 2.5.1
 */
interface FormAssociatedCheckboxElement extends FormAssociatedElement {
	defaultChecked: boolean
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
	 * (pre-upgrade / parser-ordering edge case). Use it inside `watch()` for
	 * typed validity flags — e.g. `watch('value', v => internals?.setValidity({ rangeOverflow: v > max }, msg))` —
	 * or with `bindState()` for custom `:state()` pseudo-classes — e.g.
	 * `watch(overflowEnd, bindState(internals, 'overflow-end'))`.
	 * Form value sync (`setFormValue`) is managed automatically; do not call
	 * `internals?.setFormValue(v)` from a `watch('value', …)`.
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
 * with `host` typed as `HostElement & P` (`FormAssociatedValueElement` for
 * `formAssociated()`, `FormAssociatedCheckboxElement` for
 * `formAssociatedCheckbox()`) and `watch`/`on`/`pass` accepting the managed
 * `disabled`, `validationMessage`, and `validity` reactive props in addition
 * to `P`.
 *
 * `expose` stays typed over `Initializers<P>`, not the widened
 * `P & { disabled: boolean; validationMessage: string; validity: ValidityState }`,
 * so `expose({ disabled: … })` / `expose({ validationMessage: … })` /
 * `expose({ validity: … })` are type errors. All three are managed by the
 * library; `expose()` throws `InvalidPropertyNameError` for them at runtime.
 * The same holds for the variant's reset-baseline member (`defaultValue`/
 * `defaultChecked`), which lives on the host element interface, not in `P`.
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

/* === Exported Functions === */

/**
 * The ElementInternals declaration community protocol's registry — a
 * page-global `WeakMap` from elements to their `ElementInternals`, created
 * lazily via `??=` so it is idempotent in the (rare) presence of another
 * library that already created it. Tooling-only: it makes every Le Truc
 * component's internals visible to axe-core ≥ 4.13 with zero author opt-in
 * (ADR 0026 §3). The protocol explicitly rejects public accessors, so this
 * is deliberately not exposed as a host property, and it is a stopgap by
 * design — removable without API impact once a native introspection API
 * ships (whatwg/html#11040, w3c/aria #2663).
 */
const elementInternalsRegistry = (): WeakMap<Element, ElementInternals> => {
	const g = globalThis as {
		_elementInternals?: WeakMap<Element, ElementInternals>
	}
	g._elementInternals ??= new WeakMap()
	return g._elementInternals
}

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
 * @param {ComponentExtension[]} [extensions] - Dependency-injected features, e.g. `[formAssociated()]`, `[formAssociatedCheckbox()]`, `[observedAttributes([...])]`. Bundled extensions tree-shake away unless imported and used. `formAssociated()`/`formAssociatedCheckbox()`, if present, must be first — that widens the factory's context type to `FormFactoryContext`.
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
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
	// Deliberate, narrow exception to the "component.ts never imports a
	// concrete feature module" invariant (ADR 0019): debug() is not
	// opt-in — instrumenting a component must require no source change, so
	// defineComponent() itself appends it whenever DEV_MODE is true,
	// regardless of what the caller passed. See ADR 0022.
	const exts: readonly ComponentExtension[] =
		process.env.DEV_MODE === 'true'
			? [...(extensions ?? []), debug()]
			: (extensions ?? [])
	const merged = mergeExtensions(name, exts)
	class Truc extends HTMLElement {
		// Concrete boolean default so `Truc.formAssociated` always reads as a
		// real boolean. formAssociated() overrides it to `true` via the
		// staticProps merge below, before customElements.define.
		static formAssociated = false
		static observedAttributes = merged.observedAttributes

		#initialized = false
		#setup: FactoryResult = []
		#cleanup: MaybeCleanup
		#internalsAccessed = false

		constructor() {
			super()
			try {
				const internals = this.attachInternals()
				internalsMap.set(this, internals)
				// Reverse lookup for bindAria()'s stale-attribute rule (ADR 0026
				// §1): ElementInternals carries no host reference, so the helper
				// reaches the element whose shadowing attribute it must remove
				// through this map. Library-private (src/internal.ts).
				internalsHosts.set(internals, this)
				// ElementInternals declaration registry (ADR 0026 §3). One
				// WeakMap entry per instance, unconditional — no DEV_MODE gate,
				// audits run against production builds — and no disconnect-time
				// cleanup to write: attachInternals() runs here, in the
				// constructor the upgrade algorithm invokes exactly once per
				// instance.
				elementInternalsRegistry().set(this, internals)
			} catch {
				// In practice this catches environments with no
				// `ElementInternals` at all — a TypeError from
				// `this.attachInternals` being undefined (Safari <16.4,
				// Firefox <93, non-DOM test environments), not a lifecycle
				// timing problem. The upgrade algorithm sets the custom
				// element state to "precustomized" immediately before invoking
				// this constructor precisely so the call here is legal, and
				// the spec's three NotSupportedError conditions (non-null `is`
				// value, `disabledFeatures = ['internals']`, a second call)
				// are all unreachable for an autonomous element with a single
				// constructor call site. Either way the component degrades
				// gracefully: internals is null, and a DEV_MODE warning fires
				// on first access.
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
				// Re-connect: dispose the previous scope (event listeners, pass()
				// slot restores, each() per-element scopes, provideContexts
				// listeners) before re-activating #setup in a fresh root scope.
				// Otherwise every reparent/reslot cycle leaks effects and listeners.
				if (isFunction(this.#cleanup)) this.#cleanup()
				runSetup()
			} else {
				const instance = this
				const host = this as unknown as HTMLElement & P
				const [elementQueries, resolveDependencies] = makeElementQueries(host)
				// Structurally just FactoryContext<P> here; the first overload
				// above widens the public factory type to FormFactoryContext<P>
				// when `formAssociated()` leads the extensions array. The extra
				// host members it promises (form, name, labels, …) are installed
				// on the prototype by that extension's installOnPrototype before
				// any instance connects, so the promise holds despite the
				// narrower type used internally.
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

				// watch()/on()/pass()/each()/provideContexts() already pushed their
				// descriptors into this collector when called, so an old-style
				// `return [...]` is redundant for those. But the return value is
				// still reconciled: `FactoryResult` allows authoring a raw
				// `EffectDescriptor` by hand, bypassing every helper, and such a
				// descriptor is never pushed anywhere — `return` is the only path
				// that picks it up. `forEachUnseen` skips anything already in the
				// collector, so nothing activates twice. See ADR 0018.
				const collector: EffectDescriptor[] = []
				const result = withCollector(collector, () => factory(context))
				this.#setup = collector
				if (result) {
					const seen = new Set(collector)
					forEachUnseen(result, seen, d => this.#setup.push(d))
				}

				// Give every extension a chance to register extra effects (e.g.
				// formAssociated()'s managed value-sync) in the same
				// deferred-activation pipeline as author effects, in array order.
				const internals = internalsMap.get(this) ?? null
				for (const ext of exts) {
					const extra = ext.onConnect?.(this, internals)
					if (extra) {
						const seen = new Set(this.#setup as EffectDescriptor[])
						forEachUnseen(extra, seen, d => this.#setup.push(d))
					}
				}

				this.#initialized = true
				if (!this.#setup.length) return
				resolveDependencies(runSetup)
			}
		}

		/**
		 * Native callback when an observed attribute changes. Only actually
		 * invoked by the browser for attributes named in `static
		 * observedAttributes` (the merged union of every extension's
		 * `observedAttributes`) — dispatches to each extension in array order.
		 */
		attributeChangedCallback(
			attrName: string,
			oldValue: string | null,
			newValue: string | null,
		) {
			for (const ext of exts)
				ext.onAttributeChanged?.(this, attrName, oldValue, newValue)
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
				if (initializer == null) continue
				// Reject reserved names the type-level ReservedWords exclusion
				// can't catch at runtime (e.g. asJSON-parsed keys). Must run
				// before the `prop in this` guard below: every ReservedWord is
				// an inherited own-property of Object (constructor, __proto__,
				// toString, …), so that guard would otherwise silently skip them.
				if (isReservedWord(prop))
					throw new InvalidPropertyNameError(
						this.localName,
						prop,
						'reserved word or Object builtin — cannot be used as a reactive property',
					)
				// Reject names reserved by an extension (e.g. form, name,
				// labels, validity reserved by formAssociated()). These are
				// prototype-defined, so `prop in this` would otherwise silently
				// skip the colliding initializer. `value` is the deliberate
				// exception on form-associated components.
				if (merged.reservedMembers.has(prop)) {
					let reason = 'is a member reserved by an extension'
					if (process.env.DEV_MODE === 'true')
						reason += ` ('${merged.reservedMemberOwners.get(prop)}') — it is managed automatically and cannot be set via expose()`
					throw new InvalidPropertyNameError(this.localName, prop, reason)
				}
				// Skip properties already set on the host (explicit DOM value wins).
				if (prop in this) continue
				// Retain every initializer, keyed by prop name, before
				// createReactiveProperty consumes it. Extensions read these
				// back out (formAssociated()'s formResetCallback re-runs the
				// retained `value`; observedAttributes() re-runs a retained
				// Parser when its attribute mutates post-connect).
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
		 * Create or replace the Slot-backed property accessor for a reactive property.
		 * Mutable signals and `{ get, set? }` descriptors are wrapped in a Slot so
		 * their backing signal can be swapped later (e.g. by `pass()`).
		 *
		 * @since 0.15.0
		 * @param {K} key - Reactive property name
		 * @param {MaybeSignal<P[K]>} value - Static value, signal, computed callback, or `{ get, set? }` descriptor
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

	// Static class properties (e.g. formAssociated() contributing `static
	// formAssociated = true`) are installed before customElements.define, since
	// the browser reads them once at definition time.
	Object.assign(Truc, merged.staticProps)

	// Let each extension install its own prototype members (e.g.
	// formAssociated()'s native-parity host contract and managed form
	// lifecycle callbacks). Doing this unconditionally for every component
	// would shadow same-named reactive props, so it stays opt-in per
	// extension instead of baked into the core class body.
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
