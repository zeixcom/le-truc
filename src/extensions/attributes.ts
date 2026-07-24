/**
 * Opt-in attribute-driven reactivity — the escape hatch ADR 0003 reserved
 * for interop when v2.0 dropped `observedAttributes`/`attributeChangedCallback`
 * in favor of properties as the reactive interface (REQUIREMENTS.md X1,
 * motivated chiefly by frameworks like React that set DOM attributes on
 * custom elements rather than properties).
 *
 * Properties remain the primary reactive interface; this only re-parses an
 * already-`expose()`d Parser-backed prop when its attribute mutates after
 * connect. Only referenced by consumers who call `observedAttributes()` —
 * `component.ts` never imports this module at the value level.
 */

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
