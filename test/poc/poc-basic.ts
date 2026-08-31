/**
 * LT-001 harness probe: a throwaway raw custom element (deliberately NOT a
 * le-truc component — this isolates the platform from the library while the
 * harness itself is being verified). Three instances live on `basic.html`,
 * switched by the `mode` attribute:
 *
 *   internals — semantics set ONLY via ElementInternals (default semantics)
 *   attribute — identical semantics via content attributes only
 *   both      — internals defaults + overriding content attributes
 *
 * Also populates the element-internals-declaration registry
 * (`globalThis._elementInternals` WeakMap) per instance, which is what the
 * axe-core tier of the harness reads. The real library-side registration in
 * the `Truc` constructor is LT-005's work — this is the inline PoC stand-in.
 */
interface PocRegistry {
	_elementInternals?: WeakMap<Element, ElementInternals>
}

const registry = ((globalThis as PocRegistry)._elementInternals ??=
	new WeakMap()) as WeakMap<Element, ElementInternals>

class PocProbe extends HTMLElement {
	#internals: ElementInternals

	constructor() {
		super()
		this.#internals = this.attachInternals()
		registry.set(this, this.#internals)
		const mode = this.getAttribute('mode')
		if (mode !== 'internals' && mode !== 'both') return
		this.#internals.role = 'progressbar'
		this.#internals.ariaLabel =
			mode === 'both' ? 'Internals both' : 'Internals only'
		this.#internals.ariaValuenow = '42'
	}
}

if (!customElements.get('poc-probe'))
	customElements.define('poc-probe', PocProbe)
