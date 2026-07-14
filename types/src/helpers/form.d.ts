/**
 * Managed member names reserved on form-associated components.
 *
 * These are the native form-control members the generated class defines on the
 * host when `formAssociated: true`, delegating to `internals`. `expose()` throws
 * `InvalidPropertyNameError` for any of these names on a form-associated
 * component — the check runs before the `prop in this` guard, which would
 * otherwise silently skip the colliding initializer (these are prototype-defined).
 * `value` is the deliberate exception: the component must expose it.
 */
declare const MANAGED_FORM_MEMBERS: ReadonlySet<string>;
/** Selector for the managed validation-anchor heuristic. */
declare const FOCUSABLE_FORM_CONTROL_SELECTOR = "input, select, textarea, button, [tabindex]";
/**
 * Resolve the validation anchor for `setValidity`: the first focusable
 * form-control descendant, falling back to the host. Le Truc hosts are
 * typically not focusable themselves, so a descendant anchor is needed for the
 * browser to focus the control and show the validation bubble on blocked
 * submission or `reportValidity()`.
 *
 * @since 2.3
 * @param {HTMLElement} host - The component host element
 * @returns {HTMLElement} The anchor element (descendant or host)
 */
declare const resolveAnchor: (host: HTMLElement) => HTMLElement;
/**
 * Managed `setCustomValidity` implementation. Delegates to
 * `internals.setValidity`, setting `{ customError: true }` (or clearing it)
 * and the message. The anchor is resolved via the managed heuristic so the
 * browser can focus the control on blocked submission.
 *
 * @since 2.3
 * @internal
 */
declare const managedSetCustomValidity: (internals: ElementInternals, host: HTMLElement, message: string) => void;
export { FOCUSABLE_FORM_CONTROL_SELECTOR, MANAGED_FORM_MEMBERS, managedSetCustomValidity, resolveAnchor, };
