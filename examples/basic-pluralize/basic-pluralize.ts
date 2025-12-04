import {
	asInteger,
	type Component,
	defineComponent,
	setText,
	show,
} from '../..'

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
		HTMLElement
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
	{
		count: asInteger(),
	},
	({ first }) => ({
		count: first('.count'),
		none: first('.none'),
		some: first('.some'),
		zero: first('.zero'),
		one: first('.one'),
		two: first('.two'),
		few: first('.few'),
		many: first('.many'),
		other: first('.other'),
	}),
	({ host }) => {
		const pluralizer = new Intl.PluralRules(
			host.closest('[lang]')?.getAttribute('lang') || FALLBACK_LOCALE,
			host.hasAttribute('ordinal') ? { type: 'ordinal' } : undefined,
		)

		// Basic effects
		const effects = {
			count: [setText(() => String(host.count))],
			none: [show(() => host.count === 0)],
			some: [show(() => host.count > 0)],
		}

		// Subset of plural categories for applicable pluralizer: ['zero', 'one', 'two', 'few', 'many', 'other']
		const categories = pluralizer.resolvedOptions().pluralCategories
		for (const category of categories)
			effects[category] = [
				show(() => pluralizer.select(host.count) === category),
			]
		return effects
	},
)
