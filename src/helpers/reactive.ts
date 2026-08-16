import {
	type Cleanup,
	createEffect,
	createMemo,
	createScope,
	type DerivedList,
	deriveSignal,
	isComputed,
	isFunction,
	isRecord,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type MaybePromise,
	type MutableList,
	type MutableSignal,
	match,
	type Signal,
	type SingleMatchHandlers,
	type Slot,
	type SlotDescriptor,
	untrack,
} from '@zeix/cause-effect'
import { getDebugBindingTarget } from '../bindings'
import {
	InvalidCustomElementError,
	InvalidPassPropertyError,
	InvalidReactivesError,
	InvalidTemplateError,
} from '../errors'
import { debugFire, markIfDebugging } from '../extensions/debug'
import { getSignals, pushDescriptor, withCollector } from '../internal'
import type {
	ComponentProp,
	ComponentProps,
	EffectDescriptor,
	FactoryResult,
	Falsy,
} from '../types'
import { elementName, isCustomElement } from '../util'
import { bindFirst, type FirstElement } from './dom'

/**
 * Reactive-effect helpers exposed through `FactoryContext`: `watch`, `pass`,
 * `each`, and `reconcile`.
 *
 * A `Reactive<T, P>` source is one of three forms: a property name (reads
 * `host[name]` and tracks it as a signal dependency), a `Signal`, or a thunk
 * wrapped in `deriveSignal()`. `watch()` and `pass()` both resolve sources
 * through `toSignal()`.
 *
 * `pass()` accepts a read-only thunk, a mediated `{ get, set }` descriptor, a
 * bare property name, or a bare writable `Signal`. The last two forms hand
 * the child component unrestricted `.set()` on the parent's signal
 * (ADR-0012) and warn in DEV_MODE; prefer the thunk or the descriptor form.
 *
 * `watch()`, `pass()`, `each()`, and `reconcile()` push an `EffectDescriptor`
 * into the active ambient collector when called and do not require an
 * explicit `return` (ADR 0018). Explicit `return` is still supported.
 */

/* === Types === */

/**
 * A reactive value that drives a DOM update or a slot injection.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
 * - `() => T | Promise<T> | null | undefined` — a thunk wrapped in `deriveSignal`;
 *   all signals read inside are tracked in the pure phase. Returning `null` or
 *   `undefined` drives the `nil` path; an async thunk becomes a `Task` signal.
 */
type Reactive<T, P extends ComponentProps> =
	| keyof P
	| Signal<T & {}>
	| (() => T | Promise<T> | null | undefined)

/**
 * Map of child component property names to the reactive values `pass()` injects into them.
 *
 * `Q` is bound to `HTMLElement`, not `ComponentProps`, because native members
 * mixed into a target's element type (e.g. `form: HTMLFormElement | null`)
 * fail a `Record<string, {}>`-style constraint. `keyof Q & ComponentProp`
 * filters to the author-exposed reactive props instead.
 */
type PassedProps<P extends ComponentProps, Q extends HTMLElement> = {
	[K in keyof Q & ComponentProp]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>
}

/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from one or more `Reactive` sources. Only the
 * declared sources trigger re-runs; other reads inside the handler are not
 * tracked. Returns an `EffectDescriptor`.
 */
