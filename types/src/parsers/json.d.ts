import { type Fallback, type Parser } from '../parsers';
import type { UI } from '../ui';
/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<T, U>} fallback - Fallback value or reader function
 * @returns {Parser<T, U>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
declare const asJSON: <T extends {}, U extends UI>(fallback: Fallback<T, U>) => Parser<T, U>;
export { asJSON };
