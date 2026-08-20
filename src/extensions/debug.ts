import { createCell, createEffect, createSlot } from '@zeix/cause-effect'
import { bindState } from '../bindings'
import type { ComponentExtension } from '../extension'
import { getSignals } from '../internal'
import { schedule } from '../scheduler'
import type { FactoryResult } from '../types'
import { elementName, isCustomElement } from '../util'

/**
 * `DEV_MODE`-only visual and console instrumentation (ADR 0022). Not
 * exported from the package entry point — `debug()` is auto-appended to
 * every component's extensions by `defineComponent()` itself whenever
 * `process.env.DEV_MODE === 'true'` (see `src/component.ts`), never passed
 * explicitly by a caller. Everything in this module is additionally gated at
 * its own call sites, so a bundler that fails to fold `DEV_MODE` still can't
 * ship this live — but the primary production guard is `component.ts` never
 * appending the extension at all.
 */

/* === Visual Marking === */

const HOST_DEBUG_ATTR = 'data-le-truc-debug'
const PULSE_DURATION_MS = 200
const PULSE_ON = 'on'
const PULSE_OFF = 'off'

let styleInjected = false

/**
 * Inject the debug stylesheet once (module-scope, not per-instance). Scoped
 * entirely under `:state(debug)`/`[data-le-truc-*]` selectors, so it has no
 * visible effect unless an element opts in via `debug=true`.
 *
 * Called from `onConnect`, not lazily from {@link pulse}. The stylesheet
 * carries the *resting* `*:state(debug)` outline as well as the pulse
 * keyframes, and `bindState()` adds `:state(debug)` the instant `debug` flips
 * on — so deferring injection to the first firing left a component that
 * simply isn't firing anything with no visible indicator at all, until some
 * unrelated `on()`/`pass()`/`watch()` happened to inject the rules later.
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
 * Per-(element, attribute) pulse bookkeeping: the `schedule()` dedup key and
 * the pending attribute-reset timer.
 *
 * Keyed per attribute, not just per element, because the event/effect target
 * and the host can be the same element (see {@link log}) — that element then
 * needs two independent pulse cycles running concurrently, one on
 * `data-le-truc-<kind>` and one on `${HOST_DEBUG_ATTR}`, each with its own
 * timer. A single shared timer would let one cycle's reset clobber the
 * other's still-running animation.
 *
 * The key is deliberately *not* the element itself. `schedule()` is keyed by
 * object identity with last-write-wins (`src/scheduler.ts`), and
 * `dangerouslyBindInnerHTML` schedules its writes under the element —
 * scheduling a pulse under the same key means whichever of the two runs last
 * in a frame silently discards the other. Since `makeWatch()` registers the
 * debug companion effect *before* the author's effect, the pulse was always
 * the one dropped, on exactly the elements whose content was changing. An
 * opaque per-(element, attribute) token keeps the ADR 0022 "one pulse per
 * element per frame" dedup while making debug instrumentation unable to
 * interact with functional scheduling in either direction.
 */
type PulseState = {
	key: object
	timer: ReturnType<typeof setTimeout> | undefined
}
// `/*#__PURE__*/` is load-bearing, not decoration: everything else in this
// module is either a function declaration or a primitive `let`, all of which
// DCE drops once the `DEV_MODE` guards fold. A bare module-scope
// `new WeakMap()` is a side-effectful expression to the bundler, so it
// survives into the production bundle and keeps a fragment of debug.ts alive
// — caught by `test/regression-bundle.test.ts`.
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
 * Trigger a pulse of `attr` on `element` — host or per-element, the CSS
 * selectors in {@link injectDebugStyle} tell them apart by attribute name.
 * Scheduled and deduplicated per (element, attribute) via the existing
 * `schedule()`, so a burst of same-element activity within one frame
 * collapses into a single visible pulse. The stylesheet is already in the
 * document by this point: `onConnect` injects it before any component can
 * have `debug` set at all.
 */
const pulse = (element: Element, attr: string): void => {
	const state = pulseStateFor(element, attr)
	schedule(state.key, () => {
		// Cancel the previous pulse's pending reset — otherwise a pulse
		// started less than PULSE_DURATION_MS after the last one gets its
		// attribute flipped off mid-animation by the older timer.
		if (state.timer !== undefined) clearTimeout(state.timer)
		element.setAttribute(attr, PULSE_OFF)
		// Force reflow so flipping the attribute back to "on" restarts the
		// animation even if the previous pulse hasn't finished.
		void (element as HTMLElement).offsetWidth
		element.setAttribute(attr, PULSE_ON)
		state.timer = setTimeout(() => {
			state.timer = undefined
			element.setAttribute(attr, PULSE_OFF)
		}, PULSE_DURATION_MS)
	})
}

/** Ensure `element` carries its resting `kind` attribute, once. */
const mark = (element: Element, kind: 'on' | 'pass' | 'watch'): void => {
	const attr = `data-le-truc-${kind}`
	if (!element.hasAttribute(attr)) element.setAttribute(attr, PULSE_OFF)
}

