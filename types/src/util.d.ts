type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare const DEV_MODE: string | false | undefined;
declare const LOG_WARN: LogLevel;
/**
 * Check whether an element is a custom element
 *
 * @param {E} element - Element to check
 * @returns {boolean} - True if the element is a custom element
 */
declare const isCustomElement: <E extends Element>(element: E) => boolean;
/**
 * Check whether a custom element is not yet defined
 *
 * @param {Element} element - Element to check
 * @returns {boolean} - True if the element is a custom element and not yet defined
 */
declare const isNotYetDefinedComponent: (element: Element) => boolean;
/**
 * Return a string representation of the Element instance
 *
 * @since 0.7.0
 * @param {Element | undefined | null} el
 * @returns {string}
 */
declare const elementName: (el: Element | undefined | null) => string;
export { DEV_MODE, elementName, isCustomElement, isNotYetDefinedComponent, LOG_WARN, type LogLevel, };
