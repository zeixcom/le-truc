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
 * Error thrown when a required descendant element does not exist in a queried root's DOM subtree
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
 * target. See ADR 0011.
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
export { DependencyTimeoutError, ExtensionCollisionError, InvalidComponentNameError, InvalidCustomElementError, InvalidPassPropertyError, InvalidPropertyNameError, InvalidReactivesError, InvalidSelectorError, InvalidTemplateError, MissingElementError, NoActiveCollectorError, };
