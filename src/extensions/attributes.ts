import type { ComponentExtension } from '../extension'
import { retainedInitializers } from '../internal'
import { isParser } from '../types'

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
