// Fixture for the bundle-size regression test: `defineComponent` plus the
// `formAssociated()` extension — the most common opt-in feature, and the
// heaviest bundled extension (ElementInternals support). A consumer who
// imports this pays for `extensions/form.ts`; one who doesn't (see
// minimal-entry.ts) does not. Mirrors the `form-textbox` example from
// docs-src/pages/components.md: a reactive `value` prop synced to the
// underlying native control.
import { bindProperty } from '../../src/bindings'
import { defineComponent } from '../../src/component'
import { formAssociated } from '../../src/extensions/form'

type CoreFormTextboxProps = { value: string }

defineComponent<CoreFormTextboxProps>(
	'core-form-textbox',
	({ expose, first, on, watch }) => {
		const textbox = first('input, textarea', 'Needed for form input.')

		expose({ value: textbox.value })

		on(textbox, 'input', () => ({ value: textbox.value }))
		watch('value', bindProperty(textbox, 'value'))
	},
	[formAssociated()],
)
