import {
	type Component,
	createEffect,
	defineComponent,
	type Memo,
	on,
	read,
} from '../..'
import { manageFocus } from '../_common/focus'

export type FormRadiogroupProps = {
	value: string
}

type FormRadiogroupUI = {
	radios: Memo<HTMLInputElement[]>
}

declare global {
	interface HTMLElementTagNameMap {
		'form-radiogroup': Component<FormRadiogroupProps>
	}
}

const getIndex = (radios: HTMLInputElement[]) =>
	radios.findIndex(radio => radio.checked)

export default defineComponent<FormRadiogroupProps, FormRadiogroupUI>(
	'form-radiogroup',
	{
		value: read(({ radios }) => {
			const radiosArray = radios.get()
			return radiosArray[getIndex(radiosArray)]?.value
		}, ''),
	},
	({ all }) => ({
		radios: all(
			'input[type="radio"]',
			'Add at least two native radio buttons.',
		),
	}),
	({ host, radios }) => ({
		host: manageFocus(() => radios.get(), getIndex),
		radios: [
			on('change', e => {
				host.value = (e.target as HTMLInputElement).value
			}),
			(_host, target) =>
				createEffect(() => {
					const isChecked = target.value === host.value
					target.checked = isChecked
					target.tabIndex = isChecked ? 0 : -1
					const label = target.closest('label')
					if (label) label.classList.toggle('selected', isChecked)
				}),
		],
	}),
)
