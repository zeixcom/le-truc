import { bindText, defineComponent } from '../../..'
import {
	MEDIA_MOTION,
	MEDIA_ORIENTATION,
	MEDIA_THEME,
	MEDIA_VIEWPORT,
} from '../../context/media/context-media'

/**
 * Displays the current OS-level media query preferences (motion, theme, viewport, orientation).
 * Use it to visualise the context values that `context-media` provides — the labels
 * update when the user changes their OS or browser preferences.
 * This component should be placed inside a `<context-media>` provider ancestor;
 * without a provider, context values must fall back to `"unknown"`.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-mediaqueries} Interactive preview and usage examples
 **/
export default defineComponent(
	'card-mediaqueries',
	({ first, requestContext, watch }) => {
		const motionEl = first('.motion')
		if (motionEl) {
			const motion = requestContext(MEDIA_MOTION, 'unknown')
			watch(motion, bindText(motionEl))
		}

		const themeEl = first('.theme')
		if (themeEl) {
			const theme = requestContext(MEDIA_THEME, 'unknown')
			watch(theme, bindText(themeEl))
		}

		const viewportEl = first('.viewport')
		if (viewportEl) {
			const viewport = requestContext(MEDIA_VIEWPORT, 'unknown')
			watch(viewport, bindText(viewportEl))
		}

		const orientationEl = first('.orientation')
		if (orientationEl) {
			const orientation = requestContext(MEDIA_ORIENTATION, 'unknown')
			watch(orientation, bindText(orientationEl))
		}
	},
)
