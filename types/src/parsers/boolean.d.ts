import { type Parser } from '../component';
/**
 * Parser that converts a boolean HTML attribute to an actual boolean.
 *
 * Returns `true` when the attribute is present (value is not `null`) and its value
 * is not the string `'false'`. Returns `false` otherwise — matching standard HTML
 * boolean attribute semantics while allowing explicit opt-out via `attr="false"`.
 *
 * @since 0.13.1
 * @returns {Parser<boolean>} Parser that returns `true` if the attribute is set and not `"false"`, `false` otherwise
 */
declare const asBoolean: () => Parser<boolean>;
export { asBoolean };
