import type { ComponentProps, EffectDescriptor, FormState } from '../types';
/**
 * The `onFormAssociated` helper type in `FactoryContext`.
 *
 * Registers a handler for `formAssociatedCallback(form)`. The browser calls
 * this when the element is associated with (or disassociated from) a `<form>`.
 * Returns an `EffectDescriptor`.
 */
type OnFormAssociatedHelper = (handler: (form: HTMLFormElement | null) => void) => EffectDescriptor;
/**
 * The `onFormDisabled` helper type in `FactoryContext`.
 *
 * Registers a handler for `formDisabledCallback(disabled)`. The browser calls
 * this when the owning form's `disabled` state changes (e.g. `<fieldset disabled>`).
 * Returns an `EffectDescriptor`.
 */
type OnFormDisabledHelper = (handler: (disabled: boolean) => void) => EffectDescriptor;
/**
 * The `onFormReset` helper type in `FactoryContext`.
 *
 * Registers a handler for `formResetCallback()`. The browser calls this when
 * the owning form is reset. Returns an `EffectDescriptor`.
 */
type OnFormResetHelper = (handler: () => void) => EffectDescriptor;
/**
 * The `onFormStateRestore` helper type in `FactoryContext`.
 *
 * Registers a handler for `formStateRestoreCallback(state, mode)`. The browser
 * calls this during back/forward navigation or bfcache restoration with the
 * state value previously set via `setFormValue(value, state)`.
 * Returns an `EffectDescriptor`.
 */
type OnFormStateRestoreHelper = (handler: (state: FormState, mode: string) => void) => EffectDescriptor;
/**
 * The four form-lifecycle helper functions bound to a component host.
 *
 * Each registers a handler for the corresponding form-associated callback
 * and returns an `EffectDescriptor` — consistent with the `on()` pattern.
 */
type FormHelpers = {
    onFormAssociated: OnFormAssociatedHelper;
    onFormDisabled: OnFormDisabledHelper;
    onFormReset: OnFormResetHelper;
    onFormStateRestore: OnFormStateRestoreHelper;
};
/**
 * Create the form-lifecycle helpers bound to a component host.
 *
 * Each helper registers a handler in the instance's `FormHandlers` map (stored
 * in a module-private WeakMap) and returns an `EffectDescriptor`. The `Truc`
 * class implements stub callbacks that delegate to these registered handlers.
 *
 * `onFormAssociated` has a late-registration guard: if `formAssociatedCallback`
 * has already fired (form association happens during DOM insertion, which can
 * precede the effect-activation phase that waits on dependency resolution),
 * the handler is replayed with the cached form value on activation.
 *
 * @since 2.3
 * @param {HTMLElement & P} host - The component host element
 * @returns {FormHelpers} Bound form-lifecycle helpers for the given host
 */
declare const makeFormHelpers: <P extends ComponentProps>(host: HTMLElement & P) => FormHelpers;
export { type FormHelpers, makeFormHelpers, type OnFormAssociatedHelper, type OnFormDisabledHelper, type OnFormResetHelper, type OnFormStateRestoreHelper, };
