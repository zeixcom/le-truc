import { type Fallback, type Parser } from '../parsers';
import type { UI } from '../ui';
/**
 * Parser that returns the attribute value as a string, or a fallback when absent.
 *
 * @since 0.11.0
 * @param {Fallback<string, U>} [fallback=''] - Static fallback string or reader function
 * @returns {Parser<string, U>} Parser that returns the attribute string or the resolved fallback
 */
declare const asString: <U extends UI>(fallback?: Fallback<string, U>) => Parser<string, U>;
/**
 * Parser that constrains an attribute value to one of a fixed set of allowed strings.
 *
 * Comparison is case-insensitive. If the attribute value is absent or does not match
 * any allowed value, the first entry of `valid` is returned as the default.
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Non-empty array of allowed values; first entry is the default
 * @returns {Parser<string, UI>} Parser that returns a valid enum value
 */
declare const asEnum: (valid: [string, ...string[]]) => Parser<string, UI>;
export { asString, asEnum };
