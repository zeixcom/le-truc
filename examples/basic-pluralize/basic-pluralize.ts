import { asInteger, type Component, component, setText, show } from '../..'

export type BasicPluralizeProps = {
	count: number
}

export type BasicPluralizeUI = Record<
	| 'count'
	| 'none'
	| 'some'
	| 'zero'
	| 'one'
	| 'two'
	| 'few'
	| 'many'
	| 'other',
	HTMLElement | null
>

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': Component<BasicPluralizeProps, BasicPluralizeUI>
	}
}

const FALLBACK_LOCALE = 'en'

export default component<BasicPluralizeProps, BasicPluralizeUI>(
	'basic-pluralize',
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
	{ count: asInteger() },
	el => {
		const pluralizer = new Intl.PluralRules(
			el.closest('[lang]')?.getAttribute('lang') || FALLBACK_LOCALE,
			el.hasAttribute('ordinal') ? { type: 'ordinal' } : undefined,
		)

		// Basic effects
		const effects = {
			count: [setText(() => String(el.count))],
			none: [show(() => el.count === 0)],
			some: [show(() => el.count > 0)],
		}

		// Subset of plural categories for applicable pluralizer: ['zero', 'one', 'two', 'few', 'many', 'other']
		const categories = pluralizer.resolvedOptions().pluralCategories
		for (const category of categories)
			effects[category] = [
				show(() => pluralizer.select(el.count) === category),
			]
		return effects
	},
)
