import type { ComponentExtension } from '../extension'
import { retainedInitializers } from '../internal'
import { isParser } from '../types'

/**
 * Extension that keeps a Parser-backed reactive property in sync with its attribute after connect.
 * Attributes normally drive state only once, at connect time; see ADR 0003.
 * Re-runs the retained Parser on each attribute mutation; props without a Parser initializer are left untouched.
 *
 * @since 2.3
 * @param names - Attribute names to observe after connect.
 * @returns A `ComponentExtension` for `defineComponent`'s third parameter.
 */
const observedAttributes = (names: readonly string[]): ComponentExtension => ({
	name: 'observedAttributes',
	observedAttributes: names,
	onAttributeChanged: (instance, name, _oldValue, newValue) => {
		const initializer = retainedInitializers.get(instance)?.[name]
		if (!isParser(initializer)) return
		const result = initializer(newValue)
		if (result != null) (instance as any)[name] = result
	},
})

export { observedAttributes }
