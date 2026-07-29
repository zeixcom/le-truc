/**
 * Opt-in attribute-driven reactivity — the interop escape hatch ADR 0003
 * reserved after properties became the primary reactive interface (motivated
 * chiefly by frameworks like React that set DOM attributes rather than
 * properties).
 *
 * Properties remain primary; this only re-parses an already-`expose()`d
 * Parser-backed prop when its attribute mutates after connect.
 * `component.ts` never imports this module at the value level.
 */
import type { ComponentExtension } from '../extension';
/**
 * Extension that keeps a Parser-backed reactive property in sync with its
 * attribute after connect (attributes normally only drive state once, at
 * connect time — see ADR 0003). Re-runs the same `Parser` retained from
 * `expose()` against the attribute's new string value on every mutation;
 * props whose initializer wasn't a branded `Parser` are left untouched.
 *
 * @since 2.3
 * @param {readonly string[]} names - Attribute names to observe post-connect
 * @returns {ComponentExtension} Pass to `defineComponent`'s third parameter, e.g. `[observedAttributes(['variant'])]`
 */
declare const observedAttributes: (names: readonly string[]) => ComponentExtension;
export { observedAttributes };
