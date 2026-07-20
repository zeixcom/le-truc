/**
 * Error thrown when component name violates rules for custom element names
 *
 * @since 0.14.0
 */
declare class InvalidComponentNameError extends TypeError {
    /**
     * @param {string} component - Component name
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
     * @param {string} component - Component name
     * @param {string} prop - Property name
     * @param {string} reason - Explanation why the property is invalid
     */
    constructor(component: string, prop: string, reason: string);
}
/**
 * Error thrown when a required descendant element does not exist in a component's DOM subtree
 *
 * @since 0.14.0
 */
declare class MissingElementError extends Error {
    /**
     * @param {HTMLElement} host - Host component
     * @param {string} selector - Selector used to find the elements
     * @param {string} required - Explanation why the element is required
     */
    constructor(host: HTMLElement, selector: string, required: string);
}
/**
 * Error when a component's dependencies are not met within a specified timeout
 *
 * @since 0.14.0
 */
declare class DependencyTimeoutError extends Error {
    /**
     * @param {HTMLElement} host - Host component
     * @param {string[]} missing - List of missing dependencies
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
     * @param {HTMLElement} host - Host component
     * @param {HTMLElement} target - Target component
     * @param {unknown} reactives - Reactives passed to the component
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
     * @param {HTMLElement} target - Target component
     * @param {string} where - Location where the error occurred
     */
    constructor(target: HTMLElement, where: string);
}
/**
 * Error thrown when `pass()` cannot bind one or more properties on the target —
 * the property doesn't exist on the target, can't be resolved to a signal, or
 * isn't Slot-backed (the target is not a Le Truc component, or the property is
 * read-only/computed). See ADR 0011.
 *
 * @since 2.0.4
 */
declare class InvalidPassPropertyError extends TypeError {
    /**
     * @param {HTMLElement} host - Host component passing the properties
     * @param {HTMLElement} target - Target component the properties were passed to
     * @param {Map<string, string>} reasons - Map of failing property name to the reason it could not be bound
     */
    constructor(host: HTMLElement, target: HTMLElement, reasons: Map<string, string>);
}
/**
 * Error thrown when `watch()`, `on()`, `pass()`, `each()`, or `provideContexts()`
 * is called with no active effect-descriptor collector — i.e. not synchronously
 * during factory setup or an `each()` callback. Common causes: calling the
 * helper after an `await`, inside a detached `setTimeout`, or from an event
 * handler defined during setup. See ADR 0018.
 *
 * @since 2.3.0
 */
declare class NoActiveCollectorError extends Error {
    /**
     * @param {HTMLElement | undefined} host - Host component the helper was called for, if known (`each()` isn't host-bound, so it has none)
     * @param {string} helper - Name of the helper that was called (e.g. `'watch'`)
     */
    constructor(host: HTMLElement | undefined, helper: string);
}
/**
 * Error thrown when the template passed to `reconcile()` does not contain
 * exactly one root element in its content
 *
 * @since 2.3.0
 */
declare class InvalidTemplateError extends TypeError {
    /**
     * @param {Element} container - Container element the template was meant to fill
     * @param {number} count - Number of root elements found in the template content
     */
    constructor(container: Element, count: number);
}
/**
 * Error thrown when a CSS selector passed to `all()` is malformed
 *
 * @since 2.0.4
 */
declare class InvalidSelectorError extends TypeError {
    /**
     * @param {ParentNode} parent - Parent node the selector was queried against
     * @param {string} selector - The malformed selector
     * @param {unknown} cause - The error thrown by the DOM selector engine
     */
    constructor(parent: ParentNode, selector: string, cause: unknown);
}
export { DependencyTimeoutError, InvalidComponentNameError, InvalidCustomElementError, InvalidPassPropertyError, InvalidPropertyNameError, InvalidReactivesError, InvalidSelectorError, InvalidTemplateError, MissingElementError, NoActiveCollectorError, };
