import { createCell, createEffect, createSlot } from '@zeix/cause-effect'
import { bindState } from '../bindings'
import type { ComponentExtension } from '../extension'
import { getSignals } from '../internal'
import { schedule } from '../scheduler'
import type { FactoryResult } from '../types'
import { elementName, isCustomElement } from '../util'

/**
 * `DEV_MODE`-only visual and console instrumentation; see ADR 0022.
 * `defineComponent()` auto-appends `debug()` when `DEV_MODE` is true; callers never pass it explicitly.
 * Every call site is also gated on `DEV_MODE`, as a second guard against shipping this in production.
 */

/* === Visual Marking === */

const HOST_DEBUG_ATTR = 'data-le-truc-debug'
const PULSE_DURATION_MS = 200
const PULSE_ON = 'on'
const PULSE_OFF = 'off'

let styleInjected = false

/**
 * Injects the debug stylesheet once, module-scope. Scoped under `:state(debug)`/`[data-le-truc-*]`
 * selectors, so it has no visible effect until an element opts in via `debug=true`.
 * Called from `onConnect`, not lazily from a pulse, so the resting outline appears even for a
 * component that never fires `on()`/`pass()`/`watch()`.
 */
const injectDebugStyle = (): void => {
	if (styleInjected || typeof document === 'undefined') return
	styleInjected = true
	const style = document.createElement('style')
	style.textContent = `
@keyframes le-truc-debug-host-pulse {
	0% { box-shadow: 0 0 2px 1px oklch(0.51 0.21 353); }
	25% { box-shadow: 0 0 4px 1px oklch(0.51 0.21 353); }
	100% { box-shadow: 0 0 0 1px oklch(0.51 0.21 353); }
}
@keyframes le-truc-debug-element-pulse {
	0% { box-shadow: 0 0 2px 1px var(--le-truc-debug-color, #999); }
	100% { box-shadow: 0 0 2px 1px transparent; }
}
*:state(debug) {
	box-shadow: 0 0 0 1px oklch(0.51 0.21 353);
}
*:state(debug)[${HOST_DEBUG_ATTR}="${PULSE_ON}"] {
	animation: le-truc-debug-host-pulse ${PULSE_DURATION_MS}ms ease-out;
}
[data-le-truc-on] { --le-truc-debug-color: oklch(0.37 0.18 293); }
[data-le-truc-pass] { --le-truc-debug-color: oklch(0.65 0.18 53); }
[data-le-truc-watch] { --le-truc-debug-color: oklch(0.79 0.18 113); }
[data-le-truc-on="${PULSE_ON}"],
[data-le-truc-pass="${PULSE_ON}"],
[data-le-truc-watch="${PULSE_ON}"] {
	animation: le-truc-debug-element-pulse ${PULSE_DURATION_MS}ms ease-out;
}
`
	document.head.appendChild(style)
}

/**
 * Per-(element, attribute) pulse bookkeeping: the `schedule()` dedup key and the pending reset timer.
 * Keyed per attribute, not just per element, because host and target can be the same element and need
 * two independent, concurrently running pulse cycles.
 * The key is an opaque object, not the element itself: `schedule()` uses last-write-wins per key, and
 * `dangerouslyBindInnerHTML` also schedules writes keyed on the element — sharing that key would let
 * one silently discard the other's pulse.
 */
type PulseState = {
	key: object
	timer: ReturnType<typeof setTimeout> | undefined
}
// `/*#__PURE__*/` is load-bearing: it marks this WeakMap construction as
// side-effect-free so DCE can drop it from the production bundle when the
// DEV_MODE guards fold. See test/regression-bundle.test.ts.
const pulseStates = /*#__PURE__*/ new WeakMap<
	Element,
	Map<string, PulseState>
>()

const pulseStateFor = (element: Element, attr: string): PulseState => {
	let byAttr = pulseStates.get(element)
	if (!byAttr) {
		byAttr = new Map()
		pulseStates.set(element, byAttr)
	}
	let state = byAttr.get(attr)
	if (!state) {
		state = { key: {}, timer: undefined }
		byAttr.set(attr, state)
	}
	return state
}

/**
 * Triggers a pulse of `attr` on `element`.
 * Scheduled and deduplicated per (element, attribute) via `schedule()`, so a burst of same-element
 * activity within one frame collapses into a single visible pulse.
 */
const pulse = (element: Element, attr: string): void => {
	const state = pulseStateFor(element, attr)
	schedule(state.key, () => {
		// Cancel the previous pulse's pending reset, or it can flip the
		// attribute off mid-animation for a pulse that starts soon after.
		if (state.timer !== undefined) clearTimeout(state.timer)
		element.setAttribute(attr, PULSE_OFF)
		// Force reflow so the animation restarts even if the previous pulse
		// hasn't finished.
		void (element as HTMLElement).offsetWidth
		element.setAttribute(attr, PULSE_ON)
		state.timer = setTimeout(() => {
			state.timer = undefined
			element.setAttribute(attr, PULSE_OFF)
		}, PULSE_DURATION_MS)
	})
}

/** Ensures `element` carries its resting `kind` attribute, once. */
const mark = (element: Element, kind: 'on' | 'pass' | 'watch'): void => {
	const attr = `data-le-truc-${kind}`
	if (!element.hasAttribute(attr)) element.setAttribute(attr, PULSE_OFF)
}

