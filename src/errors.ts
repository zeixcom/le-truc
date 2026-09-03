import { valueString } from '@zeix/cause-effect'
import { describeRoot, elementName } from './util'

/* === Diagnostic Reporting === */

/**
 * Reports a whole-component connect failure that was contained instead of allowed to escape `connectedCallback`.
 *
 * Tier 2 of [ADR 0028](../adr/0028-tiered-error-surfacing.md): one broken
 * component never takes the page's other components down, and that
 * containment does not depend on which wrapper the host runtime happens to
 * put around `connectedCallback`. The component degrades to its
 * server-rendered markup, which is already the correct pre-JS state
 * (ADR 0003) — this is a component that did not enhance, not a broken page.
 *
 * @since 3.0.0
 * @param host - Component instance whose connect failed
 * @param phase - What was running when it threw, for the DEV_MODE diagnostic
 * @param error - The thrown value
 */
const reportConnectFailure = (
	host: HTMLElement,
	phase: string,
	error: unknown,
): void => {
	if (process.env.DEV_MODE === 'true')
		console.error(
			`Connect failed in ${elementName(host)} while running ${phase}. The component keeps its server-rendered markup and does not enhance. Other components are unaffected.`,
			error,
		)
	else console.error(`Connect failed in ${elementName(host)}:`, error)
}

/**
 * Reports a single effect descriptor that threw while activating.
 *
 * Activation is contained per descriptor (ADR 0028 sub-design 3), so the
 * component's other effects still activate — which means the diagnostic has
 * to name *which* effect failed, or a partially enhanced component is not
 * debuggable.
 *
 * @since 3.0.0
 * @param host - Component instance the descriptor belongs to
 * @param descriptor - Description of the failing effect, e.g. `"watch()"`
 * @param error - The thrown value
 */
const reportEffectFailure = (
	host: HTMLElement,
	descriptor: string,
	error: unknown,
): void => {
	if (process.env.DEV_MODE === 'true')
		console.error(
			`${descriptor} failed to activate in ${elementName(host)}. This effect does not run; the component's other effects are unaffected.`,
			error,
		)
	else
		console.error(
			`${descriptor} failed to activate in ${elementName(host)}:`,
			error,
		)
}

/* === Error Classes === */

/**
 * Error thrown when component name violates rules for custom element names
 *
 * @since 0.14.0
 */
class InvalidComponentNameError extends TypeError {
	/**
	 * @param component - Component name
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
	 * @param component - Component name
	 * @param prop - Property name
	 * @param reason - Explanation why the property is invalid
	 */
	constructor(component: string, prop: string, reason: string) {
		super(
			`Invalid property name "${prop}" for component <${component}>. ${reason}`,
		)
		this.name = 'InvalidPropertyNameError'
	}
}

/**
 * Error thrown when a required descendant element does not exist in a queried root's DOM subtree
 *
 * @since 0.14.0
 */
