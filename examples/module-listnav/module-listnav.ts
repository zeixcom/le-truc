import { type Component, defineComponent, pass } from '../..'
import type { FormListboxProps } from '../form-listbox/form-listbox'
import type { ModuleLazyloadProps } from '../module-lazyload/module-lazyload'

type ModuleListnavUI = {
	listbox: Component<FormListboxProps>
	lazyload: Component<ModuleLazyloadProps>
}

export default defineComponent<{}, ModuleListnavUI>(
	'module-listnav',
	{},
	({ first }) => ({
		listbox: first('form-listbox', 'Required to select a partial to load'),
		lazyload: first('module-lazyload', 'Required to load a partial into'),
	}),
	({ listbox }) => ({
		lazyload: pass({ src: () => listbox.value }),
	}),
)
