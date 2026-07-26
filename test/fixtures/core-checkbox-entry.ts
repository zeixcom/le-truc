// Fixture for the bundle-size regression test: `defineComponent` plus the
// `formAssociatedCheckbox()` extension — verifies it tree-shakes
// independently of `formAssociated()`'s value-sync/reset code, even though
// both live in src/extensions/form.ts and share the host-contract table.
// Mirrors the `form-checkbox` example from docs-src/pages/components.md: a
// reactive `checked` prop synced to the underlying native checkbox.
import { bindProperty } from '../../src/bindings'
import { defineComponent } from '../../src/component'
import { formAssociatedCheckbox } from '../../src/extensions/form'
import { asBoolean } from '../../src/parsers/boolean'

type CoreFormCheckboxProps = { checked: boolean }

defineComponent<CoreFormCheckboxProps>(
	'core-form-checkbox',
	({ expose, first, on, watch }) => {
		const checkbox = first('input[type="checkbox"]', 'Needed for form input.')

		expose({ checked: asBoolean() })

		on(checkbox, 'change', () => ({ checked: checkbox.checked }))
		watch('checked', bindProperty(checkbox, 'checked'))
	},
	[formAssociatedCheckbox()],
)
