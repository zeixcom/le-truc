import {
	asInteger,
	asParser,
	type Component,
	defineComponent,
	setText,
	show,
	type UI,
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

/**
 * Parse a string as a positive integer (>= 0), falling back to 0 for negative values
 */
const asPositiveInteger =
	() =>
	asParser(<U extends UI>(ui: U, value: string | null | undefined) => {
		const parsed = asInteger()(ui, value)
		return parsed < 0 ? 0 : parsed
	})

export default defineComponent<BasicPluralizeProps, BasicPluralizeUI>(
	'basic-pluralize',
	{
		count: asPositiveInteger(),
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
		return effects
	},
)
