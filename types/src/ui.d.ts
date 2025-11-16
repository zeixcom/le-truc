import type { Component, ComponentProps } from './component';
type ExtractTag<S extends string> = S extends `${infer T}.${string}` ? T : S extends `${infer T}#${string}` ? T : S extends `${infer T}:${string}` ? T : S extends `${infer T}[${string}` ? T : S;
type KnownTag<S extends string> = Lowercase<ExtractTag<S>> extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | keyof MathMLElementTagNameMap ? Lowercase<ExtractTag<S>> : never;
type ElementFromSelector<S extends string> = KnownTag<S> extends never ? HTMLElement : KnownTag<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[KnownTag<S>] : HTMLElement;
type FirstElement = {
    <S extends string>(selector: S, required: string): ElementFromSelector<S>;
    <S extends string>(selector: S): ElementFromSelector<S> | null;
    <E extends Element>(selector: string, required: string): E;
    <E extends Element>(selector: string): E | null;
};
type AllElements = {
    <S extends string>(selector: S, required?: string): ElementFromSelector<S>[];
    <E extends Element>(selector: string, required?: string): E[];
};
type UI = Record<string, Element | Element[] | null>;
type Helpers = {
    first: FirstElement;
    all: AllElements;
};
/**
 * Observe a DOM subtree with a mutation observer
 *
 * @since 0.12.2
 * @param {ParentNode} parent - parent node
 * @param {string} selector - selector for matching elements to observe
 * @param {MutationCallback} callback - mutation callback
 * @returns {MutationObserver} - the created mutation observer
 */
declare const observeSubtree: (parent: ParentNode, selector: string, callback: MutationCallback) => MutationObserver;
/**
 * Create partially applied helper functions to get descendants and run effects on them
 *
 * @since 0.14.0
 * @param {Component<P, U>} host - Host component
 * @returns {ElementSelectors<P>} - Helper functions for selecting descendants
 */
declare const getHelpers: <P extends ComponentProps, U extends UI>(host: Component<P, U>) => [Helpers, () => string[]];
export { type Helpers, getHelpers, observeSubtree, type UI };
