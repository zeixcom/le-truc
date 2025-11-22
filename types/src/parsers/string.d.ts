import { type Fallback, type Parser } from '../parsers';
import type { UI } from '../ui';
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
export { asString, asEnum };
