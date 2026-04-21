/* === Types === */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/* === Constants === */

const DEV_MODE = typeof process !== 'undefined' && process.env.DEV_MODE

const LOG_WARN: LogLevel = 'warn'

/* === Internal Functions === */

/**
 * Return selector string for the id of the element
 *
 * @since 0.7.0
 * @param {string | undefined | null} id
 * @returns {string} - id string for the element with '#' prefix
 */
const idString = (id: string | undefined | null): string => (id ? `#${id}` : '')

/**
 * Return a selector string for classes of the element
 *
 * @since 0.7.0
 * @param {DOMTokenList | undefined | null} classList - DOMTokenList to convert to a string
 * @returns {string} - class string for the DOMTokenList with '.' prefix if any
 */
const classString = (classList: DOMTokenList | undefined | null): string =>
	classList?.length ? `.${Array.from(classList).join('.')}` : ''

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
const elementName = /*#__PURE__*/ (el: Element | undefined | null): string =>
	el
		? `<${el.localName}${idString(el.id)}${classString(el.classList)}>`
		: '<unknown>'

export {
	DEV_MODE,
	elementName,
	isCustomElement,
	isNotYetDefinedComponent,
	LOG_WARN,
	type LogLevel,
}
