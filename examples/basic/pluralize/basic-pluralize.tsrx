/**
 * Unified-format migration: basic-pluralize — a `deriveCell` computed
 * (`category`, the resolved CLDR plural category) over two plain server args
 * (`lang`, `ordinal`) and the `count` prop, all harvested via the widened
 * arg→DOM-site substitution (ADR 0023 sub-design 12); six category
 * `<span>`s toggle `hidden` by comparing against `category` (ADR 0023
 * examples migration).
 *
 * Deviations from the hand-written `basic-pluralize.ts` (noted per project
 * convention): (1) the hand-written version loops over
 * `pluralizer.resolvedOptions().pluralCategories` and only watches the
 * categories that the resolved locale actually uses — TSRX's canonical
 * template is static, so all six CLDR categories (`zero`/`one`/`two`/`few`/
 * `many`/`other`) are always present and watched; a category the locale
 * doesn't use simply never matches and stays hidden. (2) `hidden={() => …}`
 * thunks here read `host.count` and the `category` signal, neither of which
 * is a bare `() => host.<prop>` mirror the server can evaluate — their
 * initial `hidden` state is therefore client-corrected (ADR 0023's
 * documented, accepted thunk-attribute flash-risk tradeoff), unlike the
 * hand-written version's synchronous-on-connect `watch()` calls (client-only
 * either way, but with no separate "server renders something else first"
 * step to correct away from).
 */
export type BasicPluralizeProps = {
	/** The count to pluralize. Clamped to a non-negative integer. */
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
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-pluralize} Interactive preview and usage examples
 **/
export function BasicPluralize(
	{ count, lang = 'en', ordinal = false }: { count: number; lang?: string; ordinal?: boolean },
)
	@{
		const category = deriveCell(() =>
			new Intl.PluralRules(lang, ordinal ? { type: 'ordinal' } : undefined).select(
				Number(count),
			),
		)
		expose({ count: asClampedInteger() })

		<>
			<basic-pluralize {count} {lang} {ordinal}>
				<p class="none" hidden={() => host.count !== 0}>Well done, all done!</p>
				<p class="some" hidden={() => host.count === 0}>
					<span class="count">{host.count}</span>
					task
					<span class="zero" hidden={() => category.get() !== 'zero'}>s</span>
					<span class="one" hidden={() => category.get() !== 'one'}></span>
					<span class="two" hidden={() => category.get() !== 'two'}>s</span>
					<span class="few" hidden={() => category.get() !== 'few'}>s</span>
					<span class="many" hidden={() => category.get() !== 'many'}>s</span>
					<span class="other" hidden={() => category.get() !== 'other'}>s</span>
					remaining
				</p>
			</basic-pluralize>

			<style>
			basic-pluralize {
				display: inline;

				& .count::after {
					content: " ";
				}
			}
			</style>
		</>
	}
