import type { Fallback } from './readers';
type Parser<T extends {}> = <C extends HTMLElement>(host: C, value: string | null | undefined, old?: string | null) => T;
type ParserOrFallback<T extends {}> = Parser<T> | Fallback<T>;
/**
 * Check if a value is a string parser
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a string parser
 * @returns {boolean} True if the value is a string parser, false otherwise
 */
declare const isParser: <T extends {}>(value: unknown) => value is Parser<T>;
/**
 * Get a fallback value for an element
 *
 * @since 0.14.0
 * @param {C} host - Host component
 * @param {ParserOrFallback<T>} fallback - Fallback value or parser function
 * @returns {T} Fallback value or parsed value
 */
declare const getFallback: <T extends {}, C extends HTMLElement>(host: C, fallback: ParserOrFallback<T>) => T;
/**
 * Parse a boolean attribute as an actual boolean value
 *
 * @since 0.13.1
 * @returns {Parser<boolean>}
 */
declare const asBoolean: () => Parser<boolean>;
/**
 * Parse a string as a number forced to integer with a fallback
 *
 * Supports hexadecimal and scientific notation
 *
 * @since 0.11.0
 * @param {Fallback<number>} [fallback=0] - Fallback value or extractor function
 * @returns {Parser<number>} Parser function
 */
declare const asInteger: (fallback?: Fallback<number>) => Parser<number>;
/**
 * Parse a string as a number with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<number>} [fallback=0] - Fallback value or extractor function
 * @returns {Parser<number>} Parser function
 */
declare const asNumber: (fallback?: Fallback<number>) => Parser<number>;
/**
 * Pass through string with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<string>} [fallback=''] - Fallback value or extractor function
 * @returns {Parser<string>} Parser function
 */
declare const asString: (fallback?: Fallback<string>) => Parser<string>;
/**
 * Parse a string as a multi-state value (for example: ['true', 'false', 'mixed'], defaulting to the first valid option
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Array of valid values
 * @returns {Parser<string>} Parser function
 */
declare const asEnum: (valid: [string, ...string[]]) => Parser<string>;
/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<T>} fallback - Fallback value or extractor function
 * @returns {Parser<T>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
declare const asJSON: <T extends {}>(fallback: Fallback<T>) => Parser<T>;
export { type Parser, type ParserOrFallback, isParser, asBoolean, asInteger, asNumber, asString, asEnum, asJSON, getFallback, };
