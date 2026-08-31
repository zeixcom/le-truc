/**
 * LT-003 edge-case probe: does an element-reference ARIA property require
 * its target to be an upgraded (`:defined`) custom element at wiring time?
 *
 * Le Truc's own `first()`/`all()` collect undefined custom-element targets
 * as dependencies and defer effect activation up to `DEPENDENCY_TIMEOUT`
 * (200ms) waiting for `customElements.whenDefined()` (src/helpers/dom.ts) —
 * a deliberate progressive-enhancement mechanism for reading a *child
 * component's own exposed properties*. Element-reference ARIA properties
 * are a different thing entirely: they only need the target's identity as
 * an `Element` node, not its class behavior, so nothing here should need to
 * wait for anything.
 *
 * `<late-target-el>` in pages/combobox.html is an unregistered custom
 * element tag (`:not(:defined)`, plain `HTMLElement` per the HTML spec)
 * placed *before* this probe in the markup, so it already exists in the DOM
 * when this constructor runs. The constructor wires `ariaDescribedByElements`
 * to it synchronously, with no dependency collection, no microtask defer,
 * and no timeout — proving the immunity ADR 0026's LT-003 Context calls for.
 */
interface PocRegistry {
	_elementInternals?: WeakMap<Element, ElementInternals>
}

const registry = ((globalThis as PocRegistry)._elementInternals ??=
	new WeakMap()) as WeakMap<Element, ElementInternals>

class PocLateRef extends HTMLElement {
	#internals: ElementInternals

	constructor() {
		super()
		this.#internals = this.attachInternals()
		registry.set(this, this.#internals)
		this.#internals.role = 'button'
		const targetId = this.getAttribute('target-id')
		const target = targetId ? document.getElementById(targetId) : null
		if (target) this.#internals.ariaDescribedByElements = [target]
	}
}

if (!customElements.get('poc-late-ref'))
	customElements.define('poc-late-ref', PocLateRef)

declare global {
	interface HTMLElementTagNameMap {
		'poc-late-ref': PocLateRef
	}
}
