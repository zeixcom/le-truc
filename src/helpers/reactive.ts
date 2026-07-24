import {
	type Cleanup,
	type Collection,
	createComputed,
	createEffect,
	createMemo,
	createScope,
	isComputed,
	isFunction,
	isMemo,
	isRecord,
	isSlot,
	type List,
	type MaybeCleanup,
	type MaybePromise,
	type Memo,
	type MutableSignal,
	match,
	type Signal,
	type SingleMatchHandlers,
	type Slot,
	type SlotDescriptor,
	untrack,
} from '@zeix/cause-effect'
import {
	InvalidCustomElementError,
	InvalidPassPropertyError,
	InvalidReactivesError,
	InvalidTemplateError,
} from '../errors'
import { getSignals, pushDescriptor, withCollector } from '../internal'
import type {
	ComponentProp,
	ComponentProps,
	EffectDescriptor,
	FactoryResult,
	Falsy,
} from '../types'
import { elementName, isCustomElement } from '../util'

/* === Types === */

/**
 * A reactive value that drives a DOM update or a slot injection.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
 * - `() => T | Promise<T> | null | undefined` — a thunk wrapped in `createComputed`;
 *   all signals read inside are tracked in the pure phase. Returning `null` or
 *   `undefined` drives the `nil` path; an async thunk becomes a `Task` signal.
 */
type Reactive<T, P extends ComponentProps> =
	| keyof P
	| Signal<T & {}>
	| (() => T | Promise<T> | null | undefined)

/**
 * A map of child component property names to the reactive values to inject into them.
 * Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.
 *
 * `Q`'s own bound is only `HTMLElement` — not `ComponentProps` — because a target's
 * element type (e.g. `FormAssociatedElement & FormTextboxProps`) may mix in
 * interfaces with nullable native members (`form: HTMLFormElement | null`), which
 * would make the whole intersection fail a `Record<string, {}>`-style constraint.
 * Instead, `keyof Q & ComponentProp` does the filtering: it keeps only the
 * author-exposed reactive props (excluding native `HTMLElement` members and
 * reserved words) regardless of what else `Q` mixes in.
 *
 * Prefer the read-only thunk (`() => host.prop`) and the mediated
 * `{ get, set }` descriptor forms. The property-key and bare-writable-signal
 * forms are deprecated; they warn in DEV_MODE and will be removed in the next major.
 */
type PassedProps<P extends ComponentProps, Q extends HTMLElement> = {
	[K in keyof Q & ComponentProp]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>
}

/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from a signal source (property name, Signal, thunk,
 * or array). Only the declared sources trigger re-runs — incidental reads inside
 * the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * Thunk form `() => T` is wrapped in `createComputed`, so all signals read inside
 * it are tracked in the pure phase — useful for deriving or transforming values
 * before the side-effectful handler runs.
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
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 *
 * The property-key (`'value'`) and bare-writable-signal (`someState`) forms are
 * deprecated — they hand the child unrestricted `.set()` on the parent's signal
 * (ADR-0012) and warn in DEV_MODE. Migrate to the behavior-preserving descriptor:
 *
 * ```ts
 * // before (deprecated) — child can write freely
 * pass(child, { value: parentSignal })
 * // after — child writes are mediated by the parent
 * pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
 * ```
 *
 * For read-only access use the thunk: `pass(child, { value: () => host.value })`.
 * Both deprecated forms are removed in the next major.
 */
