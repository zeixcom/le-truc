import { type Cell } from '@zeix/cause-effect';
type SplitByComma<S extends string> = S extends `${infer First},${infer Rest}` ? [TrimWhitespace<First>, ...SplitByComma<Rest>] : [TrimWhitespace<S>];
type TrimWhitespace<S extends string> = S extends ` ${infer Rest}` ? TrimWhitespace<Rest> : S extends `${infer Rest} ` ? TrimWhitespace<Rest> : S;
type ExtractRightmostSelector<S extends string> = S extends `${string} ${infer Rest}` ? ExtractRightmostSelector<Rest> : S extends `${string}>${infer Rest}` ? ExtractRightmostSelector<Rest> : S extends `${string}+${infer Rest}` ? ExtractRightmostSelector<Rest> : S extends `${string}~${infer Rest}` ? ExtractRightmostSelector<Rest> : S;
type ExtractTagFromSimpleSelector<S extends string> = S extends `${infer T}.${string}` ? T : S extends `${infer T}#${string}` ? T : S extends `${infer T}[${string}` ? T extends `${string}:${string}` ? S extends `${infer U}:${string}` ? U : S : T : S extends `${infer T}:${string}` ? T : S;
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
    <S extends string>(selector: S, required?: string): Cell<ElementFromSelector<S>[]>;
    <E extends Element>(selector: string, required?: string): Cell<E[]>;
};
type ElementQueries = {
    first: FirstElement;
    all: AllElements;
};
/**
 * Extract attribute names from a CSS selector.
 *
 * Handles `.class`, `#id`, `[attr]`, `[attr=value]`, `[attr^=value]`, and similar forms.
 *
 * @param selector - CSS selector to parse
 * @returns Attribute names found in the selector
 */
declare const extractAttributes: (selector: string) => string[];
/**
 * Bind `query()` to `root`, throwing with contextLabel `'item'` instead of
 * the default `'component'`. Backs `reconcile()`'s `bindItem` and `each()`'s
 * scoped `first` parameter. See ADR 0021.
 */
declare const bindFirst: (root: Element) => FirstElement;
/**
 * Return the first descendant of `root` matching a CSS selector.
 *
 * One-shot: no dependency tracking for undefined custom elements, no `Cell`.
 * Use it for lookups relative to an already-obtained element. `first()`/
 * `all()` (see `makeElementQueries`) add dependency tracking for a
 * component host. See ADR 0021.
 *
 * @since 2.4.0
 * @param root - Node to search within
 * @param selector - CSS selector
 * @param [required] - If set and no element is found, throws with this message as context
 * @returns The first matching element, or `undefined` if not found and not required
 * @throws {MissingElementError} If `required` is set and no matching element exists
 */
declare function query<S extends string>(root: ParentNode, selector: S, required: string): ElementFromSelector<S>;
declare function query<S extends string>(root: ParentNode, selector: S): ElementFromSelector<S> | undefined;
declare function query<E extends Element>(root: ParentNode, selector: string, required: string): E;
declare function query<E extends Element>(root: ParentNode, selector: string): E | undefined;
/**
 * Return a plain array of all descendants of `root` matching a CSS selector.
 *
 * One-shot: queried once, not backed by a `Cell`/`MutationObserver`. Use
 * this when a live collection isn't needed. See `query()` and ADR 0021.
 *
 * @since 2.4.0
 * @param root - Node to search within
 * @param selector - CSS selector
 * @param [required] - If set and no elements are found, throws with this message as context
 * @returns Array of matching elements
 * @throws {MissingElementError} If `required` is set and no matching elements exist
 */
declare function queryAll<S extends string>(root: ParentNode, selector: S, required?: string): ElementFromSelector<S>[];
declare function queryAll<E extends Element>(root: ParentNode, selector: string, required?: string): E[];
/**
 * Create a memo of elements matching a CSS selector.
 *
 * The `MutationObserver` activates lazily when an effect first reads the
 * memo, and disconnects when no effects are watching.
 *
 * @since 0.16.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns Reactive memo of current matching elements
 * @throws {InvalidSelectorError} If the selector is malformed
 */
declare function createElementsMemo<S extends string>(parent: ParentNode, selector: S): Cell<ElementFromSelector<S>[]>;
declare function createElementsMemo<E extends Element>(parent: ParentNode, selector: string): Cell<E[]>;
/**
 * Create `{ first, all }` query helpers and a dependency resolver for a component host.
 *
 * Queries run against `host.shadowRoot` if present, otherwise against `host`
 * itself. Undefined custom elements found during queries are collected as
 * dependencies; `resolveDependencies` waits for them before activating effects.
 *
 * @since 0.14.0
 * @param host - The component host element
 * @returns Query helpers and a dependency resolver
 */
declare const makeElementQueries: (host: HTMLElement) => [ElementQueries, (run: () => void) => void];
export { type AllElements, bindFirst, createElementsMemo, type ElementFromSelector, type ElementFromSingleSelector, type ElementQueries, type ElementsFromSelectorArray, type ExtractRightmostSelector, type ExtractTag, type ExtractTagFromSimpleSelector, extractAttributes, type FirstElement, type KnownTag, makeElementQueries, query, queryAll, type SplitByComma, type TrimWhitespace, };
