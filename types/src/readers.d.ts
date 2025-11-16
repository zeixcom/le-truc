import type { Component, ComponentProps } from './component';
import { type ParserOrFallback } from './parsers';
import type { UI } from './ui';
type Reader<T extends {}> = <E extends Element = HTMLElement>(target: E) => T;
type ComponentReader<T extends {}> = <P extends ComponentProps, U extends UI>(host: Component<P, U>) => T;
type LooseReader<T> = <E extends Element = HTMLElement>(target: E) => T | null | undefined;
type Fallback<T extends {}> = T | Reader<T> | ComponentReader<T>;
/**
 * Get a value from elements in the DOM
 *
 * @since 0.15.0
 * @param {R} readers - An object of reader functions for UI elements as keys to get a value from
 * @param {ParserOrFallback<T>} fallback - Fallback value or parser function
 * @returns {Reader<T>} Loose reader function to apply to the host element
 */
declare const read: <T extends {}>(readers: Record<string, LooseReader<T | string>>, fallback: ParserOrFallback<T>) => ComponentReader<T>;
declare const getText: () => LooseReader<string>;
declare const getIdrefText: (attr: string) => LooseReader<string>;
declare const getProperty: <K extends string>(prop: K) => <E extends Element>(element: E) => K extends keyof E ? E[K] : undefined;
declare const hasAttribute: (attr: string) => Reader<boolean>;
declare const getAttribute: (attr: string) => LooseReader<string>;
declare const hasClass: (token: string) => Reader<boolean>;
declare const getStyle: (prop: string) => Reader<string>;
export { type Reader, type Fallback, type LooseReader, read, getText, getIdrefText, getProperty, hasAttribute, getAttribute, hasClass, getStyle, };
