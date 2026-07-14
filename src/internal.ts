import type { Signal } from '@zeix/cause-effect'
import type { FormState } from './types'

/* === Types === */

/**
 * Handler map for the four form-associated lifecycle callbacks.
 *
 * The `Truc` class implements stub callbacks that delegate to the functions
 * registered here via the `onForm*()` factory helpers. The `form` field tracks
 * the current form association so a late-registered `onFormAssociated` handler
 * can be replayed when `formAssociatedCallback` has already fired (first connect
 * with unresolved child dependencies — the handler activates after dependency
 * resolution, but `formAssociatedCallback` fires during DOM insertion).
 */
type FormHandlers = {
	associated?: (form: HTMLFormElement | null) => void
	disabled?: (disabled: boolean) => void
	reset?: () => void
	stateRestore?: (state: FormState, mode: string) => void
	/**
	 * Current form association. `undefined` = `formAssociatedCallback` has not
	 * fired yet; `null` = disassociated; `HTMLFormElement` = associated.
	 */
	form: HTMLFormElement | null | undefined
}

/* === Constants === */

/**
 * How long (ms) to wait for child custom elements to be defined before
 * activating effects anyway (progressive enhancement). See `resolveDependencies`
 * in `src/helpers/dom.ts`.
 */
const DEPENDENCY_TIMEOUT = 200

/**
 * How long (ms) to wait before the final `context-request` re-dispatch.
 *
 * **Invariant: must strictly exceed {@link DEPENDENCY_TIMEOUT}**, enforced by
 * deriving it from that constant. The retry fires *after* the
 * dependency-resolution window closes, so a provider whose own
 * `provideContexts` listener activated late (it waited on
 * `customElements.whenDefined()` for a slow child) still catches the retry.
 * If this dropped below `DEPENDENCY_TIMEOUT`, late providers would be missed
 * and consumers would permanently lock in their fallback (see ADR-0015).
 * The 10 ms margin covers event-loop scheduling jitter between the dependency
 * timeout firing and the provider's listener activating.
 */
const CONTEXT_RETRY_DELAY = DEPENDENCY_TIMEOUT + 10

/* === Internal Shared State === */

/** Module-internal map from component instances to their signal records. */
const componentSignals = new WeakMap<
	HTMLElement,
	Record<string, Signal<unknown & {}>>
>()

/** Module-internal map from component instances to their form lifecycle handlers. */
const componentFormHandlers = new WeakMap<HTMLElement, FormHandlers>()

/** Get the signals map for a component, creating it if needed. */
const getSignals = (el: HTMLElement): Record<string, Signal<unknown & {}>> => {
	let signals = componentSignals.get(el)
	if (!signals) {
		signals = {}
		componentSignals.set(el, signals)
	}
	return signals
}

/** Get the form handlers map for a component, creating it if needed. */
const getFormHandlers = (el: HTMLElement): FormHandlers => {
	let handlers = componentFormHandlers.get(el)
	if (!handlers) {
		handlers = { form: undefined }
		componentFormHandlers.set(el, handlers)
	}
	return handlers
}

export {
	CONTEXT_RETRY_DELAY,
	DEPENDENCY_TIMEOUT,
	type FormHandlers,
	type FormState,
	getFormHandlers,
	getSignals,
}