type WatchHelper<P extends ComponentProps> = {
	<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	<K extends keyof P & string>(
		source: K,
		handlers: SingleMatchHandlers<P[K]>,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	(
		source: Array<Reactive<NonNullable<unknown>, P>>,
		handler: (values: any[]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
}

/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed
 * signals. Supports a single element or a `Signal<Element[]>` target, with
 * per-element lifecycle for the latter.
 */
type PassHelper<P extends ComponentProps> = {
	<Q extends HTMLElement>(
		target: Q | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	<Q extends HTMLElement>(
		target: Signal<Q[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
}

/* === Internal Helpers === */

/**
 * Recursively activate a `FactoryResult` array of effect descriptors.
 *
 * Nested arrays are flattened; falsy values are skipped. Each truthy descriptor
 * is called immediately so its reactive effects register in the current scope.
 *
 * @since 2.0
 * @param {FactoryResult} result - Flat or nested array of effect descriptors to activate
 */
const activateResult = (result: FactoryResult): void => {
	for (const descriptor of result) {
		if (Array.isArray(descriptor)) activateResult(descriptor)
		else if (descriptor) descriptor()
	}
}

/**
 * Recursively flatten a `FactoryResult` (or a single descriptor, or a falsy
 * value), invoking `visit` for each descriptor not already present in `seen`
 * (checked by reference).
 *
 * Reconciles the legacy explicit-`return` form with descriptors already
 * pushed into the active collector by `watch()`/`on()`/`pass()`/`each()`
 * (ADR 0018). A descriptor from one of those helpers is pushed whether or
 * not it is also `return`ed, so it must only be visited once. A manually
 * constructed `EffectDescriptor` that bypasses every helper is never pushed,
 * so it is still visited here — the only path that picks it up.
 *
 * @since 2.3
 * @param {FactoryResult | EffectDescriptor | Falsy | void} result - Flat or nested array, single descriptor, falsy value, or nothing to reconcile
 * @param {ReadonlySet<EffectDescriptor>} seen - Descriptors already accounted for (by reference) — skipped
 * @param {(descriptor: EffectDescriptor) => void} visit - Called once per not-yet-seen descriptor, in encounter order
 */
const forEachUnseen = (
	result: FactoryResult | EffectDescriptor | Falsy | void,
	seen: ReadonlySet<EffectDescriptor>,
	visit: (descriptor: EffectDescriptor) => void,
): void => {
	if (Array.isArray(result)) {
		for (const item of result) forEachUnseen(item, seen, visit)
	} else if (typeof result === 'function' && !seen.has(result)) {
		visit(result)
	}
}

/**
 * Drive per-element scopes from a `Signal<E[]>` with element-identity keying.
 *
 * Entering elements get a scope created by `mount`; leaving elements get
 * exactly their own scope disposed. Surviving elements are untouched across
 * re-runs. All remaining scopes are disposed when the enclosing component
 * scope is disposed.
 *
 * Two details matter for correctness:
 * - Per-element scopes use `{ root: true }`. A plain `createScope` inside the
 *   effect would register its dispose on the effect, which runs all cleanups
 *   before every re-run — a wholesale rebuild instead of a keyed diff.
 * - The outer `createScope` wrapper registers on the component scope; its
 *   cleanup is what tears down still-live element scopes on disconnect.
 *
 * @since 2.2
 * @param {Signal<E[]>} memo - Signal of the current element collection
 * @param {(element: E) => MaybeCleanup} mount - Called once per entering element inside its scope; a returned cleanup registers on that scope
 */
const keyedScopes = <E extends object>(
	memo: Signal<E[]>,
	mount: (element: E) => MaybeCleanup,
): void => {
	const scopes = new Map<E, () => void>()
	createScope(() => {
		createEffect(() => {
			const current = memo.get()
			const currentSet = new Set(current)
			// Teardown before setup, so one-mutation replacements work.
			for (const [el, dispose] of Array.from(scopes)) {
				if (!currentSet.has(el)) {
					dispose()
					scopes.delete(el)
				}
			}
			for (const el of current) {
				if (scopes.has(el)) continue
				const dispose = createScope(() => mount(el), { root: true })
				scopes.set(el, dispose)
			}
		})
		return () => {
			for (const dispose of scopes.values()) dispose()
			scopes.clear()
		}
	})
}

/**
 * Resolve a `Reactive` value to a Signal usable by `match`.
 *
 * - String: looks up the signal in the component's signal map, or falls back
 *   to a computed reading `host[name]` (covers properties added via `Object.defineProperty`).
 * - Thunk `() => T | Promise<T> | null | undefined`: wrapped in `deriveSignal`.
 *   An async thunk becomes a Task signal.
 * - Signal: used directly.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @param {Reactive<T, P> | { get: () => T; set?: (value: T) => void }} source - Property name string, signal, thunk, or descriptor to resolve
 * @returns {Signal<T>} Resolved signal ready for use with `match()`
 */
const toSignal = <T extends {}, P extends ComponentProps>(
	host: HTMLElement & P,
	source: Reactive<T, P> | SlotDescriptor<T>,
): Signal<T> | SlotDescriptor<T> => {
	if (isFunction<T>(source)) return deriveSignal(source)
	if (typeof source === 'string') {
		const sig = getSignals(host)[source]
		if (sig) return sig as Signal<T>
		return createMemo(() => (host as any)[source])
	}
	if (
		source &&
		typeof source === 'object' &&
		'get' in source &&
		!(Symbol.toStringTag in source)
	) {
		return source as SlotDescriptor<T>
	}
	return source as Signal<T>
}

/* === Exported Functions === */

/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly declared
 * signal sources. Only the declared source signals trigger re-runs — other reads
 * inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {WatchHelper<P>} Bound `watch` function for the given host
 */
const makeWatch = <P extends ComponentProps>(
	host: HTMLElement & P,
): WatchHelper<P> => {
	function watch<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch<K extends keyof P & string>(
		source: K,
		handlers: SingleMatchHandlers<P[K]>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: Signal<T>,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	function watch(
		source: Array<Reactive<NonNullable<unknown>, P>>,
		handler: (values: any[]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch(
		source:
			| Reactive<NonNullable<unknown>, P>
			| Array<Reactive<NonNullable<unknown>, P>>,
		handlerOrHandlers:
			| ((value: any) => MaybePromise<MaybeCleanup>)
			| SingleMatchHandlers<any>,
	): EffectDescriptor {
		const descriptor: EffectDescriptor = () => {
			if (Array.isArray(source)) {
				const signals = source.map(s => toSignal(host, s))
				const handler = handlerOrHandlers as (
					values: any[],
				) => MaybePromise<MaybeCleanup>
				if (process.env.DEV_MODE === 'true') {
					// Additive companion effect (ADR 0022) — never wraps or
					// replaces the author's own effect. `handler` isn't a
					// bind*-produced closure for an array source, so it never
					// resolves to an element — host-level pulse only.
					createEffect(() =>
						match(signals, {
							ok: values =>
								untrack(() => debugFire(host, 'watch', undefined, values)),
						}),
					)
				}
				return createEffect(() =>
					match(signals, { ok: values => untrack(() => handler(values)) }),
				)
			}
			const signal = toSignal(host, source)
			if (typeof handlerOrHandlers === 'function') {
				if (process.env.DEV_MODE === 'true') {
					createEffect(() =>
						match(signal, {
							ok: value =>
								untrack(() => {
									const element = getDebugBindingTarget(handlerOrHandlers)
									debugFire(host, 'watch', element, value)
								}),
						}),
					)
				}
				return createEffect(() =>
					match(signal, {
						ok: value => untrack(() => handlerOrHandlers(value)),
					}),
				)
			}
			if (process.env.DEV_MODE === 'true') {
				createEffect(() =>
					match(signal, {
						ok: value =>
							untrack(() => {
								const element = getDebugBindingTarget(handlerOrHandlers)
								debugFire(host, 'watch', element, value)
							}),
					}),
				)
			}
			return createEffect(() => match(signal, handlerOrHandlers))
		}
		pushDescriptor(host, 'watch', descriptor)
		return descriptor
	}
	return watch
}

/**
 * Create a `pass` helper bound to a specific component host.
 *
 * Swaps the target's Slot-backed signals for the given values and restores
 * the originals on disconnect. A `Signal<Element[]>` target swaps and restores
 * signals per element as it enters and leaves the collection.
 *
 * ```ts
 * // deprecated — child can write freely
 * pass(child, { value: parentSignal })
 * // preferred — child writes are mediated by the parent
 * pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
 * ```
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {PassHelper<P>} Bound `pass` function for the given host
 */
const makePass = <P extends ComponentProps>(
	host: HTMLElement & P,
): PassHelper<P> => {
	/**
	 * Perform the slot-swap for a single target element.
	 * Returns a cleanup that restores all original slot signals.
	 */
	const swapSlots = <Q extends HTMLElement>(
		target: Q,
		props: PassedProps<P, Q>,
	): (() => void) | undefined =>
		createScope(() => {
			if (!isCustomElement(target))
				throw new InvalidCustomElementError(
					target,
					`pass from ${elementName(host)}`,
				)
			if (!isRecord(props)) throw new InvalidReactivesError(host, target, props)

			const signals = getSignals(target)
			const targetName = elementName(target)

			// Eager validate-then-commit (no mutation until every entry is known to
			// be bindable) — a failure must never leave a partial swap. See ADR 0011.
			const failures = new Map<string, string>()
			const bindings: {
				slot: Slot<unknown & {}>
				signal: Signal<unknown & {}> | SlotDescriptor<unknown & {}>
			}[] = []

			for (const [prop, reactive] of Object.entries(props)) {
				if (reactive == null) continue
				if (!(prop in target)) {
					failures.set(prop, `does not exist on ${targetName}`)
					continue
				}

				const signal = toSignal(host, reactive)
				if (!signal) {
					failures.set(prop, 'could not be resolved to a signal')
					continue
				}

				// ADR-0012: the property-key and bare-writable-signal short forms
				// hand the child unrestricted `.set()` on the parent's signal. Warn
				// in DEV_MODE. Detection is reversed — allow what is provably
				// read-only, warn on everything else.
				if (
					process.env.DEV_MODE === 'true' &&
					!isComputed(signal) &&
					!(
						signal &&
						typeof signal === 'object' &&
						'get' in signal &&
						!(Symbol.toStringTag in signal)
					)
				) {
					console.warn(
						`pass() received a writable signal for '${prop}'. Use () => host.${prop} for read-only access, or { get, set } to mediate writes.`,
					)
				}

				const slot = signals[prop]
				if (!isSlot(slot)) {
					failures.set(
						prop,
						`is not Slot-backed on ${targetName} (read-only property, or target is not a Le Truc component)`,
					)
					continue
				}
				bindings.push({ slot, signal })
			}

			if (failures.size)
				throw new InvalidPassPropertyError(host, target, failures)

			const cleanups = bindings.map(({ slot, signal }) => {
				const original = slot.current()
				slot.replace(signal)
				return () => slot.replace(original)
			})

			if (cleanups.length)
				return () => {
					for (const c of cleanups) c()
				}
		})

	/**
	 * Resolve every entry in `props` to its current value for the debug
	 * `console.debug` entry — the raw `PassedProps` map holds thunks/signals/
	 * descriptors, not values, which isn't useful to log as-is (LT-011).
	 * Best-effort: a prop that fails to resolve (the same failures
	 * `swapSlots` already validates against) logs the raw reactive instead.
	 */
	const resolvePassedValues = <Q extends HTMLElement>(
		props: PassedProps<P, Q>,
	): Record<string, unknown> => {
		const resolved: Record<string, unknown> = {}
		for (const [prop, reactive] of Object.entries(props)) {
			if (reactive == null) continue
			try {
				const signal = toSignal(host, reactive as Reactive<unknown, P>)
				resolved[prop] =
					signal && typeof signal === 'object' && 'get' in signal
						? (signal as { get: () => unknown }).get()
						: reactive
			} catch {
				resolved[prop] = reactive
			}
		}
		return resolved
	}

	function pass<Q extends HTMLElement>(
		target: Q | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends HTMLElement>(
		target: Signal<Q[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends HTMLElement>(
		target: Q | Signal<Q[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor {
		const descriptor: EffectDescriptor = () => {
			if (!target) return
			if (isSignal<Q[]>(target)) {
				// Signal target: keyed per-element lifecycle
				keyedScopes(target, el => {
					const cleanup = swapSlots(el, props)
					// swapSlots() links signals directly, bypassing this
					// descriptor on subsequent value updates — pass() has no
					// other reactive re-run point of its own (unlike watch(),
					// which re-runs its whole handler per prop change). So two
					// independent effects: (1) a tracked dependency on
					// `host.debug` that marks the element once debug turns on,
					// even with no further value change (LT-010); (2) the real
					// firing, driven by the passed values (so it re-runs on
					// every actual change), with `debug`/mark/pulse/log
					// resolved `untrack()`-ed — matching watch()'s companion
					// above — so toggling `debug` alone doesn't itself count as
					// a firing and spam `console.debug` (LT-013).
					if (process.env.DEV_MODE === 'true') {
						createEffect(() => markIfDebugging(host, el, 'pass'))
						createEffect(() => {
							const value = resolvePassedValues(props)
							untrack(() => debugFire(host, 'pass', el, value))
						})
					}
					return cleanup
				})
			} else {
				// Single element: swap slots directly in current scope
				swapSlots(target, props)
				// See the Signal-target branch above for why this needs two
				// independent effects.
				if (process.env.DEV_MODE === 'true') {
					createEffect(() => markIfDebugging(host, target, 'pass'))
					createEffect(() => {
						const value = resolvePassedValues(props)
						untrack(() => debugFire(host, 'pass', target, value))
					})
				}
			}
		}
		pushDescriptor(host, 'pass', descriptor)
		return descriptor
	}
	return pass
}

/**
 * Create per-element reactive effects from a `Signal<Element[]>`.
 *
 * Entering elements get their own scope; when they leave, that scope — and
 * everything registered in it — is disposed.
 *
 * The callback can call `watch()`, `on()`, and `pass()` directly instead of
 * returning them; each call registers against that element's scope. A
 * callback that calls `each()` again (e.g. rows containing columns) gets its
 * own nested scope. Returning descriptors still works and is not
 * double-activated if you also call them directly.
 *
 * The callback's 2nd parameter is `first`, a type-safe, throwing lookup
 * scoped to `element` instead of the host — the same shape as host-level
 * `first()`, minus M8 dependency-resolution participation (see ADR 0021).
 *
 * @since 2.0
 */
function each<E extends Element>(
	memo: Signal<E[]>,
	callback: (
		element: E,
		first: FirstElement,
	) => FactoryResult | EffectDescriptor | Falsy | void,
): EffectDescriptor {
	const descriptor: EffectDescriptor = () => {
		keyedScopes(memo, element => {
			const collected: EffectDescriptor[] = []
			const result = withCollector(collected, () =>
				callback(element, bindFirst(element)),
			)
			activateResult(collected)
			forEachUnseen(result, new Set(collected), d => d())
		})
	}
	pushDescriptor(undefined, 'each', descriptor)
	return descriptor
}

/**
 * Sync a keyed reactive data source to a container's children.
 *
 * For every key in `source` (in source order), the container holds one
 * element carrying `data-key`. Entering keys clone `template`'s root
 * element; leaving keys are disposed and removed; surviving elements are
 * reused and repositioned. The sync is one-way, data → DOM — mutate
 * `source` (e.g. from an event handler) to change structure.
 *
 * On first run, existing children whose `data-key` matches a source key are
 * adopted (`bindItem` runs for them too, so make it idempotent against
 * server-rendered content). Everything else is removed. Children carrying
 * `data-unreconciled` are left alone entirely — never removed, repositioned,
 * or bound.
 *
 * `bindItem` is called once per entering element, with the same collector
 * support as `each()`'s callback: `watch()`, `on()`, `pass()`, and
 * `provideContexts()` can be called directly inside it, scoped to that item.
 * A returned `MaybeCleanup` runs when the key leaves the source or the
 * component disconnects.
 *
 * `bindItem`'s 4th parameter is `first`, a type-safe, throwing lookup scoped
 * to `element` instead of the host — the same shape as host-level `first()`,
 * minus M8 dependency-resolution participation (see ADR 0021).
 *
 * See ADR 0017 for full rationale (SSR adoption, unreconciled pinning,
 * keyed-relative positioning).
 *
 * @since 2.3
 * @param {Element} container - Container element whose children are reconciled
 * @param {HTMLTemplateElement} template - Template whose single root element is cloned for entering keys
 * @param {MutableList<T> | DerivedList<T>} source - Keyed reactive data source
 * @param {(element: HTMLElement, item: Signal<T>, key: string, first: FirstElement) => MaybeCleanup} bindItem - Mounted once per entering element inside an ambient collector; collected descriptors activate against the per-item scope, and any returned cleanup is that scope's teardown
 * @returns {EffectDescriptor} Effect descriptor to include in the component's factory result
 * @throws {InvalidTemplateError} if the template content does not contain exactly one root element
 */
function reconcile<T extends {}, S extends MutableSignal<T>>(
	container: Element,
	template: HTMLTemplateElement,
	source: MutableList<T, S>,
	bindItem: (
		element: HTMLElement,
		item: S,
		key: string,
		first: FirstElement,
	) => MaybeCleanup,
): EffectDescriptor
function reconcile<T extends {}, S extends Signal<T>>(
	container: Element,
	template: HTMLTemplateElement,
	source: DerivedList<T, S>,
	bindItem: (
		element: HTMLElement,
		item: S,
		key: string,
		first: FirstElement,
	) => MaybeCleanup,
): EffectDescriptor
function reconcile<T extends {}>(
	container: Element,
	template: HTMLTemplateElement,
	source: MutableList<T> | DerivedList<T>,
	bindItem: (
		element: HTMLElement,
		item: Signal<T>,
		key: string,
		first: FirstElement,
	) => MaybeCleanup,
): EffectDescriptor {
	const descriptor: EffectDescriptor = () => {
		if (template.content.childElementCount !== 1)
			throw new InvalidTemplateError(
				container,
				template.content.childElementCount,
			)
		const itemRoot = template.content.firstElementChild as HTMLElement

		// WeakMap tracks element→key at runtime; `data-key` stays on the DOM
		// for SSR adoption and event-delegation ergonomics (ADR 0017).
		const keyOf = new WeakMap<Element, string>()
		const disposers = new Map<string, Cleanup>()

		// Next reconciled element after `after` in document order — skips
		// `data-unreconciled` elements, which are invisible to positioning.
		const nextKeyed = (after: Element | null): Element | null => {
			let node = after ? after.nextElementSibling : container.firstElementChild
			while (
				node &&
				(!keyOf.has(node) || node.hasAttribute('data-unreconciled'))
			)
				node = node.nextElementSibling
			return node
		}

		// Classify children: keep survivors, adopt unknown children with a
		// matching unclaimed `data-key`, remove everything else.
		const classify = (keySet: Set<string>) => {
			const current = new Map<string, HTMLElement>()
			const adopted = new Set<string>()
			const pinned = new Set<string>()
			const leavers: Element[] = []
			for (const child of Array.from(container.children)) {
				if (child.hasAttribute('data-unreconciled')) {
					// A reconciled element turned unreconciled (e.g. mid-drag)
					// still claims its key, so it is not duplicated by a clone,
					// but it is never moved or re-mounted.
					const key = keyOf.get(child)
					if (key !== undefined && keySet.has(key)) {
						current.set(key, child as HTMLElement)
						pinned.add(key)
					}
					continue
				}
				const key = keyOf.get(child)
				if (key !== undefined) {
					if (keySet.has(key)) current.set(key, child as HTMLElement)
					else leavers.push(child)
					continue
				}
				const harvested = child.getAttribute('data-key')
				if (
					harvested !== null &&
					keySet.has(harvested) &&
					!current.has(harvested)
				) {
					keyOf.set(child, harvested)
					current.set(harvested, child as HTMLElement)
					adopted.add(harvested)
					continue
				}
				if (process.env.DEV_MODE === 'true' && harvested !== null)
					console.warn(
						`reconcile() removed child with data-key="${harvested}" from ${elementName(container)} — key not present in the source.`,
					)
				child.remove()
			}
			return { current, adopted, pinned, leavers }
		}

		// Teardown before setup, as in keyedScopes. Also reaps scopes whose
		// element vanished through external DOM mutation.
		const leave = (keySet: Set<string>, leavers: Element[]) => {
			for (const [key, dispose] of disposers) {
				if (keySet.has(key)) continue
				dispose()
				disposers.delete(key)
			}
			for (const el of leavers) el.remove()
		}

		// Enter, mount, and position in source key order.
		const enter = (
			keys: string[],
			current: Map<string, HTMLElement>,
			adopted: Set<string>,
			pinned: Set<string>,
		) => {
			let prev: Element | null = null
			for (const key of keys) {
				let el = current.get(key)
				let mount = adopted.has(key)
				if (!el) {
					el = itemRoot.cloneNode(true) as HTMLElement
					el.setAttribute('data-key', key)
					keyOf.set(el, key)
					mount = true
				}
				if (mount) {
					// A stale scope survives only if the element was replaced
					// behind our back (removed externally, or re-adopted).
					disposers.get(key)?.()
					const item = source.byKey(key)
					if (item) {
						const element = el
						disposers.set(
							key,
							createScope(
								() => {
									const collected: EffectDescriptor[] = []
									const cleanup = withCollector(collected, () =>
										bindItem(element, item, key, bindFirst(element)),
									)
									activateResult(collected)
									return cleanup
								},
								{
									root: true,
								},
							),
						)
					}
				}
				if (pinned.has(key)) continue
				if (nextKeyed(prev) !== el)
					container.insertBefore(
						el,
						prev ? prev.nextElementSibling : container.firstElementChild,
					)
				prev = el
			}
		}

		createScope(() => {
			createEffect(() => {
				const keys = Array.from(source.keys())
				untrack(() => {
					const keySet = new Set(keys)
					const { current, adopted, pinned, leavers } = classify(keySet)
					leave(keySet, leavers)
					enter(keys, current, adopted, pinned)
				})
			})
			return () => {
				for (const dispose of disposers.values()) dispose()
				disposers.clear()
			}
		})
	}
	pushDescriptor(undefined, 'reconcile', descriptor)
	return descriptor
}

export {
	activateResult,
	type EffectDescriptor,
	each,
	type FactoryResult,
	type Falsy,
	forEachUnseen,
	keyedScopes,
	makePass,
	makeWatch,
	type PassedProps,
	type PassHelper,
	type Reactive,
	reconcile,
	type WatchHelper,
}
