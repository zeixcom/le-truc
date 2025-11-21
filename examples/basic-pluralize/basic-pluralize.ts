import { asInteger, type Component, component, setText, show } from '../..'

export type BasicPluralizeProps = {
	readonly ui: Partial<
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
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': Component<BasicPluralizeProps>
	}
}

const FALLBACK_LOCALE = 'en'

export default component<BasicPluralizeProps>(
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
	ui => {
		const pluralizer = new Intl.PluralRules(
			ui.component.closest('[lang]')?.getAttribute('lang')
				|| FALLBACK_LOCALE,
			ui.component.hasAttribute('ordinal')
				? { type: 'ordinal' }
				: undefined,
		)

		// Basic effects
		const effects = {
			count: [setText(() => String(ui.component.count))],
			none: [show(() => ui.component.count === 0)],
			some: [show(() => ui.component.count > 0)],
		}

		// Subset of plural categories for applicable pluralizer: ['zero', 'one', 'two', 'few', 'many', 'other']
		const categories = pluralizer.resolvedOptions().pluralCategories
		for (const category of categories)
			effects[category] = [
				show(() => pluralizer.select(ui.component.count) === category),
			]
		return effects
	},
)
