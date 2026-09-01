import type { ComponentExtension } from '../extension';
/**
 * Extension that keeps a Parser-backed reactive property in sync with its attribute after connect.
 * Attributes normally drive state only once, at connect time; see ADR 0003.
 * Re-runs the retained Parser on each attribute mutation; props without a Parser initializer are left untouched.
 *
 * @since 2.3
 * @param names - Attribute names to observe after connect.
 * @returns A `ComponentExtension` for `defineComponent`'s third parameter.
 */
declare const observedAttributes: (names: readonly string[]) => ComponentExtension;
export { observedAttributes };
