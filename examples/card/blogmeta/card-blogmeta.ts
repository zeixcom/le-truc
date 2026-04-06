import { bindText, defineComponent } from '../../..'
import { asDate } from '../../_common/asDate'

export type CardBlogmetaProps = {
	date: string
}

declare global {
	interface HTMLElementTagNameMap {
		'card-blogmeta': HTMLElement & CardBlogmetaProps
	}
}

export default defineComponent<CardBlogmetaProps>(
	'card-blogmeta',
	({ expose, first, watch }) => {
		const time = first(
			'time',
			'Add a <time> element to display the publication date.',
		)

		const formattedFallback = time.dateTime
			? new Date(time.dateTime).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})
			: 'unknown date'

		expose({
			date: asDate(formattedFallback),
		})

		return [watch('date', bindText(time))]
	},
)
