import { type Fallback, type Parser } from '../parsers';
import type { UI } from '../ui';
/**
 * Parse a string as a localized date string, or a fallback when absent or invalid
 *
 * @since 1.1
 * @param {Fallback<string, U>} [fallback=''] - Fallback value or reader function
 * @returns {Parser<string, U>} Parser function
 */
declare const asDate: <U extends UI>(fallback?: Fallback<string, U>) => Parser<string, U>;
export { asDate };
