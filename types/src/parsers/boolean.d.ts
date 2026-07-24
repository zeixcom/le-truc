import { type Parser } from '../types';
/**
 * Parser that converts a boolean HTML attribute to an actual boolean.
 *
 * Returns `true` when the attribute is present (value is not `null`) and its value
 * is not the string `'false'`, compared case-insensitively (`'FALSE'`, `'False'`, …
 * also opt out). Returns `fallback` otherwise (default `false`) — matching standard
 * HTML boolean attribute semantics while allowing explicit opt-out via `attr="false"`,
 * and also covering ARIA-style string-boolean attributes (e.g. `aria-hidden="true"`/`"false"`),
 * which are conventionally case-insensitive.
 *
 * @since 0.13.1
 * @param {boolean} [fallback=false] - Value to use when the attribute is absent
 * @returns {Parser<boolean>} Parser that returns `true` if the attribute is set and not (case-insensitively) `"false"`, `fallback` otherwise
 */
declare const asBoolean: (fallback?: boolean) => Parser<boolean>;
export { asBoolean };
