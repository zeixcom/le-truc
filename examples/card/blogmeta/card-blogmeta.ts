import { defineComponent } from '../../..'
import { getLocale } from '../../_common/getLocale'

declare global {
	interface HTMLElementTagNameMap {
		'card-blogmeta': HTMLElement
	}
}

function formatLocalDate(
	locale: string,
	isoDate: string,
	{ dateStyle = 'long' }: Intl.DateTimeFormatOptions = {},
): string {
	const [year, month, day] = isoDate.split('-').map(Number)
	if (
		!year
		|| Number.isNaN(year)
		|| !month
		|| Number.isNaN(month)
		|| Number.isNaN(day)
	)
		return 'invalid date'
	const date = new Date(year, month - 1, day) // avoid UTC offset shifting the day
	return new Intl.DateTimeFormat(locale, { dateStyle }).format(date)
}

export default defineComponent('card-blogmeta', ({ host, first }) => {
	const published = first(
		'time.published',
		'Add a <time> element to display the publication date.',
	)
	const modified = first('time.modified')
	const locale = getLocale(host)

	published.textContent = published.dateTime
		? formatLocalDate(locale, published.dateTime)
		: 'unknown date'

	if (modified) {
		modified.textContent = modified.dateTime
			? formatLocalDate(locale, modified.dateTime)
			: 'unknown date'
	}
})
