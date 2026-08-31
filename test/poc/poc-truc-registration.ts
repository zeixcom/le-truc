/**
 * LT-005 harness probe: element-internals-declaration registration + the
 * axe-core visibility gate (ADR 0026 §3). Prototypes the exact addition
 * §3 proposes for the real `Truc` constructor
 * (`src/component.ts`'s `constructor()`, where `attachInternals()` already
 * runs once per instance — see `internalsMap` there): after a successful
 * `attachInternals()`, also `.set(this, internals)` into
 * `globalThis._elementInternals ??= new WeakMap()`, unconditionally — no
 * `DEV_MODE` gate, since ADR 0026 §3 requires this to work in production
 * builds too (audits run against production).
 *
 * `attachCount` on each instance proves the real constructor's shape (one
 * `attachInternals()` call ever, in the constructor, never repeated on
 * reconnect) carries over unchanged: the registration line added here rides
 * along the same one-time call, so there is nothing new to leak across
 * connect/disconnect cycles.
 *
 * `<poc-reg-button-trap>` reproduces the "silent-pass → flagged" trap ADR
 * 0026 §3's Context describes for `role="button"`: `internals.role =
 * 'button'`, no native `<button>`, plus a content attribute
 * (`aria-checked`) that is invalid for the button role (a consumer/SSR
 * authoring mistake, unrelated to the internals wiring itself — the two
 * channels are deliberately independent per ADR 0026 §1). Before the
 * registry sees the element, axe cannot compute its role, so it evaluates
 * `aria-checked` against no role constraint at all and stays silent. Once
 * registered, axe computes `role: 'button'` (via `elementInternals.role`,
 * consulted as a fallback when there is no `role` *attribute* — see
 * `_getElementInternals`/`VirtualNode#elementInternals` in axe-core) and
 * `aria-allowed-attr` correctly flags `aria-checked` as not allowed on a
 * button. `aria-allowed-attr` has no `[role]`-attribute selector
 * restriction (unlike `aria-required-attr`/`aria-required-parent`/
 * `aria-required-children`, confirmed empirically — see README.md), so it
 * runs on every element regardless of whether the role came from an
 * attribute or from internals, which is exactly what makes it able to
 * demonstrate the flip.
 *
 * `<poc-reg-button-ok>` is the negative control: identical registration,
 * `internals.role = 'button'`, no invalid attribute — proves registration
 * does not blanket-flag every internals-role element.
 *
 * `<poc-unreg-button-trap>` is the pre-ADR-0026-§3 baseline: identical
 * `internals.role`/`aria-checked` setup as the trap, but deliberately never
 * calls `registry.set()` — this is what every component looks like today,
 * before the real `Truc` constructor gains the registration line. Comparing
 * it against `<poc-reg-button-trap>` on the same page, in the same
 * `axe.run()` pass, is the actual "silent-pass → flagged" comparison this
 * task needs — not deleting a registry entry mid-session and re-running axe,
 * which does not reproduce the pre-registration state: axe-core caches
 * `elementInternals` per DOM node across separate `axe.run()` calls on the
 * same page (confirmed empirically — a deleted registry entry did not
 * un-flag a previously-flagged node), so within one page load the only valid
 * "before" comparison is a node that was never registered in the first
 * place.
 */
interface PocRegistry {
	_elementInternals?: WeakMap<Element, ElementInternals>
}

const registry = ((globalThis as PocRegistry)._elementInternals ??=
	new WeakMap()) as WeakMap<Element, ElementInternals>

class PocRegButtonTrap extends HTMLElement {
	#internals: ElementInternals
	attachCount = 0

	constructor() {
		super()
		this.attachCount++
		this.#internals = this.attachInternals()
		// The line ADR 0026 §3 proposes adding to the real Truc constructor —
		// unconditional, not gated on DEV_MODE.
		registry.set(this, this.#internals)
		this.#internals.role = 'button'
	}

	get internals(): ElementInternals {
		return this.#internals
	}
}

if (!customElements.get('poc-reg-button-trap'))
	customElements.define('poc-reg-button-trap', PocRegButtonTrap)

class PocRegButtonOk extends HTMLElement {
	#internals: ElementInternals
	attachCount = 0

	constructor() {
		super()
		this.attachCount++
		this.#internals = this.attachInternals()
		registry.set(this, this.#internals)
		this.#internals.role = 'button'
	}
}

if (!customElements.get('poc-reg-button-ok'))
	customElements.define('poc-reg-button-ok', PocRegButtonOk)

class PocUnregButtonTrap extends HTMLElement {
	#internals: ElementInternals

	constructor() {
		super()
		this.#internals = this.attachInternals()
		// Deliberately NOT calling registry.set() — the pre-LT-005 baseline.
		this.#internals.role = 'button'
	}
}

if (!customElements.get('poc-unreg-button-trap'))
	customElements.define('poc-unreg-button-trap', PocUnregButtonTrap)

declare global {
	interface HTMLElementTagNameMap {
		'poc-reg-button-trap': PocRegButtonTrap
		'poc-reg-button-ok': PocRegButtonOk
		'poc-unreg-button-trap': PocUnregButtonTrap
	}
}
