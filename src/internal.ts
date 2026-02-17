import type { Signal } from '@zeix/cause-effect'

/* === Internal Shared State === */

/** Module-internal map from component instances to their signal records. */
const componentSignals = new WeakMap<HTMLElement, Record<string, Signal<any>>>()

/** Get the signals map for a component, creating it if needed. */
const getSignals = (el: HTMLElement): Record<string, Signal<any>> => {
	let signals = componentSignals.get(el)
	if (!signals) {
		signals = {}
		componentSignals.set(el, signals)
	}
	return signals
}

export { getSignals }
