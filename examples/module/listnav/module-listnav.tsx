/**
 * Wave-4 migration (LT-107) of the hand-written module-listnav.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template composes the compiled `form-listbox` (flat, filterable
 * options) and `module-lazyload`, whose `src` starts at the selected value.
 * The page's real occurrences are authored by the `listnav` Markdoc schema
 * (grouped options), which never pass through this render. The client
 * addresses both children by tag, so it binds to either markup.
 *
 * Deviations from the twin, all setup-subset driven:
 * - the hash helpers move into `listnav-hash.ts` as pure functions of the
 *   first option's value (module-scope names are not client-known, LTC005),
 *   and `module-listnav.test.ts` now tests that module instead of a copy;
 * - `updatingHash` becomes a field of a const record (a `let` is outside the
 *   setup subset);
 * - `pass(lazyload, { src: () => listbox.value })` is spelled `truc:pass` on
 *   the compose site.
 * The initial hash sync stays deferred to effect activation (LT-200).
 */

import { batch, createEffect, type FactoryContext } from '@zeix/le-truc'
import { FormListbox } from '../../form/listbox/form-listbox.tsx'
import { ModuleLazyload } from '../lazyload/module-lazyload.tsx'
import { hashToValue, valueToHash } from './listnav-hash'

/** One page: `value` is the relative path the lazyload fetches. */
export type ModuleListnavOption = {
	value: string
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-listnav': HTMLElement
	}
}

/**
 * Connects a listbox and a lazyload panel, syncing the selection with the URL hash for shareable navigation.
 * Use it for master-detail navigation — the listbox provides keyboard-accessible option
 * selection and the selection state syncs to the URL for deep linking.
 * Listbox option values must be relative paths (starting with `./`);
 * the lazyload panel should have an `id` matching the hash target for scroll restoration.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-listnav} Interactive preview and usage examples
 **/
export function ModuleListnav(
	{
		title = 'Navigation',
		options,
		value,
	}: {
		/** The listbox's accessible name. */
		title?: string
		/** The pages to navigate; each `value` is a relative path (`./…`). */
		options: ModuleListnavOption[]
		/** The initially selected page; defaults to the first option. */
		value?: string
	},
	{ first, watch }: FactoryContext<Record<never, never>>,
) {
	const listbox = first('form-listbox', 'Required to select a partial to load')

	// Read the listbox through its public surface, never its owned markup
	// (HOST_PROFILE § data account, bullet 3; LT-332).
	const firstOptionValue = () => listbox.options[0]?.value ?? ''

	const hasOption = (value: string): boolean =>
		listbox.options.some(option => option.value === value)

	// Track whether we're updating the hash ourselves to avoid loops
	const hashState = { updating: false }

	// Update selection when hash changes (browser back/forward)
	const onHashChange = () => {
		if (hashState.updating) return

		const value = hashToValue(location.hash, firstOptionValue())
		if (value && value !== listbox.value && hasOption(value)) {
			batch(() => {
				listbox.filter = ''
				listbox.value = value
			})
		}
	}

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
					hashState.updating = true
					history.replaceState(null, '', `#${hash}`)
					hashState.updating = false
				}
			})

			window.addEventListener('hashchange', onHashChange)

			return () => {
				cleanup()
				window.removeEventListener('hashchange', onHashChange)
			}
		},
	)

	return (
		<>
			<module-listnav>
				<nav>
					<FormListbox
						name="page"
						ariaLabel={title}
						options={options}
						value={value ?? options[0]?.value ?? ''}
						filterable
					/>
				</nav>
				<ModuleLazyload
					src={value ?? options[0]?.value ?? ''}
					truc:pass={{ src: () => listbox.value }}
				/>
			</module-listnav>
			<style>{css`
module-listnav module-lazyload {
	contain: inline-size;
}

@container (width > 45em) {
	module-listnav {
		display: grid;
		grid-template-columns: 1fr 3fr;
		gap: var(--space-xl);

		& module-lazyload {
			& h1,
			& h2,
			& h3,
			& h4,
			& h5,
			& h6 {
				margin-top: 0;
			}
		}
	}
}
`}</style>
		</>
	)
}
