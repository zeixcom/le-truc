import { defineComponent } from '../../..'
import { getLocale } from '../../_common/getLocale'

declare global {
	interface HTMLElementTagNameMap {
		'card-blogmeta': HTMLElement
	}
}

const INVALID_DATE = 'invalid date'
const UNKNOWN_DATE = 'unknown date'

function formatLocalDate(
	locale: string,
	isoDate: string,
	{ dateStyle = 'long' }: Intl.DateTimeFormatOptions = {},
): string {
	const [year, month, day] = isoDate.split('-').map(Number)
	if (
		!year ||
		Number.isNaN(year) ||
		!month ||
		Number.isNaN(month) ||
		Number.isNaN(day)
	)
		return INVALID_DATE
	const date = new Date(year, month - 1, day) // avoid UTC offset shifting the day
	return new Intl.DateTimeFormat(locale, { dateStyle }).format(date)
}

export default defineComponent('card-blogmeta', ({ host, first }) => {
	const published = first(
		'time.published',
		'Add a <time> element to display the publication date.',
	)
	const modifiedSpan = first('span.modified')
	const modified = first('.modified time')
	const locale = getLocale(host)

	published.textContent = published.dateTime
		? formatLocalDate(locale, published.dateTime)
		: UNKNOWN_DATE

	if (modified) {
		const modifiedDate = modified.dateTime
			? formatLocalDate(locale, modified.dateTime)
			: INVALID_DATE
		if (modifiedSpan && modifiedDate === INVALID_DATE) modifiedSpan.remove()
		else modified.textContent = modifiedDate
	}
})
