import type { SlotDescriptor } from '@zeix/cause-effect';
/**
 * Checks whether a value is a `SlotDescriptor`-shaped object: a plain `{ get, set? }`
 * pair, not a branded `Signal`. Signals carry a `Symbol.toStringTag`; a raw
 * descriptor never does.
 *
 * @since 2.5.1
 * @param value - Value to check
 * @returns True if `value` is a `{ get, set? }` descriptor, not a `Signal`
 */
declare const isSlotDescriptor: <T extends {} = unknown & {}>(value: unknown) => value is SlotDescriptor<T>;
/**
 * Checks whether an element is a custom element.
 *
 * @param element - Element to check
 * @returns True if the element is a custom element
 */
declare const isCustomElement: <E extends Element>(element: E) => boolean;
/**
 * Checks whether a custom element is not yet defined.
 *
 * @param element - Element to check
 * @returns True if the element is a custom element and not yet defined
 */
declare const isNotYetDefinedComponent: (element: Element) => boolean;
/**
 * Returns a string representation of an element, for use in error messages.
 *
 * @since 0.7.0
 * @param el - Element to describe
 * @returns The element's tag name, id, and classes as a CSS-selector-like string
 */
declare const elementName: (el: Element | undefined | null) => string;
/**
 * Describes a `ParentNode` for use in error messages: an element's `elementName()`,
 * a shadow root's host plus "shadow root", or "document" for anything else.
 *
 * @since 2.4.0
 * @param parent - Node to describe
 * @returns A human-readable description of the node
 */
declare const describeRoot: (parent: ParentNode) => string;
export { describeRoot, elementName, isCustomElement, isNotYetDefinedComponent, isSlotDescriptor, };
