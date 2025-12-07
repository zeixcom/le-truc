import { type Collection } from './signals/collection';
type ExtractTag<S extends string> = S extends `${infer T}.${string}` ? T : S extends `${infer T}#${string}` ? T : S extends `${infer T}:${string}` ? T : S extends `${infer T}[${string}` ? T : S;
type KnownTag<S extends string> = Lowercase<ExtractTag<S>> extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | keyof MathMLElementTagNameMap ? Lowercase<ExtractTag<S>> : never;
type ElementFromSelector<S extends string> = KnownTag<S> extends never ? HTMLElement : KnownTag<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[KnownTag<S>] : HTMLElement;
type FirstElement = {
    <S extends string>(selector: S, required: string): ElementFromSelector<S>;
    <S extends string>(selector: S): ElementFromSelector<S> | undefined;
    <E extends Element>(selector: string, required: string): E;
    <E extends Element>(selector: string): E | undefined;
};
type AllElements = {
    <S extends string>(selector: S, required?: string): Collection<ElementFromSelector<S>>;
    <E extends Element>(selector: string, required?: string): Collection<E>;
};
type UI = Record<string, Element | Collection<Element>>;
type ElementFromKey<U extends UI, K extends keyof U> = NonNullable<U[K] extends Collection<infer E extends Element> ? E : U[K] extends Element ? U[K] : never>;
type ElementQueries = {
    first: FirstElement;
    all: AllElements;
};
/**
 * Create partially applied helper functions to get descendants and run effects on them
 *
 * @since 0.14.0
 * @param {HTMLElement} host - Host component
 * @returns {ElementSelectors<P>} - Helper functions for selecting descendants
 */
declare const getHelpers: (host: HTMLElement) => [ElementQueries, (run: () => void) => void];
export { type ElementFromKey, type ElementFromSelector, type ElementQueries, getHelpers, type UI, };
