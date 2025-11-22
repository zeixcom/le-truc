import type { Parser } from '../parsers'
import type { UI } from '../ui'

/**
 * Parse a boolean attribute as an actual boolean value
 *
 * @since 0.13.1
 * @returns {Parser<boolean, UI>}
 */
const asBoolean =
	(): Parser<boolean, UI> => (_: UI, value: string | null | undefined) =>
		value != null && value !== 'false'

export { asBoolean }
