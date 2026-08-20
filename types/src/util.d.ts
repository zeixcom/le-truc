import type { SlotDescriptor } from '@zeix/cause-effect';
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
declare const isSlotDescriptor: <T extends {} = unknown & {}>(value: unknown) => value is SlotDescriptor<T>;
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
/**
 * Describe a `ParentNode` for use in error messages: an element's `elementName()`,
 * a shadow root's host plus "shadow root", or "document" for anything else.
 *
 * @since 2.4.0
 * @param {ParentNode} parent - Node to describe
 * @returns {string}
 */
declare const describeRoot: (parent: ParentNode) => string;
export { describeRoot, elementName, isCustomElement, isNotYetDefinedComponent, isSlotDescriptor, };
