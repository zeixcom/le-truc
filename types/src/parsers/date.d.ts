import { type Parser } from '../parsers';
/**
 * Parse a string as a localized date string, or a fallback when absent or invalid
 *
 * @since 2.0
 * @param {string} [fallback=''] - Fallback value
 * @returns {Parser<string>} Parser function
 */
declare const asDate: (fallback?: string) => Parser<string>;
export { asDate };
