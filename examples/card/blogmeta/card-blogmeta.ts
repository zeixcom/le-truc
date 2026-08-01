import { defineComponent } from '../../..'
import { getLocale } from '../../_common/getLocale'

declare global {
	interface HTMLElementTagNameMap {
		'card-blogmeta': HTMLElement
	}
}

const INVALID_DATE = 'invalid date'
const UNKNOWN_DATE = 'unknown date'

// Bootstrap Icons "person-circle" (MIT licensed) — stylized fallback avatar
// shown when no <img> is provided inside .author.
const AVATAR_FALLBACK_SVG = `<svg class="avatar" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
  <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
</svg>`

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

/**
 * Formats and displays publication and modification dates from `<time>` element `datetime` attributes.
 * Use it for blog post or article metadata — the displayed dates update when the
 * underlying `datetime` attributes change.
 * The `datetime` values must be valid date strings; missing attributes are skipped.
 * The host element should contain `<time class="published">` and `<time class="modified">` elements.
 * If `.author` has no `<img>` child, a stylized placeholder avatar is inserted.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-blogmeta} Interactive preview and usage examples
 **/
export default defineComponent('card-blogmeta', ({ host, first }) => {
	const published = first(
		'time.published',
		'Add a <time> element to display the publication date.',
	)
	const locale = getLocale(host)

	published.textContent = published.dateTime
		? formatLocalDate(locale, published.dateTime)
		: UNKNOWN_DATE

	const modified = first('.modified time')
	if (modified) {
		const modifiedSpan = first('span.modified')
		const modifiedDate = modified.dateTime
			? formatLocalDate(locale, modified.dateTime)
			: INVALID_DATE
		if (modifiedSpan && modifiedDate === INVALID_DATE) modifiedSpan.remove()
		else modified.textContent = modifiedDate
	}

	const author = first('.author')
	if (author && !author.querySelector('img'))
		author.insertAdjacentHTML('afterbegin', AVATAR_FALLBACK_SVG)
})
