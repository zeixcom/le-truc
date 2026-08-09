import { createEffect, createSlot, createState } from '@zeix/cause-effect'
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

const PULSE_CLASS = 'le-truc-debug-pulse'
const PULSE_DURATION_MS = 200

let styleInjected = false

/**
 * Inject the debug stylesheet once (module-scope, not per-instance). Scoped
 * entirely under `:state(debug)`/`[data-le-truc-*]` selectors, so it has no
 * visible effect unless an element opts in via `debug=true`.
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
*:state(debug).${PULSE_CLASS} {
	animation: le-truc-debug-host-pulse ${PULSE_DURATION_MS}ms ease-out;
}
[data-le-truc-on] { --le-truc-debug-color: oklch(0.37 0.18 293); }
[data-le-truc-pass] { --le-truc-debug-color: oklch(0.65 0.18 53); }
[data-le-truc-watch] { --le-truc-debug-color: oklch(0.79 0.18 113); }
[data-le-truc-on].${PULSE_CLASS},
[data-le-truc-pass].${PULSE_CLASS},
[data-le-truc-watch].${PULSE_CLASS} {
	animation: le-truc-debug-element-pulse ${PULSE_DURATION_MS}ms ease-out;
}
`
	document.head.appendChild(style)
}

/**
 * Trigger a pulse on `element` — host or per-element, the CSS selectors in
 * {@link injectDebugStyle} tell them apart. Scheduled and deduplicated per
 * element via the existing `schedule()` (the same mechanism
 * `dangerouslyBindInnerHTML` uses), so a burst of same-element activity
 * within one frame collapses into a single visible pulse.
 */
const pulse = (element: Element): void => {
	injectDebugStyle()
	schedule(element, () => {
		element.classList.remove(PULSE_CLASS)
		// Force reflow so re-adding the class restarts the animation even if
		// the previous pulse hasn't finished.
		void (element as HTMLElement).offsetWidth
		element.classList.add(PULSE_CLASS)
		setTimeout(() => element.classList.remove(PULSE_CLASS), PULSE_DURATION_MS)
	})
}

/** Set the presence-only marking attribute for `kind` on `element`, once. */
const mark = (element: Element, kind: 'on' | 'pass' | 'watch'): void => {
	const attr = `data-le-truc-${kind}`
	if (!element.hasAttribute(attr)) element.setAttribute(attr, '')
}

/**
 * One `console.debug` entry per firing that also drives a visual effect.
 * Always names the originating component via `elementName(host)`. Drops the
 * target element entirely when there's none to attribute (`watch()` with a
 * handler that isn't `bind*`-produced) rather than printing an
 * "(unattributed)" placeholder — no element is not itself information worth
 * a word in the message.
 */
const log = (
	host: HTMLElement,
	kind: 'on' | 'pass' | 'watch',
	element: Element | undefined,
	value: unknown,
): void => {
	if (kind === 'on') {
		// value is always the raw DOM Event for 'on' firings (see debugFire()
		// call sites in helpers/events.ts) — element is always known too.
		const type = value instanceof Event ? value.type : String(value)
		console.debug(
			`[le-truc debug] on "${type}" in ${elementName(host)} from ${elementName(element)}`,
			value,
		)
	} else if (kind === 'pass') {
		// element (the pass() target) is always known.
		console.debug(
			`[le-truc debug] pass from ${elementName(host)} to ${elementName(element)}`,
			value,
		)
	} else {
		const attribution = element ? ` → ${elementName(element)}` : ''
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
		pulse(element)
	}
	pulse(host)
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
 * Install a single document-level, capture-phase click listener that toggles
 * the nearest custom-element ancestor's `debug` property on `metaKey`+click.
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
			let node = e.composedPath()[0] as Element | null
			while (node && !isCustomElement(node)) node = node.parentElement
			if (!node) return
			const host = node as HTMLElement & { debug?: boolean }
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
		installDebugToggle()
		const state = createState(false)
		const slot = createSlot(state)
		const signals = getSignals(instance)
		signals['debug'] = slot
		Object.defineProperty(instance, 'debug', {
			get: () => slot.get(),
			set: (v: boolean) => slot.set(v),
			enumerable: true,
			configurable: true,
		})
		if (!internals) return
		const setState = bindState(internals, 'debug')
		return [() => createEffect(() => setState(slot.get()))]
	},
})

export { debug, debugFire, markIfDebugging }
