import {
	type Component,
	createMemo,
	defineComponent,
	type Effect,
	type Memo,
	pass,
} from '../..'
import type { BasicButtonProps } from '../basic-button/basic-button'
import type { FormSpinbuttonProps } from '../form-spinbutton/form-spinbutton'

type ModuleCatalogProps = Record<string, never>

type ModuleCatalogUI = {
	button: Component<BasicButtonProps>
	vanillaButton?: HTMLElement
	spinbuttons: Memo<Component<FormSpinbuttonProps>[]>
}

export default defineComponent<ModuleCatalogProps, ModuleCatalogUI>(
	'module-catalog',
	{},
	({ all, first }) => ({
		button: first('basic-button', 'Add a button to go to the Shopping Cart'),
		vanillaButton: first('vanilla-button'),
		spinbuttons: all(
			'form-spinbutton',
			'Add spinbutton components to calculate sum from.',
		),
	}),
	({ spinbuttons }) => {
		const total = createMemo(() =>
			spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
		)
		const passProps = pass<ModuleCatalogProps, BasicButtonProps>({
			disabled: () => !total.get(),
			badge: () => (total.get() > 0 ? String(total.get()) : ''),
		})
		return {
			button: passProps,
			// Cast: pass() also works on vanilla CEs via Object.defineProperty (Path B)
			vanillaButton: passProps as unknown as Effect<ModuleCatalogProps, HTMLElement>,
		}
	},
)
