/* === Constants === */

// Strict equality with 'true' ensures the string "false" (env vars are strings)
// is falsy. Without it, `process.env.DEV_MODE && …` returns "false" (truthy) in
// any runtime without the build-time `--define` replacement (tests, no-build CDN).
const DEV_MODE =
	typeof process !== 'undefined' && process.env.DEV_MODE === 'true'

/* === Exported Functions === */

/**
 * Check whether an element is a custom element
 *
 * @param {E} element - Element to check
 * @returns {boolean} - True if the element is a custom element
 */
const isCustomElement = /*#__PURE__*/ <E extends Element>(
	element: E,
): boolean => element.localName.includes('-')

/**
 * Check whether a custom element is not yet defined
 *
 * @param {Element} element - Element to check
 * @returns {boolean} - True if the element is a custom element and not yet defined
 */
const isNotYetDefinedComponent = /*#__PURE__*/ (element: Element): boolean =>
	isCustomElement(element) && element.matches(':not(:defined)')

/**
 * Return a string representation of the Element instance
 *
 * @since 0.7.0
 * @param {Element | undefined | null} el
 * @returns {string}
 */
const elementName = /*#__PURE__*/ (el: Element | undefined | null): string => {
	if (!el) return '<unknown>'
	const id = el.id ? `#${el.id}` : ''
	const classes = el.classList?.length
		? `.${Array.from(el.classList).join('.')}`
		: ''
	return `<${el.localName}${id}${classes}>`
}

export { DEV_MODE, elementName, isCustomElement, isNotYetDefinedComponent }
