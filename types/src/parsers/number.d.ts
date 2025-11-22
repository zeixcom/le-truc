import { type Fallback, type Parser } from '../parsers';
import type { UI } from '../ui';
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
export { asInteger, asNumber };
