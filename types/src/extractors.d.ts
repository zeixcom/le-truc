import type { Component, ComponentProps } from './component';
import { type ParserOrFallback } from './parsers';
import type { UI } from './ui';
type Extractor<T extends {}, E extends Element = HTMLElement> = (target: E) => T;
type LooseExtractor<T, E extends Element = HTMLElement> = (target: E) => T | null | undefined;
type Fallback<T extends {}, E extends Element = HTMLElement> = T | Extractor<T, E>;
/**
 * Get a value from elements in the DOM
 *
 * @since 0.15.0
 * @param {E} extractors - An object of extractor functions for selectors as keys to get a value from
 * @param {ParserOrFallback<T, P, U>} fallback - Fallback value or parser function
 * @returns {LooseExtractor<T | string | null | undefined, C>} Loose extractor function to apply to the host element
 */
declare const extract: <T extends {}, E extends { [K in keyof U]?: LooseExtractor<T | string, Extract<U[K], Element>>; } = {}, P extends ComponentProps = ComponentProps, U extends UI = UI>(extractors: E, fallback: ParserOrFallback<T, P, U>) => Extractor<T, Component<P, U>>;
declare const getText: <E extends Element = Element>() => LooseExtractor<string, E>;
declare const getIdrefText: <E extends Element = Element>(attr: string) => LooseExtractor<string, E>;
declare const getProperty: <E extends Element, K extends keyof E & string>(prop: K) => LooseExtractor<E[K], E>;
declare const hasAttribute: (attr: string) => Extractor<boolean, Element>;
declare const getAttribute: <E extends Element = Element>(attr: string) => LooseExtractor<string, E>;
declare const hasClass: (token: string) => Extractor<boolean, Element>;
declare const getStyle: <E extends HTMLElement | SVGElement | MathMLElement = HTMLElement>(prop: string) => Extractor<string, E>;
export { type Extractor, type Fallback, type LooseExtractor, extract, getText, getIdrefText, getProperty, hasAttribute, getAttribute, hasClass, getStyle, };
