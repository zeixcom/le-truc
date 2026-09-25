import { createContext } from '@zeix/le-truc'

/**
 * The context keys and value types `context-media` provides (LT-106). A
 * module of its own, with no side effects, so a consumer imports the keys
 * without importing a component definition: `card-mediaqueries` used to
 * import them from `context-media.ts`, whose module body defines the `.ts`
 * twin — which would register ahead of the served compiled client.
 */

export type ContextMediaMotion = 'no-preference' | 'reduce'
export type ContextMediaTheme = 'light' | 'dark'
export type ContextMediaViewport = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ContextMediaOrientation = 'portrait' | 'landscape'

export const MEDIA_MOTION = createContext<() => ContextMediaMotion>('motion')
export const MEDIA_THEME = createContext<() => ContextMediaTheme>('theme')
export const MEDIA_VIEWPORT =
	createContext<() => ContextMediaViewport>('viewport')
export const MEDIA_ORIENTATION =
	createContext<() => ContextMediaOrientation>('orientation')
