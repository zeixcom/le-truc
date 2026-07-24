import { valueString } from '@zeix/cause-effect'
import { elementName } from './util'

/* === Error Classes === */

/**
 * Error thrown when component name violates rules for custom element names
 *
 * @since 0.14.0
 */
class InvalidComponentNameError extends TypeError {
	/**
	 * @param {string} component - Component name
	 */
	constructor(component: string) {
		super(
			`Invalid component name "${component}". Custom element names must contain a hyphen, start with a lowercase letter, and contain only lowercase letters, numbers, and hyphens.`,
		)
		this.name = 'InvalidComponentNameError'
	}
}

/**
 * Error thrown when trying to assign a property name that conflicts with reserved words or inherited HTMLElement properties
 *
 * @since 0.14.0
 */
class InvalidPropertyNameError extends TypeError {
	/**
	 * @param {string} component - Component name
	 * @param {string} prop - Property name
	 * @param {string} reason - Explanation why the property is invalid
	 */
	constructor(component: string, prop: string, reason: string) {
		super(
			`Invalid property name "${prop}" for component <${component}>. ${reason}`,
		)
		this.name = 'InvalidPropertyNameError'
	}
}

/**
 * Error thrown when a required descendant element does not exist in a component's DOM subtree
 *
 * @since 0.14.0
 */
class MissingElementError extends Error {
	/**
	 * @param {HTMLElement} host - Host component
	 * @param {string} selector - Selector used to find the elements
	 * @param {string} required - Explanation why the element is required
	 */
	constructor(host: HTMLElement, selector: string, required: string) {
		super(
			`Missing required element <${selector}> in component ${elementName(host)}. ${required}`,
		)
		this.name = 'MissingElementError'
	}
}

/**
 * Error when a component's dependencies are not met within a specified timeout
 *
 * @since 0.14.0
 */
class DependencyTimeoutError extends Error {
	/**
	 * @param {HTMLElement} host - Host component
	 * @param {string[]} missing - List of missing dependencies
	 */
	constructor(host: HTMLElement, missing: string[]) {
		super(
			`Timeout waiting for: [${missing.join(', ')}] in component ${elementName(host)}.`,
		)
		this.name = 'DependencyTimeoutError'
	}
}

/**
 * Error thrown when reactives passed to a component are invalid
 *
 * @since 0.15.0
 */
class InvalidReactivesError extends TypeError {
	/**
	 * @param {HTMLElement} host - Host component
	 * @param {HTMLElement} target - Target component
	 * @param {unknown} reactives - Reactives passed to the component
	 */
	constructor(host: HTMLElement, target: HTMLElement, reactives: unknown) {
		super(
			`Expected reactives passed from ${elementName(host)} to ${elementName(target)} to be a record of signals, reactive property names or functions. Got ${valueString(reactives)}.`,
		)
		this.name = 'InvalidReactivesError'
	}
}

/**
 * Error thrown when target element is not a custom element as expected
 *
 * @since 0.15.0
 */
class InvalidCustomElementError extends TypeError {
	/**
	 * @param {HTMLElement} target - Target component
	 * @param {string} where - Location where the error occurred
	 */
	constructor(target: HTMLElement, where: string) {
		super(`Target ${elementName(target)} is not a custom element in ${where}.`)
		this.name = 'InvalidCustomElementError'
	}
}

/**
 * Error thrown when `pass()` cannot bind one or more properties on the target —
 * the property doesn't exist on the target, can't be resolved to a signal, or
 * isn't Slot-backed (the target is not a Le Truc component, or the property is
 * read-only/computed). See ADR 0011.
 *
 * @since 2.0.4
 */
class InvalidPassPropertyError extends TypeError {
	/**
	 * @param {HTMLElement} host - Host component passing the properties
	 * @param {HTMLElement} target - Target component the properties were passed to
	 * @param {Map<string, string>} reasons - Map of failing property name to the reason it could not be bound
	 */
	constructor(
		host: HTMLElement,
		target: HTMLElement,
		reasons: Map<string, string>,
	) {
		const detail = Array.from(
			reasons,
			([prop, reason]) => `'${prop}' ${reason}`,
		).join('; ')
		super(
			`Cannot pass from ${elementName(host)} to ${elementName(target)}: ${detail}.`,
		)
		this.name = 'InvalidPassPropertyError'
	}
}

/**
 * Error thrown when `watch()`, `on()`, `pass()`, `each()`, or `provideContexts()`
 * is called with no active effect-descriptor collector — i.e. not synchronously
 * during factory setup, an `each()` callback, or a `reconcile()` `bindItem`.
 * Common causes: calling the helper after an `await`, inside a detached
 * `setTimeout`, or from an event handler defined during setup. See ADR 0018.
 *
 * @since 2.3.0
 */
class NoActiveCollectorError extends Error {
	/**
	 * @param {HTMLElement | undefined} host - Host component the helper was called for, if known (`each()` and `reconcile()` aren't host-bound, so they have none)
	 * @param {string} helper - Name of the helper that was called (e.g. `'watch'`)
	 */
	constructor(host: HTMLElement | undefined, helper: string) {
		const where = host ? ` in component ${elementName(host)}` : ''
		super(
			`${helper}() called outside synchronous factory, each() callback, or reconcile() bindItem execution${where}.`
		)
		this.name = 'NoActiveCollectorError'
	}
}

/**
 * Error thrown when the template passed to `reconcile()` does not contain
 * exactly one root element in its content
 *
 * @since 2.3.0
 */
class InvalidTemplateError extends TypeError {
	/**
	 * @param {Element} container - Container element the template was meant to fill
	 * @param {number} count - Number of root elements found in the template content
	 */
	constructor(container: Element, count: number) {
		super(
			`Invalid template for reconcile() into ${elementName(container)}. Expected exactly 1 root element in the template content, found ${count}.`,
		)
		this.name = 'InvalidTemplateError'
	}
}

/**
 * Error thrown when a CSS selector passed to `all()` is malformed
 *
 * @since 2.0.4
 */
class InvalidSelectorError extends TypeError {
	/**
	 * @param {ParentNode} parent - Parent node the selector was queried against
	 * @param {string} selector - The malformed selector
	 * @param {unknown} cause - The error thrown by the DOM selector engine
	 */
	constructor(parent: ParentNode, selector: string, cause: unknown) {
		const where =
			typeof ShadowRoot !== 'undefined' && parent instanceof ShadowRoot
				? `${elementName(parent.host)} shadow root`
				: typeof Element !== 'undefined' && parent instanceof Element
					? elementName(parent)
					: 'document'
		super(
			`Invalid selector "${selector}" passed to all() in ${where}. ${cause instanceof Error ? cause.message : String(cause)}`,
		)
		this.name = 'InvalidSelectorError'
	}
}

export {
	DependencyTimeoutError,
	InvalidComponentNameError,
	InvalidCustomElementError,
	InvalidPassPropertyError,
	InvalidPropertyNameError,
	InvalidReactivesError,
	InvalidSelectorError,
	InvalidTemplateError,
	MissingElementError,
	NoActiveCollectorError,
}