class MissingElementError extends Error {
	/**
	 * @param root - Node the selector was queried against
	 * @param selector - Selector used to find the elements
	 * @param required - Explanation why the element is required
	 * @param contextLabel - Noun describing `root` in the message; defaults to `'component'`
	 */
	constructor(
		root: ParentNode,
		selector: string,
		required: string,
		contextLabel: string = 'component',
	) {
		super(
			`Missing required element <${selector}> in ${contextLabel} ${describeRoot(root)}. ${required}`,
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
	 * @param host - Host component
	 * @param missing - List of missing dependencies
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
	 * @param host - Host component
	 * @param target - Target component
	 * @param reactives - Reactives passed to the component
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
	 * @param target - Target component
	 * @param where - Location where the error occurred
	 */
	constructor(target: HTMLElement, where: string) {
		super(`Target ${elementName(target)} is not a custom element in ${where}.`)
		this.name = 'InvalidCustomElementError'
	}
}

/**
 * Error thrown when `pass()` cannot bind one or more properties on the
 * target. See ADR 0011.
 *
 * @since 2.0.4
 */
class InvalidPassPropertyError extends TypeError {
	/**
	 * @param host - Host component passing the properties
	 * @param target - Target component the properties were passed to
	 * @param reasons - Map of failing property name to the reason it could not be bound
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
 * Error thrown when `watch()`, `on()`, `pass()`, `each()`, or
 * `provideContexts()` is called outside synchronous factory setup, an
 * `each()` callback, or a `reconcile()` `bindItem`. See ADR 0018.
 *
 * @since 2.3.0
 */
class NoActiveCollectorError extends Error {
	/**
	 * @param host - Host component the helper was called for, if known
	 * @param helper - Name of the helper that was called (e.g. `'watch'`)
	 */
	constructor(host: HTMLElement | undefined, helper: string) {
		const where = host ? ` in component ${elementName(host)}` : ''
		super(
			`${helper}() called outside synchronous factory, each() callback, or reconcile() bindItem execution${where}.`,
		)
		this.name = 'NoActiveCollectorError'
	}
}

/**
 * Error thrown when the template passed to `reconcile()` does not contain
 * exactly one root element in its content.
 *
 * @since 2.3.0
 */
class InvalidTemplateError extends TypeError {
	/**
	 * @param container - Container element the template was meant to fill
	 * @param count - Number of root elements found in the template content
	 */
	constructor(container: Element, count: number) {
		super(
			`Invalid template for reconcile() into ${elementName(container)}. Expected exactly 1 root element in the template content, found ${count}.`,
		)
		this.name = 'InvalidTemplateError'
	}
}

/**
 * Error thrown in DEV_MODE when two extensions passed to `defineComponent()`
 * declare the same `staticProps` key. In production, the first extension to
 * declare the key wins and the rest are silently ignored.
 *
 * @since 2.3
 */
class ExtensionCollisionError extends Error {
	/**
	 * @param component - Component name
	 * @param key - The colliding `staticProps` key
	 * @param first - Name of the extension that first declared `key`
	 * @param second - Name of the extension whose declaration was ignored
	 */
	constructor(component: string, key: string, first: string, second: string) {
		super(
			`Extension collision for component <${component}>: both '${first}' and '${second}' declare staticProps key "${key}". The '${second}' declaration is ignored.`,
		)
		this.name = 'ExtensionCollisionError'
	}
}

/**
 * Error thrown when a CSS selector passed to `all()` is malformed.
 *
 * @since 2.0.4
 */
class InvalidSelectorError extends TypeError {
	/**
	 * @param parent - Parent node the selector was queried against
	 * @param selector - The malformed selector
	 * @param cause - The error thrown by the DOM selector engine
	 */
	constructor(parent: ParentNode, selector: string, cause: unknown) {
		super(
			`Invalid selector "${selector}" passed to all() in ${describeRoot(parent)}. ${cause instanceof Error ? cause.message : String(cause)}`,
		)
		this.name = 'InvalidSelectorError'
	}
}

/**
 * Error thrown when `safeSetAttribute()` blocks an attribute write.
 *
 * Two conditions, both of which fire on runtime *data* rather than on source
 * shape, so neither is decidable by the compiler (ADR 0028 inventory): an
 * attribute name starting with `on`, and a value using an unsafe URL protocol
 * ([M16](../REQUIREMENTS.md#m16-security-validation-in-setattribute),
 * [ADR 0009](../adr/0009-security-validation-in-bindattribute.md)).
 *
 * The security guarantee is that the `setAttribute` does not happen — not
 * that the throw escapes — so this is Tier 2 and contained like any other
 * activation failure.
 *
 * @since 3.0.0
 */
class UnsafeAttributeError extends TypeError {
	/**
	 * @param element - Element the attribute was to be set on
	 * @param attr - Attribute name
	 * @param reason - Why the write was blocked
	 * @param value - Attribute value, when the value is what was unsafe
	 */
	constructor(element: Element, attr: string, reason: string, value?: string) {
		super(
			`Blocked unsafe setAttribute('${attr}') on ${elementName(element)}: ${reason}${value !== undefined ? ` Got '${value}'.` : ''}`,
		)
		this.name = 'UnsafeAttributeError'
	}
}

export {
	DependencyTimeoutError,
	ExtensionCollisionError,
	InvalidComponentNameError,
	InvalidCustomElementError,
	InvalidPassPropertyError,
	InvalidPropertyNameError,
	InvalidReactivesError,
	InvalidSelectorError,
	InvalidTemplateError,
	MissingElementError,
	NoActiveCollectorError,
	reportConnectFailure,
	reportEffectFailure,
	UnsafeAttributeError,
}
