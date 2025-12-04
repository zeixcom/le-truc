import type { ElementFromSelector } from './ui';
type CollectionListener<E extends Element> = (changes: E[]) => void;
type Collection<E extends Element> = {
    [Symbol.toStringTag]: 'Collection';
    get(): E[];
    on(type: 'add' | 'remove', listener: CollectionListener<E>): void;
    readonly length: number;
};
declare const TYPE_COLLECTION = "Collection";
/**
 * Create a collection of elements from a parent node and a CSS selector.
 *
 * @since 0.15.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A collection signal of elements
 */
declare const createCollection: <S extends string, E extends ElementFromSelector<S>>(parent: ParentNode, selector: S) => Collection<E>;
/**
 * Check if a value is a collection signal
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
declare const isCollection: <E extends Element = Element>(value: unknown) => value is Collection<E>;
export { type Collection, type CollectionListener, TYPE_COLLECTION, createCollection, isCollection, };
