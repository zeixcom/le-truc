import { isFunction, isString } from '@zeix/cause-effect'

/* === Types === */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/* === Constants === */

const DEV_MODE = process.env.DEV_MODE

const LOG_DEBUG: LogLevel = 'debug'
const LOG_INFO: LogLevel = 'info'
const LOG_WARN: LogLevel = 'warn'
const LOG_ERROR: LogLevel = 'error'

// Reserved words that should never be used as property names
// These are fundamental JavaScript/Object properties that cause serious issues
const RESERVED_WORDS = new Set([
	'constructor',
	'prototype',
	// Expand this list based on user feedback for other reserved words like:
	// '__proto__', 'toString', 'valueOf', 'hasOwnProperty', etc.
])

// HTMLElement properties that commonly cause conflicts
// These are properties that exist on HTMLElement and cause confusion when overridden
// in our reactive components because we use the same name for both attributes and properties
const HTML_ELEMENT_PROPS = new Set([
	'id', // DOM selector conflicts
	'class', // CSS class management conflicts (note: property is 'className')
	'className', // CSS class management conflicts (note: HTML attribute is 'class')
	'title', // Conflicts with tooltip behavior
	'role', // ARIA/accessibility conflicts
	'style', // Conflicts with style object
	'dataset', // Conflicts with data-* attribute access
	'lang', // Language/i18n conflicts
	'dir', // Text direction conflicts
	'hidden', // Visibility control conflicts
	'children', // DOM manipulation conflicts
	'innerHTML', // DOM manipulation conflicts
	'outerHTML', // Full element HTML conflicts
	'textContent', // Text manipulation conflicts
	'innerText', // Text manipulation conflicts
	// TO EXPAND: Add properties based on user feedback and common mistakes
	// 'tabindex', 'tabIndex', 'slot', 'part', etc.
])

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

const hasMethod = /*#__PURE__*/ <T extends object, K extends PropertyKey, R>(
	obj: T,
	methodName: K,
): obj is T & Record<K, (...args: any[]) => R> =>
	isString(methodName) &&
	methodName in obj &&
	isFunction<R>((obj as any)[methodName])

/**
 * Check if a node is an Element
 *
 * @param {Node} node - node to check
 * @returns {boolean} - `true` if node is an element node, otherwise `false`
 */
const isElement = /*#__PURE__*/ (node: Node): node is Element =>
	node.nodeType === Node.ELEMENT_NODE

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

/**
 * Return a detailed type of a JavaScript variable
 *
 * @since 0.11.0
 * @param {unknown} value
 * @returns {string}
 */
const typeString = /*#__PURE__*/ (value: unknown): string => {
	if (value === null) return 'null'
	if (typeof value !== 'object') return typeof value
	if (Array.isArray(value)) return 'Array'

	// Check for Symbol.toStringTag
	if (Symbol.toStringTag in Object(value)) {
		return (value as any)[Symbol.toStringTag]
	}

	// For other objects, return the constructor name if available
	return value.constructor?.name || 'Object'
}

/**
 * Log a message to the console with the specified level
 *
 * @since 0.7.0
 * @param {T} value - value to inspect
 * @param {string} msg - message to log
 * @param {LogLevel} level - log level
 * @returns {T} - value passed through
 */
const log = <T>(value: T, msg: string, level: LogLevel = LOG_DEBUG): T => {
	if (DEV_MODE || ([LOG_ERROR, LOG_WARN] as LogLevel[]).includes(level))
		console[level](msg, value)
	return value
}

/**
 * Simple fail-fast validation that checks for specific problematic cases
 *
 * This validation prevents common mistakes where developers accidentally
 * use property names that conflict with native HTMLElement functionality.
 *
 * @param {string} prop - Property name to validate
 * @returns {string | null} - Error message or null if valid
 */
const validatePropertyName = (prop: string): string | null => {
	if (RESERVED_WORDS.has(prop))
		return `Property name "${prop}" is a reserved word`
	if (HTML_ELEMENT_PROPS.has(prop))
		return `Property name "${prop}" conflicts with inherited HTMLElement property`
	return null
}

export {
	type LogLevel,
	hasMethod,
	isElement,
	isCustomElement,
	isNotYetDefinedComponent,
	log,
	elementName,
	typeString,
	validatePropertyName,
	DEV_MODE,
	LOG_DEBUG,
	LOG_INFO,
	LOG_WARN,
	LOG_ERROR,
}
