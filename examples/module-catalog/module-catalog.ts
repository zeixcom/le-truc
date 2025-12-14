import {
	type Collection,
	type Component,
	createComputed,
	defineComponent,
	pass,
} from '../..'
import { BasicButtonProps } from '../basic-button/basic-button'
import { FormSpinbuttonProps } from '../form-spinbutton/form-spinbutton'

type ModuleCatalogUI = {
	button: Component<BasicButtonProps>
	spinbuttons: Collection<Component<FormSpinbuttonProps>>
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
		const total = createComputed(() =>
			spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
		)
		return {
			button: [
				pass({
					disabled: () => !total.get(),
					badge: () => (total.get() > 0 ? String(total.get()) : ''),
				}),
			],
		}
	},
)
