import { createContext, createSensor, defineComponent } from '@zeix/le-truc'

export type ContextMediaMotion = 'no-preference' | 'reduce'
export type ContextMediaTheme = 'light' | 'dark'
export type ContextMediaViewport = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ContextMediaOrientation = 'portrait' | 'landscape'

export type ContextMediaProps = {
	readonly motion: ContextMediaMotion
	readonly theme: ContextMediaTheme
	readonly viewport: ContextMediaViewport
	readonly orientation: ContextMediaOrientation
}

declare global {
	interface HTMLElementTagNameMap {
		'context-media': HTMLElement & ContextMediaProps
	}
}

/* === Exported Contexts === */

export const MEDIA_MOTION = createContext<() => ContextMediaMotion>('motion')
export const MEDIA_THEME = createContext<() => ContextMediaTheme>('theme')
export const MEDIA_VIEWPORT =
	createContext<() => ContextMediaViewport>('viewport')
export const MEDIA_ORIENTATION =
	createContext<() => ContextMediaOrientation>('orientation')

/* === Component === */

/**
 * A context provider that tracks OS-level media query preferences and exposes them as reactive contexts.
 * Use it for responsive or theme-aware components — descendant elements can requestContext()
 * to react when the user changes reduced-motion, dark/light theme, or viewport breakpoint.
 * Breakpoint attributes must be valid CSS lengths (e.g. `sm="600px"`).
 * Breakpoints (sm, md, lg, xl) can be overridden via attributes of the same name (e.g. `sm="600px"`).
 *
 * @attribute {string} [sm=32em] - Small breakpoint as a CSS length in `px` or `em` (e.g. `600px`). Read once at connect time.
 * @attribute {string} [md=48em] - Medium breakpoint as a CSS length in `px` or `em`. Read once at connect time.
 * @attribute {string} [lg=72em] - Large breakpoint as a CSS length in `px` or `em`. Read once at connect time.
 * @attribute {string} [xl=104em] - Extra-large breakpoint as a CSS length in `px` or `em`. Read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#context-media} Interactive preview and usage examples
 **/
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
			motion: createSensor<ContextMediaMotion>(
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
			theme: createSensor<ContextMediaTheme>(
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
			viewport: (() => {
				const breakpoints: [ContextMediaViewport, string][] = [
					['sm', getBreakpoint('sm', '32em')],
					['md', getBreakpoint('md', '48em')],
					['lg', getBreakpoint('lg', '72em')],
					['xl', getBreakpoint('xl', '104em')],
				]
				const mqls = new Map<ContextMediaViewport, MediaQueryList>(
					breakpoints.map(([name, size]) => [
						name,
						matchMedia(`(min-width: ${size})`),
					]),
				)
				const getViewport = (): ContextMediaViewport => {
					let viewport: ContextMediaViewport = 'xs'
					for (const [name, mql] of mqls) if (mql.matches) viewport = name
					return viewport
				}
				return createSensor<ContextMediaViewport>(
					set => {
						const listener = () => set(getViewport())
						for (const mql of mqls.values())
							mql.addEventListener('change', listener)
						return () => {
							for (const mql of mqls.values())
								mql.removeEventListener('change', listener)
						}
					},
					{ value: getViewport() },
				)
			})(),

			// Context for screen orientation
			orientation: createSensor<ContextMediaOrientation>(
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

		provideContexts(['motion', 'theme', 'viewport', 'orientation'])
	},
)
