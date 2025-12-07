import { createEffect, createState, type Signal } from '@zeix/cause-effect'

type VanillaCheckboxProps = {
	checked: boolean
	label: string
}

type VanillaCheckboxUI = {
	checkbox: HTMLInputElement
	label: HTMLLabelElement
}

declare global {
	interface HTMLElementTagNameMap {
		'vanilla-checkbox': HTMLElement & VanillaCheckboxProps
	}
}

export default class VanillaCheckbox extends HTMLElement {
	checked: boolean
	label: string

	#signals = {} as {
		[K in keyof VanillaCheckboxProps]: Signal<VanillaCheckboxProps[K]>
	}
	#cleanups = [] as (() => void)[]
	#ui = {} as VanillaCheckboxUI

	static observedAttributes = ['checked', 'label']

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		if (newValue === oldValue) return
		const parsed = name === 'checked' ? newValue != null : newValue
		if (name in this) this[name] = parsed
		else this.#setAccessor(name, parsed)
	}

	connectedCallback() {
		// Initialize UI elements
		const ui = { checkbox: 'input[type="checkbox"]', label: '.label' }
		for (const element of Object.keys(ui)) {
			this.#ui[element] = this.querySelector(ui[element])
			if (!this.#ui[element])
				this.#throwMissingElementError(ui[element], `Add a native ${element}.`)
		}
		Object.freeze(this.#ui)

		// Initialize reactive properties
		for (const prop of Object.keys(VanillaCheckbox.observedAttributes)) {
			if (prop in this) continue
			const defaultValue =
				prop === 'label' ? this.#ui.label.textContent.trim() : false
			this.#setAccessor(prop, defaultValue)
		}

		// Setup event listeners
		const changeHandler = (e: Event) => {
			this.checked = (e.target as HTMLInputElement).checked
		}
		this.#ui.checkbox.addEventListener('change', changeHandler)
		this.#cleanups.push(() =>
			this.#ui.checkbox.removeEventListener('change', changeHandler),
		)

		// Setup effects
		this.#cleanups.push(
			createEffect(() => {
				this.#ui.checkbox.checked = this.checked
			}),
		)
		this.#cleanups.push(
			createEffect(() => {
				this.#ui.label.textContent = this.label
			}),
		)
	}

	disconnectedCallback() {
		this.#cleanups.forEach(cleanup => cleanup())
		this.#cleanups.length = 0
	}

	#setAccessor(key: string, value: any) {
		const signal = createState(value)
		this.#signals[key] = signal
		Object.defineProperty(this, key, {
			get: signal.get,
			set: signal.set,
			enumerable: true,
			configurable: true,
		})
	}

	#throwMissingElementError(selector: string, required: string) {
		throw new Error(
			`Missing required element <${selector}> in component <form-checkbox>. ${required}`,
		)
	}
}

customElements.define('vanilla-checkbox', VanillaCheckbox)
