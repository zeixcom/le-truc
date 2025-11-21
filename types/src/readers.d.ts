import type { Component, ComponentProps } from './component';
import { type ParserOrFallback } from './parsers';
import type { ElementFromKey } from './ui';
type Reader<T extends {}, E extends Element> = (target: E) => T;
type LooseReader<T, E extends Element> = (target: E) => T | null | undefined;
type Fallback<T extends {}, E extends Element> = T | Reader<T, E>;
/**
 * Get a value from elements in the DOM
 *
 * @since 0.15.0
 * @param {R} readers - An object of reader functions for UI elements as keys to get a value from
 * @param {ParserOrFallback<T, Component<P>>} fallback - Fallback value or parser function
 * @returns {Reader<T, Component<P>>} Reader function to apply to the host element
 */
declare const read: <T extends {}, P extends ComponentProps>(readers: { [K in keyof P["ui"] & string]: LooseReader<T | string, ElementFromKey<P["ui"], K>>; }, fallback: ParserOrFallback<T, Component<P>>) => Reader<T, Component<P>>;
declare const getText: <E extends Element>() => LooseReader<string, E>;
declare const getIdrefText: <E extends Element>(attr: string) => LooseReader<string, E>;
declare const getProperty: <E extends Element, K extends keyof E & string>(prop: K) => (element: E) => E[K];
declare const hasAttribute: <E extends Element>(attr: string) => Reader<boolean, E>;
declare const getAttribute: <E extends Element>(attr: string) => LooseReader<string, E>;
declare const hasClass: <E extends Element>(token: string) => Reader<boolean, E>;
declare const getStyle: <E extends Element>(prop: string) => Reader<string, E>;
export { type Reader, type Fallback, type LooseReader, read, getText, getIdrefText, getProperty, hasAttribute, getAttribute, hasClass, getStyle, };
