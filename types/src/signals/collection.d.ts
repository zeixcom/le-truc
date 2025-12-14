import { type Cleanup } from '@zeix/cause-effect';
import type { ElementFromSelector } from '../ui';
type CollectionListener<E extends Element> = (changes: readonly E[]) => void;
type Collection<E extends Element> = {
    readonly [Symbol.toStringTag]: 'Collection';
    readonly [Symbol.isConcatSpreadable]: true;
    [Symbol.iterator](): IterableIterator<E>;
    [n: number]: E;
    get(): E[];
    on(type: 'add' | 'remove', listener: CollectionListener<E>): Cleanup;
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
declare function createCollection<S extends string>(parent: ParentNode, selector: S): Collection<ElementFromSelector<S>>;
declare function createCollection<E extends Element>(parent: ParentNode, selector: string): Collection<E>;
/**
 * Check if a value is a collection signal
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
declare const isCollection: <E extends Element = Element>(value: unknown) => value is Collection<E>;
export { type Collection, type CollectionListener, TYPE_COLLECTION, createCollection, isCollection, };
