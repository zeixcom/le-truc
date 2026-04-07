import { type Parser } from '../parsers';
/**
 * Parse a string as a number forced to integer with a fallback
 *
 * Supports hexadecimal and scientific notation
 *
 * @since 0.11.0
 * @param {number} [fallback=0] - Fallback value
 * @returns {Parser<number>} Parser function
 */
declare const asInteger: (fallback?: number) => Parser<number>;
/**
 * Parse a string as a number with a fallback
 *
 * @since 0.11.0
 * @param {number} [fallback=0] - Fallback value
 * @returns {Parser<number>} Parser function
 */
declare const asNumber: (fallback?: number) => Parser<number>;
/**
 * Parse a string as a clamped integer (>= min, <= max) with fallbacks
 *
 * @since 2.0
 * @param {number} [min=0] - Minimum value
 * @param {number} [max=Number.MAX_SAFE_INTEGER] - Maximum value
 * @returns {Parser<number>} Parser function
 */
declare const asClampedInteger: (min?: number, max?: number) => Parser<number>;
export { asClampedInteger, asInteger, asNumber };
