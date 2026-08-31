/**
 * Dependency-injection contract for `defineComponent()`'s third parameter.
 *
 * A feature module hands `defineComponent(name, factory, [extension(), ...])`
 * an extension. `component.ts` references only this generic shape; it never
 * imports a concrete feature module, so an unused extension does not reach
 * the bundle.
 */

import { ExtensionCollisionError } from './errors'
import type { FactoryResult, Falsy } from './types'

/* === Types === */

type ComponentExtension = {
	/** Identifies the extension in collision error messages. */
	name: string
	/** Static class properties to install on the generated custom element class. */
	staticProps?: Record<string, unknown>
	/** Attribute names this extension wants observed post-connect. */
	observedAttributes?: readonly string[]
	/** Property names this extension reserves — rejected by `expose()`. */
	reservedMembers?: ReadonlySet<string>
	/** Called once per class, before `customElements.define`. */
	installOnPrototype?: (proto: HTMLElement) => void
	/**
	 * Called once per instance during `connectedCallback`, after the factory
	 * runs. May return extra effect descriptors to activate in the same
	 * deferred-activation pipeline as author effects.
	 */
	onConnect?: (
		instance: HTMLElement,
		internals: ElementInternals | null,
	) => FactoryResult | Falsy | void
	/** Called for every observed attribute mutation, in extension array order. */
	onAttributeChanged?: (
		instance: HTMLElement,
		name: string,
		oldValue: string | null,
		newValue: string | null,
	) => void
}

/** Precomputed, class-definition-time shape derived from an extensions array. */
type MergedExtensions = {
	staticProps: Record<string, unknown>
	observedAttributes: string[]
	reservedMembers: ReadonlySet<string>
	/** Maps a reserved member name to the extension that reserved it, for error messages. */
	reservedMemberOwners: ReadonlyMap<string, string>
}

/* === Exported Functions === */

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
const mergeExtensions = (
	component: string,
	extensions: readonly ComponentExtension[],
): MergedExtensions => {
	const staticProps: Record<string, unknown> = {}
	const owners: Record<string, string> = {}
	const observedAttributes: string[] = []
	const reservedMembers = new Set<string>()
	const reservedMemberOwners = new Map<string, string>()
	for (const ext of extensions) {
		for (const key of Object.keys(ext.staticProps ?? {})) {
			if (key in staticProps) {
				if (process.env.DEV_MODE === 'true')
					throw new ExtensionCollisionError(
						component,
						key,
						owners[key]!,
						ext.name,
					)
				continue
			}
			staticProps[key] = ext.staticProps![key]
			owners[key] = ext.name
		}
		for (const attr of ext.observedAttributes ?? [])
			if (!observedAttributes.includes(attr)) observedAttributes.push(attr)
		for (const member of ext.reservedMembers ?? []) {
			reservedMembers.add(member)
			if (!reservedMemberOwners.has(member))
				reservedMemberOwners.set(member, ext.name)
		}
	}
	return {
		staticProps,
		observedAttributes,
		reservedMembers,
		reservedMemberOwners,
	}
}

export { type ComponentExtension, type MergedExtensions, mergeExtensions }
