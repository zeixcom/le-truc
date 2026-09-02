import { type Parser } from '../types';
/**
 * Parses a string as an integer, with a fallback. Supports hexadecimal
 * and scientific notation.
 *
 * @since 0.11.0
 * @param fallback - Value to use when the attribute is absent or unparseable
 * @returns Parser that returns the integer value
 */
declare const asInteger: (fallback?: number) => Parser<number>;
/**
 * Parses a string as a number, with a fallback.
 *
 * @since 0.11.0
 * @param fallback - Value to use when the attribute is absent or unparseable
 * @returns Parser that returns the number value
 */
declare const asNumber: (fallback?: number) => Parser<number>;
/**
 * Parses a string as an integer, clamped between `min` and `max`.
 *
 * @since 2.0
 * @param min - Minimum value; also the fallback when the attribute is absent
 * @param max - Maximum value
 * @returns Parser that returns the clamped integer value
 */
declare const asClampedInteger: (min?: number, max?: number) => Parser<number>;
export { asClampedInteger, asInteger, asNumber };
