import { type Parser } from '../types';
/**
 * Parses a string as JSON, with a fallback.
 *
 * Drops reserved keys (`__proto__`, `constructor`, …) from the parsed
 * result at every nesting level, so a crafted payload cannot pollute a
 * host's prototype chain.
 *
 * @since 0.11.0
 * @param fallback - Value to use when the attribute is absent
 * @returns Parser that returns the parsed object
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If the value is not a valid JSON string
 */
declare const asJSON: <T extends {}>(fallback: T) => Parser<T>;
export { asJSON };
