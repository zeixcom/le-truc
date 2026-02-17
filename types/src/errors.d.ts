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
 * Error thrown when setup function does not return effects
 *
 * @since 0.14.0
 */
declare class InvalidEffectsError extends TypeError {
    /**
     * @param {HTMLElement} host - Host component
     * @param {Error} cause - Error that caused the invalid effects
     */
    constructor(host: HTMLElement, cause?: Error);
}
/**
 * Error thrown when a required desacendent element does not exist in a component's DOM subtree
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
export { DependencyTimeoutError, InvalidComponentNameError, InvalidCustomElementError, InvalidPropertyNameError, InvalidEffectsError, InvalidReactivesError, MissingElementError, };