/**
 * Logs one `console.debug` entry per firing that also drives a visual effect.
 * Always names the originating component. Omits the target element when there is none to attribute,
 * or when it is the same element as `host`.
 */
const log = (
	host: HTMLElement,
	kind: 'on' | 'pass' | 'watch',
	element: Element | undefined,
	value: unknown,
): void => {
	const sameAsHost = element === host
	if (kind === 'on') {
		const type = value instanceof Event ? value.type : String(value)
		const origin = sameAsHost ? '' : ` from ${elementName(element)}`
		console.debug(
			`[le-truc debug] on "${type}" in ${elementName(host)}${origin}`,
			value,
		)
	} else if (kind === 'pass') {
		const target = sameAsHost ? '' : ` to ${elementName(element)}`
		console.debug(
			`[le-truc debug] pass from ${elementName(host)}${target}`,
			value,
		)
	} else {
		const attribution =
			element && !sameAsHost ? ` → ${elementName(element)}` : ''
		console.debug(
			`[le-truc debug] watch in ${elementName(host)}${attribution}`,
			value,
		)
	}
}

/**
 * Reports whether `host` currently wants debug instrumentation.
 * Checked at fire time, not at listener registration, so toggling `debug` takes effect immediately.
 */
const isDebugging = (host: HTMLElement): boolean =>
	process.env.DEV_MODE === 'true' &&
	Boolean((host as HTMLElement & { debug?: boolean }).debug)

/**
 * Fires the debug companion effect for one `on()`/`pass()`/`watch()` firing: marks and pulses
 * `element` if attributable, always pulses `host`, and logs one entry. No-op unless `isDebugging(host)`.
 */
const debugFire = (
	host: HTMLElement,
	kind: 'on' | 'pass' | 'watch',
	element: Element | undefined,
	value: unknown,
): void => {
	if (!isDebugging(host)) return
	if (element) {
		mark(element, kind)
		pulse(element, `data-le-truc-${kind}`)
	}
	pulse(host, HOST_DEBUG_ATTR)
	log(host, kind, element, value)
}

/**
 * Ensures `element` carries its `kind` mark whenever `host` is currently debugging — mark-only, no pulse or log.
 * `pass()` has no reactive re-run point of its own once `swapSlots()` links its signals directly, so this gives
 * it a tracked dependency on `host.debug` to mark an already-connected target when `debug` turns on later,
 * without logging a firing that didn't happen. See `makePass()`.
 */
const markIfDebugging = (
	host: HTMLElement,
	element: Element,
	kind: 'on' | 'pass' | 'watch',
): void => {
	if (isDebugging(host)) mark(element, kind)
}

/* === Toggling debug via metaKey+click (ADR 0022, provisional) === */

let toggleInstalled = false

/**
 * Walks up from `start` to the nearest ancestor with a `debug` accessor, crossing shadow boundaries.
 * Tests `'debug' in node` rather than the element's tag name, since structural-only custom elements
 * (layout wrappers) have no `debug` property, and climbs out through `getRootNode().host` for
 * elements inside a shadow root.
 */
const findDebuggableHost = (
	start: Element | null,
): (HTMLElement & { debug: boolean }) | null => {
	let node: Element | null = start
	while (node) {
		if (isCustomElement(node) && 'debug' in node)
			return node as HTMLElement & { debug: boolean }
		const root = node.getRootNode()
		node =
			node.parentElement ??
			(typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
				? root.host
				: null)
	}
	return null
}

/**
 * Installs a single document-level, capture-phase click listener that toggles the `debug` property
 * of the nearest debuggable ancestor on `metaKey`+click. Installed once, lazily, on the first
 * `DEV_MODE` component connect. Provisional; see ADR 0022 Alternatives.
 */
const installDebugToggle = (): void => {
	if (toggleInstalled || typeof document === 'undefined') return
	toggleInstalled = true
	document.addEventListener(
		'click',
		(e: MouseEvent) => {
			if (!e.metaKey) return
			const host = findDebuggableHost(e.composedPath()[0] as Element | null)
			if (!host) return
			host.debug = !host.debug
		},
		{ capture: true },
	)
}

/* === Exported Extension === */

/**
 * `ComponentExtension` adding a reactive `debug: boolean` property, default `false`, to every
 * component in `DEV_MODE`. Syncs `:state(debug)` on the host via `bindState()` and lazily installs
 * the `metaKey`+click toggle.
 *
 * @since 2.4
 */
const debug = (): ComponentExtension => ({
	name: 'debug',
	reservedMembers: new Set(['debug']),
	onConnect: (instance, internals): FactoryResult | void => {
		injectDebugStyle()
		installDebugToggle()
		const state = createCell(false)
		const slot = createSlot(state)
		const signals = getSignals(instance)
		signals['debug'] = slot
		Object.defineProperty(instance, 'debug', {
			get: () => slot.get(),
			set: (v: boolean) => slot.set(v),
			enumerable: true,
			configurable: true,
		})
		// No `internals` means the environment has no ElementInternals support.
		// The `debug` property, toggle, marks, pulses, and logging still work;
		// only the resting `*:state(debug)` outline is missing.
		if (!internals) return
		const setState = bindState(internals, 'debug')
		return [() => createEffect(() => setState(slot.get()))]
	},
})

export { debug, debugFire, markIfDebugging }
