import type { ComponentExtension } from '../extension';
/**
 * Genuinely empty NodeList for the `labels` fallback when `internals` is null.
 * `new NodeList()` throws `TypeError: Illegal constructor` — NodeList has no
 * public constructor. A DocumentFragment's `childNodes` is a live, permanently
 * empty NodeList, the idiomatic browser-side way to obtain an empty one.
 */
declare const EMPTY_NODELIST: NodeList;
/** Fallback ValidityState for when internals is null (attachInternals failed). */
declare const EMPTY_VALIDITY_STATE: ValidityState;
/**
 * Member-spec table: the single source of truth for the native-parity host
 * contract installed on form-associated components. Each entry maps a member
 * name to its property descriptor. Driving both the reserved set and the
 * prototype install from one table makes "reserved but not installed"
 * impossible.
 *
 * `disabled` is managed separately (Slot-backed reactive property installed
 * per-instance, not per-prototype). `value` is the deliberate exception: the
 * component must expose it.
 */
declare const HOST_CONTRACT_DESCRIPTORS: {
    readonly form: {
        readonly get: (this: HTMLElement) => HTMLFormElement | null;
        readonly enumerable: true;
        readonly configurable: true;
    };
    readonly name: {
        readonly get: (this: HTMLElement) => string;
        readonly set: (this: HTMLElement, v: string) => void;
        readonly enumerable: true;
        readonly configurable: true;
    };
    readonly labels: {
        readonly get: (this: HTMLElement) => NodeList;
        readonly enumerable: true;
        readonly configurable: true;
    };
    readonly validity: {
        readonly get: (this: HTMLElement) => ValidityState;
        readonly enumerable: true;
        readonly configurable: true;
    };
    readonly validationMessage: {
        readonly get: (this: HTMLElement) => string;
        readonly enumerable: true;
        readonly configurable: true;
    };
    readonly willValidate: {
        readonly get: (this: HTMLElement) => boolean;
        readonly enumerable: true;
        readonly configurable: true;
    };
    readonly checkValidity: {
        readonly value: (this: HTMLElement) => boolean;
        readonly enumerable: true;
        readonly configurable: true;
        readonly writable: true;
    };
    readonly reportValidity: {
        readonly value: (this: HTMLElement) => boolean;
        readonly enumerable: true;
        readonly configurable: true;
        readonly writable: true;
    };
    readonly setCustomValidity: {
        readonly value: (this: HTMLElement, message: string) => void;
        readonly enumerable: true;
        readonly configurable: true;
        readonly writable: true;
    };
};
/**
 * Managed member names reserved on form-associated components. Derived from
 * the host-contract table plus `disabled` (managed per-instance).
 *
 * `expose()` throws `InvalidPropertyNameError` for any of these names on a
 * form-associated component — the check runs before the `prop in this` guard,
 * which would otherwise silently skip the colliding initializer (these are
 * prototype-defined). `value` is the deliberate exception: the component must
 * expose it.
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
 * @param host - The component host element
 * @returns {HTMLElement} The anchor element (descendant or host)
 */
declare const resolveAnchor: (host: HTMLElement) => HTMLElement;
/**
 * Managed `setCustomValidity` implementation. Delegates to
 * `internals.setValidity`, setting `{ customError: true }` (or clearing it)
 * and the message. The anchor is resolved via the managed heuristic so the
 * browser can focus the control on blocked submission.
 *
 * `internals.setValidity` is itself wrapped by
 * {@link createManagedValidityProperties} to keep the
 * `validationMessage` signal in sync, so this call is what makes
 * `setCustomValidity` reactive: called from outside the component (e.g. an
 * app reacting to a server-side validation error), a
 * `watch('validationMessage', …)` in the component's own factory now reruns,
 * where previously only `ElementInternals` (and thus native validity UI) saw
 * the change.
 *
 * @since 2.3
 * @internal
 */
