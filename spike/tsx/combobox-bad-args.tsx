/**
 * TSX spike §8 negative fixture (LT-183): a DELIBERATE type error at the
 * compose site — `options` is passed a `string` where form-listbox's real
 * parameter type declares `FormListboxOption[]`. tsc must report this on the
 * AUTHORED PARENT (this file), proving compose type-flow runs through the
 * child's real parameter types without the registry + span remap
 * (ADR 0024 sub-design 6's emit-then-check detour, retired).
 *
 * Excluded from the spike tsconfig (see tsconfig.neg.json) — like
 * jsx-probe-neg.tsx, this file is EXPECTED to fail type-checking; the
 * runner captures the exit code and greps the diagnostic.
 */
import { FormListbox } from './form/listbox/form-listbox.tsx'

export const ComboboxBadArgs = () => (
	<async-el>
		<FormListbox name="x" options="not-an-option-list" />
	</async-el>
)
