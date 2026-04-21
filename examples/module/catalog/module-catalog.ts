import { createMemo, defineComponent } from '../../..'

declare global {
	interface HTMLElementTagNameMap {
		'module-catalog': HTMLElement
	}
}

export default defineComponent('module-catalog', ({ all, first, pass }) => {
	const button = first(
		'basic-button',
		'Add a button to go to the Shopping Cart',
	)
	const spinbuttons = all(
		'form-spinbutton',
		'Add spinbutton components to calculate sum from.',
	)
	const total = createMemo(() =>
		spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
	)

	return [
		pass(button, {
			disabled: () => !total.get(),
			badge: () => (total.get() > 0 ? String(total.get()) : ''),
		}),
	]
})
