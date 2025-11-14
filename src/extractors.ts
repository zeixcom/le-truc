import type { ComponentProps, ComponentUI } from './component'
import type { UI } from './ui'

/* === Types === */

type Extractor<
	T extends {},
	P extends ComponentProps = ComponentProps,
	U extends UI = UI,
> = (ui: ComponentUI<P, U>) => T

type LooseExtractor<
	T,
	P extends ComponentProps = ComponentProps,
	U extends UI = UI,
> = (ui: ComponentUI<P, U>) => T | null | undefined

/* === Exported Functions === */

export { type Extractor, type LooseExtractor }
