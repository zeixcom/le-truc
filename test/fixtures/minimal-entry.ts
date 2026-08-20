// Fixture for the bundle-size regression test: the smallest realistic
// consumer surface — a component with one reactive property synced to a
// DOM element, using no extensions. Proves that a consumer who never
// imports an extension (`formAssociated()`, `observedAttributes()`, ...)
// never bundles its module, since `component.ts` only references the
// generic `ComponentExtension` shape at the value level, never a concrete
// feature module. See ADR on the `ComponentExtension` mechanism.
import { bindText, defineComponent } from '../../index'

defineComponent<{ count: number }>(
	'minimal-counter',
	({ expose, first, host, on, watch }) => {
		const button = first('button', 'Needed to increment the count.')
		const output = first('output', 'Needed to display the count.')

		expose({ count: 0 })

		on(button, 'click', () => ({ count: host.count + 1 }))
		watch('count', bindText(output))
	},
)
