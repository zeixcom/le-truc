import type { UI } from './ui';
type Parser<T extends {}, U extends UI> = (ui: U, value: string | null | undefined, old?: string | null) => T;
type LooseReader<T extends {}, U extends UI> = (ui: U) => T | string | null | undefined;
type Reader<T extends {}, U extends UI> = (ui: U) => T;
type Fallback<T extends {}, U extends UI> = T | Reader<T, U>;
type ParserOrFallback<T extends {}, U extends UI> = Parser<T, U> | Fallback<T, U>;
/**
 * Check if a value is a string parser
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a string parser
 * @returns {boolean} True if the value is a string parser, false otherwise
 */
declare const isParser: <T extends {}, U extends UI>(value: unknown) => value is Parser<T, U>;
/**
 * Get a fallback value for an element
 *
 * @since 0.14.0
 * @param {U} ui - Component UI
 * @param {ParserOrFallback<T, U>} fallback - Fallback value or parser function
 * @returns {T} Fallback value or parsed value
 */
declare const getFallback: <T extends {}, U extends UI>(ui: U, fallback: ParserOrFallback<T, U>) => T;
/**
 * Read a value from a UI element
 *
 * @since 0.15.0
 * @param {LooseReader<T, U>} reader - Reader function returning T | string | null | undefined
 * @param {ParserOrFallback<T, U>} fallback - Fallback value or parser function
 * @returns {Reader<T, U>} Parsed value or fallback value
 */
declare const read: <T extends {}, U extends UI>(reader: LooseReader<T, U>, fallback: ParserOrFallback<T, U>) => Reader<T, U>;
/**
 * Parse a boolean attribute as an actual boolean value
 *
 * @since 0.13.1
 * @returns {Parser<boolean, UI>}
 */
declare const asBoolean: () => Parser<boolean, UI>;
/**
 * Parse a string as a number forced to integer with a fallback
 *
 * Supports hexadecimal and scientific notation
 *
 * @since 0.11.0
 * @param {Fallback<number, U>} [fallback=0] - Fallback value or reader function
 * @returns {Parser<number, U>} Parser function
 */
declare const asInteger: <U extends UI>(fallback?: Fallback<number, U>) => Parser<number, U>;
/**
 * Parse a string as a number with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<number, U>} [fallback=0] - Fallback value or reader function
 * @returns {Parser<number, U>} Parser function
 */
declare const asNumber: <U extends UI>(fallback?: Fallback<number, U>) => Parser<number, U>;
/**
 * Pass through string with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<string, U>} [fallback=''] - Fallback value or reader function
 * @returns {Parser<string, U>} Parser function
 */
declare const asString: <U extends UI>(fallback?: Fallback<string, U>) => Parser<string, U>;
/**
 * Parse a string as a multi-state value (for example: ['true', 'false', 'mixed'], defaulting to the first valid option
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Array of valid values
 * @returns {Parser<string, UI>} Parser function
 */
declare const asEnum: (valid: [string, ...string[]]) => Parser<string, UI>;
/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<T, C>} fallback - Fallback value or reader function
 * @returns {Parser<T, C>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
declare const asJSON: <T extends {}, U extends UI>(fallback: Fallback<T, U>) => Parser<T, U>;
export { type Parser, type ParserOrFallback, type LooseReader, type Reader, isParser, asBoolean, asInteger, asNumber, asString, asEnum, asJSON, getFallback, read, };
