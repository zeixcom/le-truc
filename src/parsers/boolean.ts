import type { Parser } from '../parsers'
import type { UI } from '../ui'

/**
 * Parser that converts a boolean HTML attribute to an actual boolean.
 *
 * Returns `true` when the attribute is present (value is not `null`) and its value
 * is not the string `'false'`. Returns `false` otherwise — matching standard HTML
 * boolean attribute semantics while allowing explicit opt-out via `attr="false"`.
 *
 * @since 0.13.1
 * @returns {Parser<boolean, UI>} Parser that returns `true` if the attribute is set and not `"false"`, `false` otherwise
 */
const asBoolean =
	(): Parser<boolean, UI> => (_: UI, value: string | null | undefined) =>
		value != null && value !== 'false'

export { asBoolean }
