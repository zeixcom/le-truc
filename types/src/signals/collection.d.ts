import { type Cleanup, type Collection, DerivedCollection, type Hook, type HookCallback, type KeyConfig, Ref } from '@zeix/cause-effect';
import type { ElementFromSelector } from '../ui';
declare class ElementCollection<T extends Element> implements Collection<T> {
    #private;
    constructor(parent: ParentNode, selector: string, keyConfig?: KeyConfig<T>);
    get [Symbol.toStringTag](): 'Collection';
    get [Symbol.isConcatSpreadable](): true;
    [Symbol.iterator](): IterableIterator<Ref<T>>;
    keys(): IterableIterator<string>;
    get(): T[];
    at(index: number): Ref<T> | undefined;
    byKey(key: string): Ref<T> | undefined;
    keyAt(index: number): string | undefined;
    indexOfKey(key: string): number;
    on(type: Hook, callback: HookCallback): Cleanup;
    deriveCollection<R extends {}>(callback: (sourceValue: T) => R): DerivedCollection<R, T>;
    deriveCollection<R extends {}>(callback: (sourceValue: T, abort: AbortSignal) => Promise<R>): DerivedCollection<R, T>;
    get length(): number;
}
/**
 * Create a collection of elements from a parent node and a CSS selector.
 *
 * @since 0.15.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A collection signal of elements
 */
declare function createElementCollection<S extends string>(parent: ParentNode, selector: S, keyConfig?: KeyConfig<ElementFromSelector<S>>): ElementCollection<ElementFromSelector<S>>;
declare function createElementCollection<E extends Element>(parent: ParentNode, selector: string, keyConfig?: KeyConfig<E>): ElementCollection<E>;
export { createElementCollection, ElementCollection };
