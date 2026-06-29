import { type Parser } from '../types';
/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * Reserved words (`__proto__`, `constructor`, …, see `RESERVED_WORDS`) are
 * dropped from the parsed result at every nesting level via a `JSON.parse`
 * reviver, so a crafted payload can't plant an own `__proto__`/`constructor`
 * property that later corrupts a host's prototype chain (defense-in-depth
 * alongside the runtime guard in `#initSignals`).
 *
 * @since 0.11.0
 * @param {T} fallback - Fallback value
 * @returns {Parser<T>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
declare const asJSON: <T extends {}>(fallback: T) => Parser<T>;
export { asJSON };
