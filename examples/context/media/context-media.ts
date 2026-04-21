import { type Context, createSensor, defineComponent } from '../../..'

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
		'context-media': HTMLElement & ContextMediaProps
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
	({ expose, host, provideContexts }) => {
		const getBreakpoint = (attr: string, fallback: string) => {
			const value = host.getAttribute(attr)
			const trimmed = value?.trim()
			if (!trimmed) return fallback
			const unit = trimmed.match(/em$/) ? 'em' : 'px'
			const v = parseFloat(trimmed)
			return Number.isFinite(v) ? v + unit : fallback
		}

		expose({
			// Context for motion preference
			[MEDIA_MOTION]: createSensor<ContextMediaMotion>(
				set => {
					const mql = matchMedia('(prefers-reduced-motion: reduce)')
					const listener = (e: MediaQueryListEvent) =>
						set(e.matches ? 'reduce' : 'no-preference')
					mql.addEventListener('change', listener)
					return () => mql.removeEventListener('change', listener)
				},
				{
					value: matchMedia('(prefers-reduced-motion: reduce)').matches
						? 'reduce'
						: 'no-preference',
				},
			),

			// Context for preferred color scheme
			[MEDIA_THEME]: createSensor<ContextMediaTheme>(
				set => {
					const mql = matchMedia('(prefers-color-scheme: dark)')
					const listener = (e: MediaQueryListEvent) =>
						set(e.matches ? 'dark' : 'light')
					mql.addEventListener('change', listener)
					return () => mql.removeEventListener('change', listener)
				},
				{
					value: matchMedia('(prefers-color-scheme: dark)').matches
						? 'dark'
						: 'light',
				},
			),

			// Context for screen viewport size
			[MEDIA_VIEWPORT]: (() => {
				const mqlSM = matchMedia(`(min-width: ${getBreakpoint('sm', '32em')})`)
				const mqlMD = matchMedia(`(min-width: ${getBreakpoint('md', '48em')})`)
				const mqlLG = matchMedia(`(min-width: ${getBreakpoint('lg', '72em')})`)
				const mqlXL = matchMedia(`(min-width: ${getBreakpoint('xl', '104em')})`)
				const getViewport = (): ContextMediaViewport => {
					if (mqlXL.matches) return 'xl'
					if (mqlLG.matches) return 'lg'
					if (mqlMD.matches) return 'md'
					if (mqlSM.matches) return 'sm'
					return 'xs'
				}
				return createSensor<ContextMediaViewport>(
					set => {
						const listener = () => set(getViewport())
						mqlSM.addEventListener('change', listener)
						mqlMD.addEventListener('change', listener)
						mqlLG.addEventListener('change', listener)
						mqlXL.addEventListener('change', listener)
						return () => {
							mqlSM.removeEventListener('change', listener)
							mqlMD.removeEventListener('change', listener)
							mqlLG.removeEventListener('change', listener)
							mqlXL.removeEventListener('change', listener)
						}
					},
					{ value: getViewport() },
				)
			})(),

			// Context for screen orientation
			[MEDIA_ORIENTATION]: createSensor<ContextMediaOrientation>(
				set => {
					const mql = matchMedia('(orientation: landscape)')
					const listener = (e: MediaQueryListEvent) =>
						set(e.matches ? 'landscape' : 'portrait')
					mql.addEventListener('change', listener)
					return () => mql.removeEventListener('change', listener)
				},
				{
					value: matchMedia('(orientation: landscape)').matches
						? 'landscape'
						: 'portrait',
				},
			),
		})

		return [
			provideContexts([
				MEDIA_MOTION,
				MEDIA_THEME,
				MEDIA_VIEWPORT,
				MEDIA_ORIENTATION,
			]),
		]
	},
)