declare const managedSetCustomValidity: (internals: ElementInternals, host: HTMLElement, message: string) => void;
/**
 * Install the native-parity host contract and managed form lifecycle callbacks
 * on a prototype. Called only for form-associated components.
 *
 * Installs:
 * - Property descriptors from {@link HOST_CONTRACT_DESCRIPTORS} (form, name,
 *   labels, validity, validationMessage, willValidate, checkValidity,
 *   reportValidity, setCustomValidity).
 * - The three managed lifecycle callbacks: `formResetCallback`,
 *   `formStateRestoreCallback`, `formDisabledCallback`.
 *
 * @since 2.3
 * @internal
 * @param proto - The prototype to install members on
 */
declare const installFormAssociatedMembers: (proto: HTMLElement) => void;
/**
 * Install the native-parity host contract and managed form lifecycle
 * callbacks for a checkbox-shaped component (`formAssociatedCheckbox()`):
 * same host contract as {@link installFormAssociatedMembers}, but
 * `formResetCallback`/`formStateRestoreCallback` target `checked` instead of
 * `value`.
 *
 * @since 2.3
 * @internal
 * @param proto - The prototype to install members on
 */
declare const installFormAssociatedCheckboxMembers: (proto: HTMLElement) => void;
/** Brand distinguishing the form-associated extension at the type level. */
type FormAssociatedTag = {
    readonly __kind: 'form-associated';
};
/** The `ComponentExtension` returned by {@link formAssociated}. */
type FormAssociatedExtension = ComponentExtension & FormAssociatedTag;
/**
 * Extension enabling the managed form-control convention: native-parity host
 * contract (`form`, `name`, `labels`, `validity`, ...), managed `disabled`,
 * value sync to `internals.setFormValue`, reset, and state restore. Pass to
 * `defineComponent`'s third parameter: `defineComponent(name, factory,
 * [formAssociated()])`.
 *
 * `component.ts` never imports this module at the value level, so a
 * consumer who doesn't call `formAssociated()` never bundles ElementInternals
 * support.
 *
 * @since 2.3
 */
declare const formAssociated: () => FormAssociatedExtension;
/** Brand distinguishing the checkbox-shaped form-associated extension. */
type FormAssociatedCheckboxTag = {
    readonly __kind: 'form-associated-checkbox';
};
/** The `ComponentExtension` returned by {@link formAssociatedCheckbox}. */
type FormAssociatedCheckboxExtension = ComponentExtension & FormAssociatedCheckboxTag;
/**
 * Extension enabling the managed checkbox-shaped form-control convention:
 * native-parity host contract (`form`, `name`, `labels`, `validity`, ...),
 * managed `disabled`, value sync to `internals.setFormValue` (submitting
 * nothing when unchecked, matching native `<input type="checkbox">`), reset,
 * and state restore, keyed on a reactive `checked: boolean` prop instead of
 * `formAssociated()`'s `value`. Pass to `defineComponent`'s third parameter:
 * `defineComponent(name, factory, [formAssociatedCheckbox()])`.
 *
 * Covers checkbox-*shaped* controls generically (a switch/toggle is always a
 * styled checkbox, not a distinct native form control), not radio groups or
 * multi-select lists — those aggregate many children's boolean state into
 * one string `value` and already fit `formAssociated()` (see
 * `form-radiogroup`, `form-listbox`).
 *
 * `component.ts` never imports this module at the value level, so a
 * consumer who doesn't call `formAssociatedCheckbox()` never bundles this code.
 *
 * **Do not combine with `formAssociated()` on the same component** — both
 * declare the same `staticProps.formAssociated` key, so DEV_MODE throws
 * `ExtensionCollisionError`; in production, whichever extension is later in
 * the array silently wins `installOnPrototype` while the earlier one wins
 * `staticProps`, an inconsistent, undocumented-by-design split (see ADR
 * 0019's Consequences).
 *
 * @since 2.3
 */
declare const formAssociatedCheckbox: () => FormAssociatedCheckboxExtension;
export { EMPTY_NODELIST, EMPTY_VALIDITY_STATE, FOCUSABLE_FORM_CONTROL_SELECTOR, type FormAssociatedCheckboxExtension, type FormAssociatedCheckboxTag, type FormAssociatedExtension, type FormAssociatedTag, formAssociated, formAssociatedCheckbox, HOST_CONTRACT_DESCRIPTORS, installFormAssociatedCheckboxMembers, installFormAssociatedMembers, MANAGED_FORM_MEMBERS, managedSetCustomValidity, resolveAnchor, };
