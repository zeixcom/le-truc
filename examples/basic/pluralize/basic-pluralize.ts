import {
	asClampedInteger,
	bindText,
	bindVisible,
	defineComponent,
} from '../../..'
import { getLocale } from '../../_common/getLocale'

export type BasicPluralizeProps = {
	/** The count to pluralize. Read from the `count` attribute at connect time. Clamped to a non-negative integer. */
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': HTMLElement & BasicPluralizeProps
	}
}

/**
 * Shows locale-aware plural forms of content based on a count.
 * Use it for internationalised prose where the correct plural form must be shown —
 * accessibility tools and screen readers benefit from grammatically correct output.
 * Reveal children by class: `.none` (0), `.some` (>0), and `.zero/.one/.two/.few/.many/.other` per CLDR plural rules.
 * @attribute {string} [lang] - BCP 47 locale tag (e.g. `ar`). Falls back to the nearest ancestor's `lang` attribute, or `en` if none is set. Read once at connect time.
 * @attribute {boolean} [ordinal=false] - Use ordinal plural rules (1st, 2nd, 3rd, ...) instead of cardinal. Presence-only; read once at connect time.
 * @demo {./docs/examples/basic-pluralize.html} Interactive preview and usage examples */
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

		if (count) watch('count', bindText(count))
		if (none) watch(() => host.count === 0, bindVisible(none))
		if (some) watch(() => host.count !== 0, bindVisible(some))

		const categories = pluralizer.resolvedOptions().pluralCategories
		for (const category of categories) {
			const el = categoryElements[category]
			if (el)
				watch(() => pluralizer.select(host.count) === category, bindVisible(el))
		}
	},
)
