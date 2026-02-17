import {
	type Component,
<<<<<<< HEAD
	defineComponent,
	Memo,
=======
	createMemo,
	defineComponent,
	type Memo,
>>>>>>> main
	pass,
} from '../..'
import type { BasicButtonProps } from '../basic-button/basic-button'
import type { FormSpinbuttonProps } from '../form-spinbutton/form-spinbutton'

type ModuleCatalogUI = {
	button: Component<BasicButtonProps>
	spinbuttons: Memo<Component<FormSpinbuttonProps>[]>
}

export default defineComponent<{}, ModuleCatalogUI>(
	'module-catalog',
	{},
	({ all, first }) => ({
		button: first('basic-button', 'Add a button to go go the Shopping Cart'),
		spinbuttons: all(
			'form-spinbutton',
			'Add spinbutton components to calculate sum from.',
		),
	}),
	({ spinbuttons }) => {
<<<<<<< HEAD
		const total = new Memo(() =>
=======
		const total = createMemo(() =>
>>>>>>> main
			spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
		)
		return {
			button: pass({
				disabled: () => !total.get(),
				badge: () => (total.get() > 0 ? String(total.get()) : ''),
			}),
		}
	},
)
