import { type Component, defineComponent } from '../../..'
import { asClampedInteger } from '../../_common/asClampedInteger'

export type BasicPluralizeProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': Component<BasicPluralizeProps>
	}
}

const FALLBACK_LOCALE = 'en'

export default defineComponent<BasicPluralizeProps>(
	'basic-pluralize',
	({ expose, first, host, run }) => {
		const count = first('.count')
		const none = first('.none')
		const some = first('.some')
		const zero = first('.zero')
		const one = first('.one')
		const two = first('.two')
		const few = first('.few')
		const many = first('.many')
		const other = first('.other')

		const pluralizer = new Intl.PluralRules(
			host.closest('[lang]')?.getAttribute('lang') || FALLBACK_LOCALE,
			host.hasAttribute('ordinal') ? { type: 'ordinal' } : undefined,
		)

		expose({
			count: asClampedInteger(),
		})

		const categoryElements: Partial<
			Record<Intl.LDMLPluralRule, HTMLElement | undefined>
		> = {
			zero,
			one,
			two,
			few,
			many,
			other,
		}

		const categories = pluralizer.resolvedOptions().pluralCategories

		return [
			count
				&& run('count', value => {
					count.textContent = String(value)
				}),
			none
				&& run('count', value => {
					none.hidden = value !== 0
				}),
			some
				&& run('count', value => {
					some.hidden = value === 0
				}),
			...categories.map(category => {
				const el = categoryElements[category]
				return (
					el
					&& run('count', value => {
						el.hidden = pluralizer.select(value) !== category
					})
				)
			}),
		]
	},
)
