import type { SlotDescriptor } from '@zeix/cause-effect'

/* === Exported Functions === */

/**
 * Checks whether a value is a `SlotDescriptor`-shaped object: a plain `{ get, set? }`
 * pair, not a branded `Signal`. Signals carry a `Symbol.toStringTag`; a raw
 * descriptor never does.
 *
 * @since 2.5.1
 * @param value - Value to check
 * @returns True if `value` is a `{ get, set? }` descriptor, not a `Signal`
 */
const isSlotDescriptor = /*#__PURE__*/ <T extends {} = unknown & {}>(
	value: unknown,
): value is SlotDescriptor<T> =>
	value !== null &&
	typeof value === 'object' &&
	typeof (value as Record<string, unknown>).get === 'function' &&
	!(Symbol.toStringTag in value)

/**
 * Checks whether an element is a custom element.
 *
 * @param element - Element to check
 * @returns True if the element is a custom element
 */
const isCustomElement = /*#__PURE__*/ <E extends Element>(
	element: E,
): boolean => element.localName.includes('-')

/**
 * Checks whether a custom element is not yet defined.
 *
 * @param element - Element to check
 * @returns True if the element is a custom element and not yet defined
 */
const isNotYetDefinedComponent = /*#__PURE__*/ (element: Element): boolean =>
	isCustomElement(element) && element.matches(':not(:defined)')

/**
 * Returns a string representation of an element, for use in error messages.
 *
 * @since 0.7.0
 * @param el - Element to describe
 * @returns The element's tag name, id, and classes as a CSS-selector-like string
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
 * Describes a `ParentNode` for use in error messages: an element's `elementName()`,
 * a shadow root's host plus "shadow root", or "document" for anything else.
 *
 * @since 2.4.0
 * @param parent - Node to describe
 * @returns A human-readable description of the node
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
