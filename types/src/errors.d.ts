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
declare const reportConnectFailure: (host: HTMLElement, phase: string, error: unknown) => void;
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
declare const reportEffectFailure: (host: HTMLElement, descriptor: string, error: unknown) => void;
/**
 * Error thrown when component name violates rules for custom element names
 *
 * @since 0.14.0
 */
declare class InvalidComponentNameError extends TypeError {
    /**
     * @param component - Component name
     */
    constructor(component: string);
}
/**
 * Error thrown when trying to assign a property name that conflicts with reserved words or inherited HTMLElement properties
 *
 * @since 0.14.0
 */
declare class InvalidPropertyNameError extends TypeError {
    /**
     * @param component - Component name
     * @param prop - Property name
     * @param reason - Explanation why the property is invalid
     */
    constructor(component: string, prop: string, reason: string);
}
/**
 * Error thrown when a required descendant element does not exist in a queried
 * root's DOM subtree.
 *
 * @since 0.14.0
 */
declare class MissingElementError extends Error {
    /**
     * @param root - Node the selector was queried against
     * @param selector - Selector used to find the elements
     * @param required - Explanation why the element is required
     * @param contextLabel - Noun describing `root` in the message; defaults to `'component'`
     */
    constructor(root: ParentNode, selector: string, required: string, contextLabel?: string);
}
/**
 * Error when a component's dependencies are not met within a specified timeout
 *
 * @since 0.14.0
 */
declare class DependencyTimeoutError extends Error {
    /**
     * @param host - Host component
     * @param missing - List of missing dependencies
     */
    constructor(host: HTMLElement, missing: string[]);
}
/**
 * Error thrown when reactives passed to a component are invalid
 *
 * @since 0.15.0
 */
declare class InvalidReactivesError extends TypeError {
    /**
     * @param host - Host component
     * @param target - Target component
     * @param reactives - Reactives passed to the component
     */
    constructor(host: HTMLElement, target: HTMLElement, reactives: unknown);
}
/**
 * Error thrown when target element is not a custom element as expected
 *
 * @since 0.15.0
 */
declare class InvalidCustomElementError extends TypeError {
    /**
     * @param target - Target component
     * @param where - Location where the error occurred
     */
    constructor(target: HTMLElement, where: string);
}
/**
 * Error thrown when `pass()` cannot bind one or more properties on the
 * target.
 *
 * Tier 2 ([ADR 0028](../adr/0028-tiered-error-surfacing.md), which supersedes
 * ADR 0011): `TSRX012` decides the same question at compile time for a
 * registry-known target, so this is the backstop for hand-authored and
 * foreign custom elements. Validation is eager and the commit is atomic — a
 * failure leaves the target exactly as it was.
 *
 * @since 2.0.4
 */
declare class InvalidPassPropertyError extends TypeError {
    /**
     * @param host - Host component passing the properties
     * @param target - Target component the properties were passed to
     * @param reasons - Map of failing property name to the reason it could not be bound
     */
    constructor(host: HTMLElement, target: HTMLElement, reasons: Map<string, string>);
}
/**
 * Error thrown when `watch()`, `on()`, `pass()`, `each()`, or
 * `provideContexts()` is called outside synchronous factory setup, an
 * `each()` callback, or a `reconcile()` `bindItem`. See ADR 0018.
 *
 * @since 2.3.0
 */
declare class NoActiveCollectorError extends Error {
    /**
     * @param host - Host component the helper was called for, if known
     * @param helper - Name of the helper that was called (e.g. `'watch'`)
     */
    constructor(host: HTMLElement | undefined, helper: string);
}
/**
 * Error thrown when the template passed to `reconcile()` does not contain
 * exactly one root element in its content.
 *
 * @since 2.3.0
 */
declare class InvalidTemplateError extends TypeError {
    /**
     * @param container - Container element the template was meant to fill
     * @param count - Number of root elements found in the template content
     */
    constructor(container: Element, count: number);
}
/**
 * Error thrown in DEV_MODE when two extensions passed to `defineComponent()`
 * declare the same `staticProps` key. In production, the first extension to
 * declare the key wins and the rest are silently ignored.
 *
 * @since 2.3
 */
declare class ExtensionCollisionError extends Error {
    /**
     * @param component - Component name
     * @param key - The colliding `staticProps` key
     * @param first - Name of the extension that first declared `key`
     * @param second - Name of the extension whose declaration was ignored
     */
    constructor(component: string, key: string, first: string, second: string);
}
/**
 * Error thrown when a CSS selector passed to `all()` is malformed.
 *
 * @since 2.0.4
 */
declare class InvalidSelectorError extends TypeError {
    /**
     * @param parent - Parent node the selector was queried against
     * @param selector - The malformed selector
     * @param cause - The error thrown by the DOM selector engine
     */
    constructor(parent: ParentNode, selector: string, cause: unknown);
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
declare class UnsafeAttributeError extends TypeError {
    /**
     * @param element - Element the attribute was to be set on
     * @param attr - Attribute name
     * @param reason - Why the write was blocked
     * @param value - Attribute value, when the value is what was unsafe
     */
    constructor(element: Element, attr: string, reason: string, value?: string);
}
export { DependencyTimeoutError, ExtensionCollisionError, InvalidComponentNameError, InvalidCustomElementError, InvalidPassPropertyError, InvalidPropertyNameError, InvalidReactivesError, InvalidSelectorError, InvalidTemplateError, MissingElementError, NoActiveCollectorError, reportConnectFailure, reportEffectFailure, UnsafeAttributeError, };
