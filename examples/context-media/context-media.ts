import {
	type Component,
	type Context,
	createState,
	defineComponent,
	provideContexts,
} from '../..'

export type ContextMediaMotion = 'no-preference' | 'reduce'
export type ContextMediaTheme = 'light' | 'dark'
export type ContextMediaViewport = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ContextMediaOrientation = 'portrait' | 'landscape'

export type ContextMediaProps = {
	readonly 'media-motion': ContextMediaMotion
	readonly 'media-theme': ContextMediaTheme
	readonly 'media-viewport': ContextMediaViewport
	readonly 'media-orientation': ContextMediaOrientation
}

declare global {
	interface HTMLElementTagNameMap {
		'context-media': Component<ContextMediaProps>
	}
}

/* === Exported Contexts === */

export const MEDIA_MOTION = 'media-motion' as Context<
	'media-motion',
	() => ContextMediaMotion
>
export const MEDIA_THEME = 'media-theme' as Context<
	'media-theme',
	() => ContextMediaTheme
>
export const MEDIA_VIEWPORT = 'media-viewport' as Context<
	'media-viewport',
	() => ContextMediaViewport
>
export const MEDIA_ORIENTATION = 'media-orientation' as Context<
	'media-orientation',
	() => ContextMediaOrientation
>

/* === Component === */

export default defineComponent<ContextMediaProps>(
	'context-media',
	{
		// Context for motion preference; true for no-preference, false for reduce
		[MEDIA_MOTION]: () => {
			const mql = matchMedia('(prefers-reduced-motion: reduce)')
			const motion = createState(mql.matches ? 'reduce' : 'no-preference')
			mql.addEventListener('change', e => {
				motion.set(e.matches ? 'reduce' : 'no-preference')
			})
			return motion
		},

		// Context for preferred color scheme
		[MEDIA_THEME]: () => {
			const mql = matchMedia('(prefers-color-scheme: dark)')
			const theme = createState(mql.matches ? 'dark' : 'light')
			mql.addEventListener('change', e => {
				theme.set(e.matches ? 'dark' : 'light')
			})
			return theme
		},

		// Context for screen viewport size
		[MEDIA_VIEWPORT]: (ui: { host: HTMLElement }) => {
			const getBreakpoint = (attr: string, fallback: string) => {
				const value = ui.host.getAttribute(attr)
				const trimmed = value?.trim()
				if (!trimmed) return fallback
				const unit = trimmed.match(/em$/) ? 'em' : 'px'
				const v = parseFloat(trimmed)
				return Number.isFinite(v) ? v + unit : fallback
			}
			const mqlSM = matchMedia(`(min-width: ${getBreakpoint('sm', '32em')})`)
			const mqlMD = matchMedia(`(min-width: ${getBreakpoint('md', '48em')})`)
			const mqlLG = matchMedia(`(min-width: ${getBreakpoint('lg', '72em')})`)
			const mqlXL = matchMedia(`(min-width: ${getBreakpoint('xl', '104em')})`)
			const getViewport = () => {
				if (mqlXL.matches) return 'xl'
				if (mqlLG.matches) return 'lg'
				if (mqlMD.matches) return 'md'
				if (mqlSM.matches) return 'sm'
				return 'xs'
			}
			const viewport = createState(getViewport())
			mqlSM.addEventListener('change', () => {
				viewport.set(getViewport())
			})
			mqlMD.addEventListener('change', () => {
				viewport.set(getViewport())
			})
			mqlLG.addEventListener('change', () => {
				viewport.set(getViewport())
			})
			mqlXL.addEventListener('change', () => {
				viewport.set(getViewport())
			})
			return viewport
		},

		// Context for screen orientation
		[MEDIA_ORIENTATION]: () => {
			const mql = matchMedia('(orientation: landscape)')
			const orientation = createState(mql.matches ? 'landscape' : 'portrait')
			mql.addEventListener('change', e => {
				orientation.set(e.matches ? 'landscape' : 'portrait')
			})
			return orientation
		},
	},
	undefined,
	() => ({
		host: provideContexts([
			MEDIA_MOTION,
			MEDIA_THEME,
			MEDIA_VIEWPORT,
			MEDIA_ORIENTATION,
		]),
	}),
)
