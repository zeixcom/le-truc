import { type Component, defineComponent } from '../../..'
import {
	MEDIA_MOTION,
	MEDIA_ORIENTATION,
	MEDIA_THEME,
	MEDIA_VIEWPORT,
} from '../../context/media/context-media'

type CardMediaqueriesPropKeys = 'motion' | 'theme' | 'viewport' | 'orientation'

export type CardMediaqueriesProps = Record<CardMediaqueriesPropKeys, string>

declare global {
	interface HTMLElementTagNameMap {
		'card-mediaqueries': Component<CardMediaqueriesProps>
	}
}

export default defineComponent<CardMediaqueriesProps>(
	'card-mediaqueries',
	({ expose, first, requestContext, run }) => {
		const motionEl = first('.motion')
		const themeEl = first('.theme')
		const viewportEl = first('.viewport')
		const orientationEl = first('.orientation')

		expose({
			motion: requestContext(MEDIA_MOTION, 'unknown'),
			theme: requestContext(MEDIA_THEME, 'unknown'),
			viewport: requestContext(MEDIA_VIEWPORT, 'unknown'),
			orientation: requestContext(MEDIA_ORIENTATION, 'unknown'),
		})

		return [
			motionEl && run('motion', text => { motionEl.textContent = text }),
			themeEl && run('theme', text => { themeEl.textContent = text }),
			viewportEl && run('viewport', text => { viewportEl.textContent = text }),
			orientationEl && run('orientation', text => { orientationEl.textContent = text }),
		]
	},
)
