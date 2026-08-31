/**
 * LT-002 harness probe: the no-mixing wrinkle (ADR 0026 §1 note, "server
 * HTML carrying e.g. aria-expanded='false' while the component reflects
 * runtime state via internals"). A raw custom element with
 * `internals.role = 'button'` and a runtime `expanded` state reflected via
 * `internals.ariaExpanded` — the same shape as any disclosure/combobox
 * trigger's expanded semantics.
 *
 * The `mitigate` attribute selects the two scenarios under test:
 *   absent  — the failure mode: a stale server-rendered `aria-expanded`
 *             content attribute permanently shadows the internals value in
 *             the computed tree, because the platform's default-semantics
 *             model always lets a host attribute win (LT-001 finding 3).
 *   present — the mitigation: on connect, before reflecting via internals,
 *             the component removes its own stale attribute for the
 *             property it owns — restoring internals authority. This is the
 *             no-mixing rule (ADR 0026 §1) applied defensively for the case
 *             where a consumer (or SSR) authored the attribute without
 *             knowing the component manages it at runtime.
 *
 * LT-013: focusable + clickable, so `expand()`/`collapse()` can be toggled
 * in place under a manual VoiceOver/NVDA pass — previously only reachable
 * from a console or Playwright.
 */
interface PocRegistry {
	_elementInternals?: WeakMap<Element, ElementInternals>
}

const registry = ((globalThis as PocRegistry)._elementInternals ??=
	new WeakMap()) as WeakMap<Element, ElementInternals>

class PocStaleExpanded extends HTMLElement {
	#internals: ElementInternals
	#expanded = false

	constructor() {
		super()
		this.#internals = this.attachInternals()
		registry.set(this, this.#internals)
		this.#internals.role = 'button'
		this.tabIndex = 0
	}

	connectedCallback() {
		if (this.hasAttribute('mitigate')) this.removeAttribute('aria-expanded')
		this.#internals.ariaExpanded = 'false'
		this.addEventListener('click', this.#onClick)
		this.addEventListener('keydown', this.#onKeyDown)
	}

	disconnectedCallback() {
		this.removeEventListener('click', this.#onClick)
		this.removeEventListener('keydown', this.#onKeyDown)
	}

	expand(): void {
		this.#expanded = true
		this.#internals.ariaExpanded = 'true'
	}

	collapse(): void {
		this.#expanded = false
		this.#internals.ariaExpanded = 'false'
	}

	#onClick = () => {
		if (this.#expanded) this.collapse()
		else this.expand()
	}

	/* role="button" carries no native activation — Enter/Space must be
	   wired by hand, per the ARIA authoring practices button pattern. */
	#onKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			this.#onClick()
		}
	}
}

if (!customElements.get('poc-stale-expanded'))
	customElements.define('poc-stale-expanded', PocStaleExpanded)

declare global {
	interface HTMLElementTagNameMap {
		'poc-stale-expanded': PocStaleExpanded
	}
}