type PassHelper<P extends ComponentProps> = {
	<Q extends HTMLElement>(
		target: Q | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	<Q extends HTMLElement>(
		target: Memo<Q[]> | Falsy,
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
 * (ADR 0018) — a descriptor produced by one of those helpers is pushed
 * whether or not it's also `return`ed, so it must only be visited once. A
 * manually-constructed `EffectDescriptor` that bypasses every helper (never
 * pushed anywhere) is not in `seen` and is still visited — the explicit
 * `FactoryResult` return type has always allowed authoring one directly,
 * without going through `watch()`/`on()`/`pass()`/`each()`, so this remains
 * the one path such a descriptor can be picked up by.
 *
 * @since 2.3
 * @param {FactoryResult | EffectDescriptor | Falsy} result - Flat or nested array, single descriptor, or falsy value to reconcile
 * @param {ReadonlySet<EffectDescriptor>} seen - Descriptors already accounted for (by reference) — skipped
 * @param {(descriptor: EffectDescriptor) => void} visit - Called once per not-yet-seen descriptor, in encounter order
 */
const forEachUnseen = (
	result: FactoryResult | EffectDescriptor | Falsy,
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
 * Drive per-element scopes from a `Memo<E[]>` with element-identity keying.
 *
 * Elements entering the collection get a scope created by `mount`; elements
 * leaving get exactly their own scope disposed. Surviving elements are
 * untouched across re-runs. All remaining scopes are disposed when the
 * enclosing owner (component scope) is disposed.
 *
 * Two ownership details are load-bearing:
 * - Per-element scopes use `{ root: true }` — a plain `createScope` inside the
 *   effect would register its dispose on the effect, which runs all cleanups
 *   before every re-run, silently reproducing wholesale rebuild.
 * - The outer `createScope` wrapper registers on the component scope; its
 *   returned cleanup is the only thing that tears down still-live root-scoped
 *   element scopes on component disconnect.
 *
 * @since 2.2
 * @param {Memo<E[]>} memo - Memo of the current element collection
 * @param {(element: E) => MaybeCleanup} mount - Called once per entering element inside its scope; a returned cleanup registers on that scope
 */
const keyedScopes = <E extends object>(
	memo: Memo<E[]>,
	mount: (element: E) => MaybeCleanup,
): void => {
	const scopes = new Map<E, () => void>()
	createScope(() => {
		createEffect(() => {
			const current = memo.get()
			const currentSet = new Set(current)
			// Dispose leaving elements before mounting entering ones, preserving
			// teardown-before-setup ordering for one-mutation replacements.
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
 * - String: look up the signal in the component's signal map; fall back to a computed
 *   that reads `host[name]` (covers properties added via `Object.defineProperty`).
 * - Thunk `() => T | Promise<T> | null | undefined`: wrapped in `createComputed`
 *   so all signals read inside are tracked in the pure phase. Async thunks become
 *   Task signals.
 * - Signal: use directly.
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
	if (isFunction<T>(source)) return createComputed(source)
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
				return createEffect(() =>
					match(signals, { ok: values => untrack(() => handler(values)) }),
				)
			}
			const signal = toSignal(host, source)
			if (typeof handlerOrHandlers === 'function') {
				return createEffect(() =>
					match(signal, {
						ok: value => untrack(() => handlerOrHandlers(value)),
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
 * The `run` helper type in `FactoryContext`.
 *
 * Registers a hand-authored `EffectDescriptor` — a thunk not produced by
 * `watch()`, `on()`, `pass()`, `each()`, or `provideContexts()` — into the
 * ambient collector, the same way those helpers already do internally. For
 * wrapping native APIs (`IntersectionObserver`, etc.) or composed cause-effect
 * primitives that need deferred activation and automatic disconnect cleanup.
 */
type RunHelper = (descriptor: EffectDescriptor) => void

/**
 * Create a `run` helper bound to a specific component host.
 *
 * `run` pushes a hand-authored `EffectDescriptor` into the ambient collector.
 * It is the registration path for effects that don't fit `watch()`/`on()`/
 * `pass()`/`each()`/`provideContexts()` — e.g. a raw `IntersectionObserver`
 * wrapped in a thunk that returns its own cleanup.
 *
 * Wraps `rawDescriptor` in `createScope()` rather than pushing it directly:
 * the activation loop that calls every collected descriptor (`activateResult`)
 * discards each call's return value — `watch()`/`on()`/`pass()` are unaffected
 * because they call `createEffect()`/`createScope()` internally, which
 * self-register onto the active owner regardless of what the outer caller
 * does with the return value, but a raw thunk that just returns a bare
 * cleanup has no such internal registration. `createScope()` picks up
 * `rawDescriptor`'s returned cleanup and registers it on whatever owner is
 * active when the wrapped descriptor runs (the component's root scope during
 * normal activation), so it actually runs on disconnect.
 *
 * @since 2.3
 * @param {HTMLElement & P} host - The component host element
 * @returns {RunHelper} Bound `run` function for the given host
 */
const makeRun =
	<P extends ComponentProps>(host: HTMLElement & P): RunHelper =>
	(rawDescriptor: EffectDescriptor): void => {
		const descriptor: EffectDescriptor = () => createScope(rawDescriptor)
		pushDescriptor(host, 'run', descriptor)
	}

/**
 * Create a `pass` helper bound to a specific component host.
 *
 * `pass` passes reactive values to a descendant Le Truc component by swapping
 * its Slot-backed signals. The original signals are restored when the component
 * disconnects. Supports both single-element and `Memo<Element[]>` targets.
 *
 * For Memo targets, uses per-element lifecycle: signals are swapped when elements
 * enter the collection and restored when they leave.
 *
 * The property-key and bare-writable-signal short forms are deprecated:
 * They grant the child unrestricted `.set()` on the parent's signal.
 * In DEV_MODE `pass()` emits a warning for each writable binding:
 *
 * > `pass() received a writable signal for '<prop>'. Use () => host.<prop> for read-only access, or { get, set } to mediate writes.`
 *
 * The migration is behavior-preserving:
 * `pass(child, { value: sig })` → `pass(child, { value: { get: sig.get, set: sig.set } })`,
 * or for read-only access `pass(child, { value: () => host.value })`. The
 * deprecated forms are removed in the next major.
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

	function pass<Q extends HTMLElement>(
		target: Q | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends HTMLElement>(
		target: Memo<Q[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends HTMLElement>(
		target: Q | Memo<Q[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor {
		const descriptor: EffectDescriptor = () => {
			if (!target) return
			if (isMemo<Q[]>(target)) {
				// Memo target: keyed per-element lifecycle
				keyedScopes(target, el => swapSlots(el, props))
			} else {
				// Single element: swap slots directly in current scope
				swapSlots(target, props)
			}
		}
		pushDescriptor(host, 'pass', descriptor)
		return descriptor
	}
	return pass
}

/**
 * Create per-element reactive effects from a `Memo<Element[]>`.
 *
 * When elements enter the collection, their effects are created in a per-element
 * scope; when they leave, their effects are disposed with that scope.
 *
 * As of v2.3, the callback can call `watch()`/`on()`/`pass()` directly without
 * returning them — each call registers into a collector local to that element's
 * `mount`, established for the duration of the callback (see ADR 0018). Nesting
 * is unbounded: a callback that calls `each()` again (e.g. a grid of rows
 * containing columns) gets its own nested collector the same way.
 *
 * Descriptors produced by `watch()`/`on()`/`pass()` inside the callback are
 * picked up via the implicit collector regardless of whether the callback also
 * `return`s them — an old-style `return [watch(...)]` still works, activated
 * exactly once, not twice (see `forEachUnseen()`). A manually-constructed
 * `EffectDescriptor` that bypasses every helper is only reachable via `return`
 * and is still activated, since the public `FactoryResult` type has always
 * allowed authoring one directly.
 *
 * @since 2.0
 */
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult | EffectDescriptor | Falsy,
): EffectDescriptor {
	const descriptor: EffectDescriptor = () => {
		keyedScopes(memo, element => {
			const collected: EffectDescriptor[] = []
			const result = withCollector(collected, () => callback(element))
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
 * For every key in the source (in source order), the container holds one
 * element carrying `data-key`: entering keys clone the `<template>`'s single
 * root element, leaving keys dispose their scope and remove their element,
 * and surviving elements are moved with `insertBefore()` — always reused,
 * never recreated. The sync is strictly one-way, data → DOM: `reconcile()`
 * never reads item data back from the DOM; event handlers that mutate the
 * source are the legitimate path to change structural state.
 *
 * On the first run, existing children carrying `data-key` are **adopted** if
 * their key is present in the source (`bindItem` is mounted for them too —
 * it is responsible for its own idempotency against server-rendered content);
 * keyed children whose key is absent are removed (DEV_MODE warning), and all
 * other unkeyed children are removed (self-cleaning container).
 *
 * Children carrying `data-unreconciled` are exempt from reconciliation:
 * never removed, never repositioned, no `bindItem`. An element that
 * `reconcile()` itself placed and that later gains the attribute (e.g. a
 * mid-drag item) still claims its key, so no duplicate clone is created for
 * it while it is exempt. Keyed elements are positioned relative to the
 * **keyed subset** (after the previous keyed sibling, or at the head if
 * first), so unmanaged elements interspersed in the container do not drift
 * keyed positions.
 *
 * `bindItem` is called once per entering element inside a root-keyed scope,
 * with **collector parity to `each()`'s callback**: `watch()`, `on()`,
 * `pass()`, `provideContexts()`, and `run()` may be called inside it
 * directly, and the collected descriptors activate against that per-item
 * scope rather than the driving structural effect — so an item-level
 * `watch(item, …)` never makes structural work depend on item signals. A
 * returned `MaybeCleanup` registers as that scope's teardown, disposed when
 * the key leaves the source or the component disconnects.
 *
 * Throws `InvalidTemplateError` at activation if the template content does
 * not contain exactly one root element. See ADR 0017.
 *
 * @since 2.3
 * @param {Element} container - Container element whose children are reconciled
 * @param {HTMLTemplateElement} template - Template whose single root element is cloned for entering keys
 * @param {List<T> | Collection<T>} source - Keyed reactive data source
 * @param {(element: HTMLElement, item: Signal<T>, key: string) => MaybeCleanup} bindItem - Mounted once per entering element inside an ambient collector; collected descriptors activate against the per-item scope, and any returned cleanup is that scope's teardown
 * @returns {EffectDescriptor} Effect descriptor to include in the component's factory result
 */
function reconcile<T extends {}, S extends MutableSignal<T>>(
	container: Element,
	template: HTMLTemplateElement,
	source: List<T, S>,
	bindItem: (element: HTMLElement, item: S, key: string) => MaybeCleanup,
): EffectDescriptor
function reconcile<T extends {}, S extends Signal<T>>(
	container: Element,
	template: HTMLTemplateElement,
	source: Collection<T, S>,
	bindItem: (element: HTMLElement, item: S, key: string) => MaybeCleanup,
): EffectDescriptor
function reconcile<T extends {}>(
	container: Element,
	template: HTMLTemplateElement,
	source: List<T> | Collection<T>,
	bindItem: (
		element: HTMLElement,
		item: Signal<T>,
		key: string,
	) => MaybeCleanup,
): EffectDescriptor {
	const descriptor: EffectDescriptor = () => {
		if (template.content.childElementCount !== 1)
			throw new InvalidTemplateError(
				container,
				template.content.childElementCount,
			)
		const itemRoot = template.content.firstElementChild as HTMLElement

		// WeakMap is the runtime element→key bookkeeping; `data-key` stays on the
		// DOM for SSR adoption harvest and event-delegation ergonomics (ADR 0017).
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

		createScope(() => {
			createEffect(() => {
				const keys = Array.from(source.keys())
				untrack(() => {
					const keySet = new Set(keys)
					const current = new Map<string, HTMLElement>()
					const adopted = new Set<string>()
					const pinned = new Set<string>()
					const leavers: Element[] = []

					// Scan: classify children. Survivors are kept, unknown children
					// with a matching unclaimed `data-key` are adopted, everything
					// else (leavers, unmatched keys, unkeyed children) is removed.
					for (const child of Array.from(container.children)) {
						if (child.hasAttribute('data-unreconciled')) {
							// A previously reconciled element that turned unreconciled
							// (e.g. a mid-drag item) still claims its key: it must not be
							// duplicated by a clone, but is never moved or re-mounted.
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

					// Dispose leaving scopes before removing their elements, and both
					// before mounting enterers (teardown-before-setup, as in
					// keyedScopes). Also reaps scopes whose element vanished through
					// external DOM mutation.
					for (const [key, dispose] of disposers) {
						if (keySet.has(key)) continue
						dispose()
						disposers.delete(key)
					}
					for (const el of leavers) el.remove()

					// Enter, mount, and position in source key order.
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
												bindItem(element, item, key),
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
	makeRun,
	makeWatch,
	type PassedProps,
	type PassHelper,
	type Reactive,
	type RunHelper,
	reconcile,
	type WatchHelper,
}
