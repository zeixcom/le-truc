import { type Parser } from '../parsers';
/**
 * Parser that returns the attribute value as a string, or a fallback when absent.
 *
 * @since 0.11.0
 * @param {string} [fallback=''] - Static fallback string
 * @returns {Parser<string>} Parser that returns the attribute string or the fallback
 */
declare const asString: (fallback?: string) => Parser<string>;
/**
 * Parser that constrains an attribute value to one of a fixed set of allowed strings.
 *
 * Comparison is case-insensitive. If the attribute value is absent or does not match
 * any allowed value, the first entry of `valid` is returned as the default.
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Non-empty array of allowed values; first entry is the default
 * @returns {Parser<string>} Parser that returns a valid enum value
 */
declare const asEnum: (valid: [string, ...string[]]) => Parser<string>;
export { asEnum, asString };
