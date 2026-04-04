import { type Component, defineComponent, read, setText } from '../../..'
import { asDate } from '../../_common/asDate'

export type CardBlogmetaProps = {
	date: string
}

type CardBlogmetaUI = {
	time: HTMLTimeElement
}

declare global {
	interface HTMLElementTagNameMap {
		'card-blogmeta': Component<CardBlogmetaProps>
	}
}

export default defineComponent<CardBlogmetaProps, CardBlogmetaUI>(
	'card-blogmeta',
	({ first }) => {
		const time = first(
			'time',
			'Add a <time> element to display the publication date.',
		)
		return {
			ui: { time },
			props: {
				date: read(() => time.dateTime, asDate('unknown date')),
			},
			effects: {
				time: setText('date'),
			},
		}
	},
)
