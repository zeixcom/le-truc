/**
 * Dependency-injection contract for `defineComponent()`'s third parameter.
 *
 * An extension is a plain data/function bundle a feature module hands to
 * `defineComponent(name, factory, [extension(), ...])`. `component.ts` only
 * ever references this generic shape — it never imports a concrete feature
 * module (`extensions/form.ts`, `extensions/attributes.ts`, ...) directly, so a
 * consumer who never calls e.g. `formAssociated()` never causes their
 * bundler to pull that module's code in at all.
 *
 * Extensions bundled with the library are the intended norm; the same type
 * is public so authoring a custom extension is possible, but exceptional.
 */
import type { FactoryResult, Falsy } from './types';
type ComponentExtension = {
    /** Identifies the extension in collision error messages. */
    name: string;
    /** Static class properties to install on the generated custom element class. */
    staticProps?: Record<string, unknown>;
    /** Attribute names this extension wants observed post-connect. */
    observedAttributes?: readonly string[];
    /** Property names this extension reserves — rejected by `expose()`. */
    reservedMembers?: ReadonlySet<string>;
    /** Called once per class, before `customElements.define`. */
    installOnPrototype?: (proto: HTMLElement) => void;
    /**
     * Called once per instance during `connectedCallback`, after the factory
     * runs. May return extra effect descriptors to activate in the same
     * deferred-activation pipeline as author effects.
     */
    onConnect?: (instance: HTMLElement, internals: ElementInternals | null) => FactoryResult | Falsy | void;
    /** Called for every observed attribute mutation, in extension array order. */
    onAttributeChanged?: (instance: HTMLElement, name: string, oldValue: string | null, newValue: string | null) => void;
};
/** Precomputed, class-definition-time shape derived from an extensions array. */
type MergedExtensions = {
    staticProps: Record<string, unknown>;
    observedAttributes: string[];
    reservedMembers: ReadonlySet<string>;
    /** Maps a reserved member name to the extension that reserved it, for error messages. */
    reservedMemberOwners: ReadonlyMap<string, string>;
};
/**
 * Fold an extensions array into the merged shape `component.ts` installs on
 * the generated class, once, at class-definition time.
 *
 * Collision policy (only `staticProps` keys can collide — `reservedMembers`
 * and `observedAttributes` are unions, never conflicts): in DEV_MODE, a
 * repeated `staticProps` key throws {@link ExtensionCollisionError}; in
 * production, the first extension to declare a key wins and later ones are
 * silently ignored.
 *
 * @since 2.3
 * @param {string} component - Component name, for the collision error message
 * @param {readonly ComponentExtension[]} extensions - Extensions passed to `defineComponent`
 * @returns {MergedExtensions} The merged static props, observed attributes, and reserved members
 * @throws {ExtensionCollisionError} In DEV_MODE, if two extensions declare the same `staticProps` key
 */
declare const mergeExtensions: (component: string, extensions: readonly ComponentExtension[]) => MergedExtensions;
export { type ComponentExtension, type MergedExtensions, mergeExtensions };
