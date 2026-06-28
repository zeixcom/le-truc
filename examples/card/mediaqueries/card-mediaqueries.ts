import { bindText, defineComponent } from '../../..'
import {
	MEDIA_MOTION,
	MEDIA_ORIENTATION,
	MEDIA_THEME,
	MEDIA_VIEWPORT,
} from '../../context/media/context-media'

export default defineComponent(
	'card-mediaqueries',
	({ first, requestContext, watch }) => {
		const motionEl = first('.motion')
		const themeEl = first('.theme')
		const viewportEl = first('.viewport')
		const orientationEl = first('.orientation')

		const motion = requestContext(MEDIA_MOTION, 'unknown')
		const theme = requestContext(MEDIA_THEME, 'unknown')
		const viewport = requestContext(MEDIA_VIEWPORT, 'unknown')
		const orientation = requestContext(MEDIA_ORIENTATION, 'unknown')

		return [
			motionEl && watch(motion, bindText(motionEl)),
			themeEl && watch(theme, bindText(themeEl)),
			viewportEl && watch(viewport, bindText(viewportEl)),
			orientationEl && watch(orientation, bindText(orientationEl)),
		]
	},
)
