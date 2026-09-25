import { batch, createEffect, defineComponent } from '@zeix/le-truc'
import { hashToValue, valueToHash } from './listnav-hash'

/**
 * Connects a listbox and a lazyload panel, syncing the selection with the URL hash for shareable navigation.
 * Use it for master-detail navigation — the listbox provides keyboard-accessible option
 * selection and the selection state syncs to the URL for deep linking.
 * Listbox option values must be relative paths (starting with `./`);
 * the lazyload panel should have an `id` matching the hash target for scroll restoration.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-listnav} Interactive preview and usage examples
 **/
export default defineComponent('module-listnav', ({ first, pass, watch }) => {
	const listbox = first('form-listbox', 'Required to select a partial to load')
	const lazyload = first('module-lazyload', 'Required to load a partial into')

	// Read the listbox through its public surface, never its owned markup
	// (HOST_PROFILE § data account, bullet 3; LT-332).
	const firstOptionValue = () => listbox.options[0]?.value ?? ''

	const hasOption = (value: string): boolean =>
		listbox.options.some(option => option.value === value)

	// Track whether we're updating the hash ourselves to avoid loops
	let updatingHash = false

	// Update selection when hash changes (browser back/forward)
	const onHashChange = () => {
		if (updatingHash) return

		const value = hashToValue(location.hash, firstOptionValue())
		if (value && value !== listbox.value && hasOption(value)) {
			batch(() => {
				listbox.filter = ''
				listbox.value = value
			})
		}
	}

	pass(lazyload, { src: () => listbox.value })

	// Sync location.hash ↔ listbox selection — no signal dependency, so
	// watch(() => true, …) runs the setup once on connect and its returned
	// cleanup tears both listeners down on disconnect.
	watch(
		() => true,
		() => {
			// Set initial selection from hash — deferred to effect activation:
			// with dynamic composition the listbox may not have connected when
			// our factory runs (parent-first connectedCallback order for
			// inserted subtrees), and a synchronous write would land before
			// its signal exists.
			if (location.hash) {
				const value = hashToValue(location.hash, firstOptionValue())
				if (value && hasOption(value)) listbox.value = value
			}

			// Update hash when selection changes
			const cleanup = createEffect(() => {
				const value = listbox.value
				if (!value) return

				const hash = valueToHash(value, firstOptionValue())
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
	)
})
