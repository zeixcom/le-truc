import {
	batch,
	type Component,
	createEffect,
	defineComponent,
	pass,
} from '../..'
import type { FormListboxProps } from '../form-listbox/form-listbox'
import type { ModuleLazyloadProps } from '../module-lazyload/module-lazyload'

type ModuleListnavUI = {
	listbox: Component<FormListboxProps>
	lazyload: Component<ModuleLazyloadProps>
}

/**
 * Extract the base path (first path segment) from an option value.
 * "./examples/form-combobox.html" → "./examples/"
 * "./api/functions/defineComponent.html" → "./api/"
 */
const getBasePath = (
	listbox: HTMLElement,
): { base: string; ext: string } | null => {
	const firstOption = listbox.querySelector<HTMLButtonElement>(
		'button[role="option"]',
	)
	if (!firstOption?.value) return null

	const value = firstOption.value
	// Handle relative paths starting with "./"
	if (!value.startsWith('./')) return null

	// Find the second slash to get the first path segment: "./examples/"
	const secondSlash = value.indexOf('/', 2)
	if (secondSlash === -1) return null

	return {
		base: value.slice(0, secondSlash + 1),
		ext: value.slice(value.lastIndexOf('.')),
	}
}

/**
 * Derive the option value from a location hash.
 * "#functions/defineComponent" → "./api/functions/defineComponent.html"
 * "#form-combobox" → "./examples/form-combobox.html"
 */
const hashToValue = (hash: string, listbox: HTMLElement): string | null => {
	if (!hash) return null
	const fragment = hash.slice(1)
	if (!fragment) return null

	const paths = getBasePath(listbox)
	if (!paths) return null

	return `${paths.base}${fragment}${paths.ext}`
}

/**
 * Derive a hash fragment from an option value.
 * "./api/functions/defineComponent.html" → "functions/defineComponent"
 * "./examples/form-combobox.html" → "form-combobox"
 */
const valueToHash = (value: string, listbox: HTMLElement): string => {
	if (!value) return ''

	const paths = getBasePath(listbox)
	if (!paths) return ''

	let hash = value
	if (hash.startsWith(paths.base)) hash = hash.slice(paths.base.length)
	const dotIndex = hash.lastIndexOf('.')
	if (dotIndex > 0) hash = hash.slice(0, dotIndex)

	return hash
}

export default defineComponent<{}, ModuleListnavUI>(
	'module-listnav',
	{},
	({ first }) => ({
		listbox: first('form-listbox', 'Required to select a partial to load'),
		lazyload: first('module-lazyload', 'Required to load a partial into'),
	}),
	({ listbox }) => {
		const hasOption = (value: string): boolean =>
			!!listbox.querySelector(
				`button[role="option"][value="${CSS.escape(value)}"]`,
			)

		// Set initial selection from hash
		if (location.hash) {
			const value = hashToValue(location.hash, listbox)
			if (value && hasOption(value)) listbox.value = value
		}

		// Track whether we're updating the hash ourselves to avoid loops
		let updatingHash = false

		// Update selection when hash changes (browser back/forward)
		const onHashChange = () => {
			if (updatingHash) return

			const value = hashToValue(location.hash, listbox)
			if (value && value !== listbox.value && hasOption(value)) {
				batch(() => {
					listbox.filter = ''
					listbox.value = value
				})
			}
		}

		return {
			lazyload: pass({ src: () => listbox.value }),

			// Sync location.hash ↔ listbox selection
			host: () => {
				// Update hash when selection changes
				const cleanup = createEffect(() => {
					const value = listbox.value
					if (!value) return

					const hash = valueToHash(value, listbox)
					if (hash && location.hash !== `#${hash}`) {
						updatingHash = true
						history.replaceState(null, '', `#${hash}`)
						updatingHash = false
					}
				})

				window.addEventListener('hashchange', onHashChange)

				return () => {
					cleanup()
					window.removeEventListener('hashchange', onHashChange)
				}
			},
		}
	},
)
