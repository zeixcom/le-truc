/**
 * LT-002 harness probe: host default-semantics channel — the colorgraph hue
 * slider as the hardest real case (ADR 0026 §1, "component-owned default
 * semantics on the host"). Raw custom element (same rationale as
 * poc-basic.ts: isolates the platform channel from the library — bindAria()
 * itself is LT-004's work), modeled on the real slider in
 * examples/form/colorgraph/form-colorgraph.ts.
 *
 * `internals.role = 'slider'` with `aria-valuemin`/`aria-valuemax` set once
 * (static bounds); `aria-valuenow`/`aria-valuetext` are reactive, updated at
 * pointermove frequency through cause-effect's `throttle()` — the same
 * dedup-per-animation-frame primitive form-colorgraph uses for its knob and
 * thumb drag handlers (M5: no unthrottled churn in the signal graph).
 *
 * All four properties are internals-only, per ADR 0026 §1 and its no-mixing
 * rule — see README.md for why an earlier draft of this probe mirrored
 * valuenow/valuetext to content attributes too: that was working around a
 * finding that turned out to be a typo (`ariaValuenow` vs. the real
 * `ariaValueNow`), not a platform gap. Once corrected, internals-only maps
 * cleanly, so mirroring would violate the no-mixing rule for no reason.
 *
 * `setHue(deg)` is the deterministic test entry point — it drives the same
 * throttled path a real pointermove handler would, without simulating
 * actual pointer events.
 *
 * LT-013: ArrowLeft/ArrowRight also drive `setHue()`, keyed to focus rather
 * than pointer capture — without this a manual VoiceOver/NVDA pass has no
 * way to trigger the live `valuenow`/`valuetext` announcements at all, only
 * `setHue()` calls from a console or Playwright.
 *
 * LT-004: the reactive `ariaValueNow`/`ariaValueText` writes go through
 * `bindAria()` (poc-bind-aria.ts), invoked imperatively — this is a raw
 * custom element with no cause-effect signal graph (`throttle()` drives a
 * plain class field, not a signal), so there is no `watch()` source to hand
 * `bindAria`'s `SingleMatchHandlers` to. Calling `.ok()` directly proves the
 * helper works standalone, not just wired through `watch()`. The static
 * `role`/`ariaValueMin`/`ariaValueMax` writes stay untouched, imperative
 * `internals.*` assignments — ADR 0026 §2 reserves `bindAria()` for
 * *reactive* bindings; a one-time statement is already shorter than a
 * helper call.
 */
import { throttle } from '../../index'
import { bindAria } from './poc-bind-aria'

interface PocRegistry {
	_elementInternals?: WeakMap<Element, ElementInternals>
}

const registry = ((globalThis as PocRegistry)._elementInternals ??=
	new WeakMap()) as WeakMap<Element, ElementInternals>

const fmtDeg = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
	.format

class PocHueSlider extends HTMLElement {
	#internals: ElementInternals
	#hue = 0
	#setValueNow: ((deg: number) => void) & { cancel: () => void }
	#flushCount = 0

	constructor() {
		super()
		this.#internals = this.attachInternals()
		registry.set(this, this.#internals)
		this.#internals.role = 'slider'
		this.#internals.ariaValueMin = '0'
		this.#internals.ariaValueMax = '360'
		this.tabIndex = 0
		const setValueNow = bindAria(this.#internals, 'ariaValueNow')
		const setValueText = bindAria(this.#internals, 'ariaValueText')
		this.#setValueNow = throttle((deg: number) => {
			this.#flushCount++
			setValueNow.ok(deg)
			setValueText.ok(`${fmtDeg(deg)}°`)
		})
	}

	connectedCallback() {
		this.addEventListener('pointerdown', this.#onPointerDown)
		this.addEventListener('keydown', this.#onKeyDown)
		this.setHue(0)
	}

	disconnectedCallback() {
		this.removeEventListener('pointerdown', this.#onPointerDown)
		this.removeEventListener('keydown', this.#onKeyDown)
		this.#setValueNow.cancel()
	}

	/** Deterministic test entry point — bypasses real pointer simulation. */
	setHue(deg: number): void {
		this.#hue = Math.min(Math.max(deg, 0), 360)
		this.#setValueNow(this.#hue)
	}

	/** Call counter for the throttled sink, exposed for dedup assertions. */
	get flushCount(): number {
		return this.#flushCount
	}

	#onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'ArrowRight') {
			event.preventDefault()
			this.setHue(this.#hue + 5)
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault()
			this.setHue(this.#hue - 5)
		}
	}

	#onPointerDown = (event: PointerEvent) => {
		const rect = this.getBoundingClientRect()
		this.setPointerCapture(event.pointerId)
		const move = (e: PointerEvent) => {
			const last = (e.getCoalescedEvents?.() || []).pop() || e
			const x = Math.min(Math.max(last.clientX - rect.left, 0), rect.width)
			this.setHue((x / rect.width) * 360)
		}
		const up = () => {
			this.removeEventListener('pointermove', move)
			this.removeEventListener('pointerup', up)
			this.removeEventListener('pointercancel', up)
		}
		this.addEventListener('pointermove', move, { passive: true })
		this.addEventListener('pointerup', up)
		this.addEventListener('pointercancel', up)
	}
}

if (!customElements.get('poc-hue-slider'))
	customElements.define('poc-hue-slider', PocHueSlider)

declare global {
	interface HTMLElementTagNameMap {
		'poc-hue-slider': PocHueSlider
	}
}