/**
 * One `console.debug` entry per firing that also drives a visual effect.
 * Always names the originating component via `elementName(host)`. Drops the
 * target element entirely when there's none to attribute (`watch()` with a
 * handler that isn't `bind*`-produced) rather than printing an
 * "(unattributed)" placeholder — no element is not itself information worth
 * a word in the message. Also drops it when it's the same element as `host`
 * (e.g. a component listening on itself) — naming the same component twice
 * in one line is redundant, not additional information.
 */
const log = (
	host: HTMLElement,
	kind: 'on' | 'pass' | 'watch',
	element: Element | undefined,
	value: unknown,
): void => {
	const sameAsHost = element === host
	if (kind === 'on') {
		// value is always the raw DOM Event for 'on' firings (see debugFire()
		// call sites in helpers/events.ts) — element is always known too.
		const type = value instanceof Event ? value.type : String(value)
		const origin = sameAsHost ? '' : ` from ${elementName(element)}`
		console.debug(
			`[le-truc debug] on "${type}" in ${elementName(host)}${origin}`,
			value,
		)
	} else if (kind === 'pass') {
		// element (the pass() target) is always known.
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
 * Whether `host` currently wants debug instrumentation — `DEV_MODE` and its
 * reactive `debug` property both true. Checked at fire time, not at
 * companion-listener registration time, so toggling `debug` takes effect
 * immediately without re-wiring listeners.
 */
const isDebugging = (host: HTMLElement): boolean =>
	process.env.DEV_MODE === 'true' &&
	Boolean((host as HTMLElement & { debug?: boolean }).debug)

/**
 * Fire the debug companion effect for one `on()`/`pass()`/`watch()` firing:
 * mark and pulse `element` if attributable, always pulse `host`, and log one
 * `console.debug` entry. No-op unless `isDebugging(host)`.
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
 * Ensure `element` carries its `kind` mark whenever `host` is currently
 * debugging — deliberately mark-only, no pulse or log. `pass()` has no
 * reactive re-run point of its own once `swapSlots()` links its signals
 * directly, so its companion needs a tracked dependency on `host.debug` to
 * mark an already-connected target when `debug` turns on later. But
 * toggling `debug` is not itself a firing: pulsing/logging for every
 * currently-mounted `pass()` the instant `debug` flips on would spam
 * `console.debug` with entries no value change actually produced. Callers
 * combine this (tracked) with a separate `untrack()`-wrapped `debugFire()`
 * call for real firings — see `makePass()`.
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
 * Walk up from `start` to the nearest ancestor that actually has a `debug`
 * accessor, crossing shadow boundaries on the way.
 *
 * Two reasons this can't just stop at the first element with a dash in its
 * localName. Structural-only custom elements are common as layout wrappers
 * (`examples/main.ts` alone defines six: `module-demo`, `card-callout`,
 * `section-hero`, …) and they're plain `HTMLElement` subclasses with no
 * `debug` property — stopping there assigned a meaningless expando and the
 * gesture silently did nothing. And `parentElement` is `null` for a
 * top-level child of a shadow root, so the walk could never climb back out
 * to a host that used `dangerouslyBindInnerHTML({ shadowRootMode })`, even
 * though `composedPath()` had already pierced the boundary on the way in.
 *
 * `'debug' in node` is the honest test: `onConnect` defines the accessor on
 * the instance, so it's true for exactly the connected components that can
 * respond to the toggle, and false for structural wrappers and
 * not-yet-upgraded elements alike.
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
 * Install a single document-level, capture-phase click listener that toggles
 * the `debug` property of the nearest ancestor that has one (see
 * {@link findDebuggableHost}) on `metaKey`+click.
 * Installed once, lazily, on the first `DEV_MODE` component connect — not
 * per instance. Provisional: `metaKey` collides with native Cmd/Ctrl+click
 * link navigation, judged a small risk since custom element hosts are
 * themselves unlikely to be links (see ADR 0022 Alternatives).
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
 * `ComponentExtension` adding a reactive `debug: boolean` property (default
 * `false`) to every component, in `DEV_MODE` only. Not exported from the
 * package entry point — see the module doc comment. Syncs `:state(debug)` on
 * the host via `bindState()`, the same custom-state mechanism every other
 * component-owned state already uses, and lazily installs the `metaKey`+click
 * toggle.
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
		// No `internals` means the `attachInternals()` call in the `Truc`
		// constructor threw (`src/component.ts`) — in practice because the
		// environment has no `ElementInternals` at all, not because of any
		// lifecycle timing. So there are no custom states to write to.
		// Everything else
		// still works: the `debug` property, the metaKey toggle, per-element
		// marks, pulses, and logging. Only the resting `*:state(debug)`
		// outline is missing, since that selector has nothing to match. Left
		// as a graceful degradation rather than given an attribute fallback —
		// a second marking mechanism for a case that already warns on first
		// `internals` access is more surface area than the gap is worth.
		if (!internals) return
		const setState = bindState(internals, 'debug')
		return [() => createEffect(() => setState(slot.get()))]
	},
})

export { debug, debugFire, markIfDebugging }
