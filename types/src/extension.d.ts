/**
 * Dependency-injection contract for `defineComponent()`'s third parameter.
 *
 * A feature module hands `defineComponent(name, factory, [extension(), ...])`
 * an extension. `component.ts` references only this generic shape; it never
 * imports a concrete feature module, so an unused extension does not reach
 * the bundle.
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
 * Folds an extensions array into the merged shape `component.ts` installs on the generated class.
 *
 * Only `staticProps` keys can collide (`reservedMembers` and
 * `observedAttributes` are unions). In DEV_MODE, a repeated `staticProps`
 * key throws; in production, the first extension to declare a key wins.
 *
 * @since 2.3
 * @param component - Component name, for the collision error message.
 * @param extensions - Extensions passed to `defineComponent`.
 * @returns The merged static props, observed attributes, and reserved members.
 * @throws {ExtensionCollisionError} In DEV_MODE, if two extensions declare the same `staticProps` key.
 */
declare const mergeExtensions: (component: string, extensions: readonly ComponentExtension[]) => MergedExtensions;
export { type ComponentExtension, type MergedExtensions, mergeExtensions };
