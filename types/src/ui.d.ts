import { type Memo } from '@zeix/cause-effect';
type SplitByComma<S extends string> = S extends `${infer First},${infer Rest}` ? [TrimWhitespace<First>, ...SplitByComma<Rest>] : [TrimWhitespace<S>];
type TrimWhitespace<S extends string> = S extends ` ${infer Rest}` ? TrimWhitespace<Rest> : S extends `${infer Rest} ` ? TrimWhitespace<Rest> : S;
type ExtractRightmostSelector<S extends string> = S extends `${string} ${infer Rest}` ? ExtractRightmostSelector<Rest> : S extends `${string}>${infer Rest}` ? ExtractRightmostSelector<Rest> : S extends `${string}+${infer Rest}` ? ExtractRightmostSelector<Rest> : S extends `${string}~${infer Rest}` ? ExtractRightmostSelector<Rest> : S;
type ExtractTagFromSimpleSelector<S extends string> = S extends `${infer T}.${string}` ? T : S extends `${infer T}#${string}` ? T : S extends `${infer T}:${string}` ? T : S extends `${infer T}[${string}` ? T : S;
type ExtractTag<S extends string> = ExtractTagFromSimpleSelector<ExtractRightmostSelector<S>>;
type KnownTag<S extends string> = Lowercase<ExtractTag<S>> extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | keyof MathMLElementTagNameMap ? Lowercase<ExtractTag<S>> : never;
type ElementFromSingleSelector<S extends string> = KnownTag<S> extends never ? HTMLElement : KnownTag<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[KnownTag<S>] : HTMLElement;
type ElementsFromSelectorArray<Selectors extends readonly string[]> = {
    [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never;
}[number];
type ElementFromSelector<S extends string> = S extends `${string},${string}` ? ElementsFromSelectorArray<SplitByComma<S>> : ElementFromSingleSelector<S>;
type FirstElement = {
    <S extends string>(selector: S, required: string): ElementFromSelector<S>;
    <S extends string>(selector: S): ElementFromSelector<S> | undefined;
    <E extends Element>(selector: string, required: string): E;
    <E extends Element>(selector: string): E | undefined;
};
type AllElements = {
    <S extends string>(selector: S, required?: string): Memo<ElementFromSelector<S>[]>;
    <E extends Element>(selector: string, required?: string): Memo<E[]>;
};
type ElementQueries = {
    first: FirstElement;
    all: AllElements;
};
type UI = Record<string, Element | Memo<Element[]>>;
type ElementFromKey<U extends UI, K extends keyof U> = NonNullable<U[K] extends Memo<infer E extends Element[]> ? E[number] : U[K] extends Element ? U[K] : never>;
/**
 * Create a memo of elements matching a CSS selector.
 * The MutationObserver is lazily activated when an effect first reads
 * the memo, and disconnected when no effects are watching.
 *
 * @since 0.16.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A Memo of current matching elements
 */
declare function createElementsMemo<S extends string>(parent: ParentNode, selector: S): Memo<ElementFromSelector<S>[]>;
declare function createElementsMemo<E extends Element>(parent: ParentNode, selector: string): Memo<E[]>;
/**
 * Create partially applied helper functions to get descendants and run effects on them
 *
 * @since 0.14.0
 * @param {HTMLElement} host - Host component
 * @returns {ElementSelectors<P>} - Helper functions for selecting descendants
 */
declare const getHelpers: (host: HTMLElement) => [ElementQueries, (run: () => void) => void];
export { type AllElements, type ElementFromKey, type ElementFromSelector, type ElementsFromSelectorArray, type ElementFromSingleSelector, type ElementQueries, type ExtractRightmostSelector, type ExtractTag, type ExtractTagFromSimpleSelector, type FirstElement, type KnownTag, createElementsMemo, getHelpers, type SplitByComma, type TrimWhitespace, type UI, };
