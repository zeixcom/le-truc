import {
	asClampedInteger,
	bindText,
	bindVisible,
	defineComponent,
} from '../../..'
import { getLocale } from '../../_common/getLocale'

export type BasicPluralizeProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': HTMLElement & BasicPluralizeProps
	}
}

export default defineComponent<BasicPluralizeProps>(
	'basic-pluralize',
	({ expose, first, host, watch }) => {
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
			getLocale(host),
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
			count && watch('count', bindText(count)),
			none && watch(() => host.count === 0, bindVisible(none)),
			some && watch(() => host.count !== 0, bindVisible(some)),
			...categories.map(category => {
				const el = categoryElements[category]
				return (
					el
					&& watch(
						() => pluralizer.select(host.count) === category,
						bindVisible(el),
					)
				)
			}),
		]
	},
)
