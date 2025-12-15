import { Component, defineComponent, requestContext, setText } from '../..'
import {
	MEDIA_MOTION,
	MEDIA_ORIENTATION,
	MEDIA_THEME,
	MEDIA_VIEWPORT,
} from '../context-media/context-media'

type CardMediaqueriesPropKeys = 'motion' | 'theme' | 'viewport' | 'orientation'

export type CardMediaqueriesProps = Record<CardMediaqueriesPropKeys, string>

type CardMediaqueriesUI = Partial<Record<CardMediaqueriesPropKeys, HTMLElement>>

declare global {
	interface HTMLElementTagNameMap {
		'card-mediaqueries': Component<CardMediaqueriesProps>
	}
}

export default defineComponent<CardMediaqueriesProps, CardMediaqueriesUI>(
	'card-mediaqueries',
	{
		motion: requestContext(MEDIA_MOTION, 'unknown'),
		theme: requestContext(MEDIA_THEME, 'unknown'),
		viewport: requestContext(MEDIA_VIEWPORT, 'unknown'),
		orientation: requestContext(MEDIA_ORIENTATION, 'unknown'),
	},
	({ first }) => ({
		motion: first('.motion'),
		theme: first('.theme'),
		viewport: first('.viewport'),
		orientation: first('.orientation'),
	}),
	() => ({
		motion: setText('motion'),
		theme: setText('theme'),
		viewport: setText('viewport'),
		orientation: setText('orientation'),
	}),
)
