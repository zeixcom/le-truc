import {
	type Component,
	defineComponent,
	requestContext,
	setText,
} from '../../..'
import {
	MEDIA_MOTION,
	MEDIA_ORIENTATION,
	MEDIA_THEME,
	MEDIA_VIEWPORT,
} from '../../context/media/context-media'

type CardMediaqueriesPropKeys = 'motion' | 'theme' | 'viewport' | 'orientation'

export type CardMediaqueriesProps = Record<CardMediaqueriesPropKeys, string>

type CardMediaqueriesUI = Partial<
	Record<CardMediaqueriesPropKeys, HTMLElement | undefined>
>

declare global {
	interface HTMLElementTagNameMap {
		'card-mediaqueries': Component<CardMediaqueriesProps>
	}
}

export default defineComponent<CardMediaqueriesProps, CardMediaqueriesUI>(
	'card-mediaqueries',
	({ first }) => {
		const motion = first('.motion')
		const theme = first('.theme')
		const viewport = first('.viewport')
		const orientation = first('.orientation')
		return {
			ui: { motion, theme, viewport, orientation },
			props: {
				motion: requestContext(MEDIA_MOTION, 'unknown'),
				theme: requestContext(MEDIA_THEME, 'unknown'),
				viewport: requestContext(MEDIA_VIEWPORT, 'unknown'),
				orientation: requestContext(MEDIA_ORIENTATION, 'unknown'),
			},
			effects: {
				motion: setText('motion'),
				theme: setText('theme'),
				viewport: setText('viewport'),
				orientation: setText('orientation'),
			},
		}
	},
)
