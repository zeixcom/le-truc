/**
 * React twin of the Le Truc `basic-pluralize` corpus component (LT-266 size
 * bet) — the remaining-item count with CLDR plural category selection. The
 * Le Truc twin renders every category span the locale might need and toggles
 * among them; the React twin re-renders with the selected category, so only
 * the matching branch exists in the virtual DOM.
 */
import { useMemo } from 'react'

export type BasicPluralizeProps = {
	/** The count driving category selection. */
	count: number
	/** Zero-state announcement. */
	none: string
	/** Singular word form (`task.one` in the twin's catalog). */
	one: string
	/** Plural word form (`task.other` in the twin's catalog). */
	other: string
	/** Trailing text after the count and word. */
	suffix?: string
}

/** The remaining-item count, pluralized per the page locale's CLDR rules. */
export function BasicPluralize({
	count,
	none,
	one,
	other,
	suffix = ' remaining',
}: BasicPluralizeProps) {
	const category = useMemo(
		() => new Intl.PluralRules('en').select(count),
		[count],
	)

	if (count === 0) {
		return (
			<basic-pluralize>
				<p className="none">{none}</p>
			</basic-pluralize>
		)
	}
	const word = category === 'one' ? one : other
	return (
		<basic-pluralize>
			<p className="some">
				<span className="count">{count}</span>
				<span className={category}>{word}</span>
				{suffix}
			</p>
		</basic-pluralize>
	)
}
