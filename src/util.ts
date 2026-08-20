import type { SlotDescriptor } from '@zeix/cause-effect'

/* === Exported Functions === */

/**
 * Check whether a value is a `SlotDescriptor`-shaped object: a plain `{ get, set? }`
 * pair, not a branded `Signal`. Signals carry a `Symbol.toStringTag` (`'State'`,
 * `'Memo'`, `'Slot'`, …); a raw descriptor never does, which is what distinguishes
 * `expose({ value: { get, set } })` from `expose({ value: someSignal })`.
 *
 * @since 2.5.1
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if `value` is a `{ get, set? }` descriptor, not a `Signal`
 */
const isSlotDescriptor = /*#__PURE__*/ <T extends {} = unknown & {}>(
	value: unknown,
): value is SlotDescriptor<T> =>
	value !== null &&
	typeof value === 'object' &&
	typeof (value as Record<string, unknown>).get === 'function' &&
	!(Symbol.toStringTag in value)

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

/**
 * Describe a `ParentNode` for use in error messages: an element's `elementName()`,
 * a shadow root's host plus "shadow root", or "document" for anything else.
 *
 * @since 2.4.0
 * @param {ParentNode} parent - Node to describe
 * @returns {string}
 */
const describeRoot = /*#__PURE__*/ (parent: ParentNode): string =>
	typeof ShadowRoot !== 'undefined' && parent instanceof ShadowRoot
		? `${elementName(parent.host)} shadow root`
		: typeof Element !== 'undefined' && parent instanceof Element
			? elementName(parent)
			: 'document'

export {
	describeRoot,
	elementName,
	isCustomElement,
	isNotYetDefinedComponent,
	isSlotDescriptor,
}
