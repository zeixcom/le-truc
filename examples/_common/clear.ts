import { type Component, ComponentUI, type Effect, on, show, UI } from '../..'

/**
 * Creates a clear method for input components
 *
 * @param {HTMLInputElement | HTMLTextAreaElement} selector - The native input or textarea element
 */
export const clearMethod = <
	P extends {
		clear: () => void
		value: string | number
		readonly length: number
	},
	U extends {
		host: Component<P>
		textbox: HTMLInputElement | HTMLTextAreaElement
	},
>({
	host,
	textbox,
}: ComponentUI<P, U>) => {
	host.clear = () => {
		host.value = ''
		textbox.value = ''
		textbox.setCustomValidity('')
		textbox.checkValidity()
		textbox.dispatchEvent(new Event('input', { bubbles: true }))
		textbox.dispatchEvent(new Event('change', { bubbles: true }))
		textbox.focus()
	}
}

/**
 * Standard effects for clearing input components on button elements
 *
 * @param {ComponentUI<P, U>} ui - The component UI with a host that has clear, length properties
 * @returns {Effect<P, HTMLElement>[]} - Effects for clearing the input component
 */
export const clearEffects = <
	P extends { clear: () => void; readonly length: number },
	U extends UI,
>(
	ui: ComponentUI<P, U>,
): Effect<P, HTMLElement>[] => [
	show(() => !!ui.host.length),
	on('click', () => {
		ui.host.clear()
	}),
]
