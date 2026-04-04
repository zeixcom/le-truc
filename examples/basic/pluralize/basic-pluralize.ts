import { type Component, defineComponent, setText, show } from '../../..'
import { asClampedInteger } from '../../_common/asClampedInteger'

export type BasicPluralizeProps = {
	count: number
}

type BasicPluralizeUI = Partial<
	Record<
		| 'count'
		| 'none'
		| 'some'
		| 'zero'
		| 'one'
		| 'two'
		| 'few'
		| 'many'
		| 'other',
		HTMLElement | undefined
	>
>

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': Component<BasicPluralizeProps>
	}
}

const FALLBACK_LOCALE = 'en'

export default defineComponent<BasicPluralizeProps, BasicPluralizeUI>(
	'basic-pluralize',
	({ first, host }) => {
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

		// Basic effects
		const effects: {
			count: ReturnType<typeof setText>
			none: ReturnType<typeof show>
			some: ReturnType<typeof show>
		} & Partial<Record<Intl.LDMLPluralRule, ReturnType<typeof show>>> = {
			count: setText(() => String(host.count)),
			none: show(() => host.count === 0),
			some: show(() => host.count > 0),
		}

		// Subset of plural categories for applicable pluralizer: ['zero', 'one', 'two', 'few', 'many', 'other']
		const categories = pluralizer.resolvedOptions().pluralCategories
		for (const category of categories)
			effects[category] = show(() => pluralizer.select(host.count) === category)

		return {
			ui: { count, none, some, zero, one, two, few, many, other },
			props: { count: asClampedInteger() },
			effects,
		}
	},
)
