import type { ComponentExtension } from '../extension';
/** The `ComponentExtension` returned by {@link formAssociated}. */
type FormAssociatedExtension = ComponentExtension & {
    readonly __kind: 'form-associated';
};
/** The `ComponentExtension` returned by {@link formAssociatedCheckbox}. */
type FormAssociatedCheckboxExtension = ComponentExtension & {
    readonly __kind: 'form-associated-checkbox';
};
/**
 * Structural shape required by {@link relayValidity}: any element exposing
 * the native Constraint Validation trio. `HTMLInputElement`,
 * `HTMLSelectElement`, `HTMLTextAreaElement`, `HTMLButtonElement`, and others
 * all satisfy this without a cast.
 */
type ValidatableControl = HTMLElement & {
    readonly validity: ValidityState;
    readonly validationMessage: string;
    checkValidity(): boolean;
};
/**
 * Fallback message when a flag is `true` but no real message is available.
 * Native controls barred from constraint validation (`disabled`, or
 * `readonly` on `type="number"`/`text`/etc.) always report an empty
 * `validationMessage` even though their `.validity` flags stay live —
 * {@link relayValidity} relaying such a control hits this on the *first*
 * flag transition, before any prior message exists to fall back to.
 */
declare const FALLBACK_VALIDITY_MESSAGE = "Invalid value";
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
/**
 * Extension enabling the managed checkbox-shaped form-control convention:
 * same host contract as {@link formAssociated}, but value sync submits
 * nothing when unchecked (matching native `<input type="checkbox">`), keyed
 * on a reactive `checked: boolean` prop instead of `value`. Pass to
 * `defineComponent`'s third parameter: `defineComponent(name, factory,
 * [formAssociatedCheckbox()])`.
 *
 * Covers checkbox-*shaped* controls generically (a switch/toggle is always a
 * styled checkbox, not a distinct native form control), not radio groups or
 * multi-select lists — those aggregate many children's boolean state into
 * one string `value` and already fit `formAssociated()` (see
 * `form-radiogroup`, `form-listbox`).
 *
 * **Do not combine with `formAssociated()` on the same component** — both
 * declare the same `staticProps.formAssociated` key, so DEV_MODE throws
 * `ExtensionCollisionError`; in production, whichever extension is later in
 * the array silently wins `installOnPrototype` while the earlier one wins
 * `staticProps` (see ADR 0019's Consequences).
 *
 * @since 2.3
 */
declare const formAssociatedCheckbox: () => FormAssociatedCheckboxExtension;
/**
 * Relay a wrapped native `control`'s full `ValidityState` — every UA-computed
 * flag plus its own `customError` — onto a form-associated host's
 * `internals`, for "enhanced native input" components (e.g. a spinbutton
 * wrapping `<input type="number">`).
 *
 * A full replace, not a merge: the control's live `ValidityState` is the
 * complete, authoritative picture of its own constraints, including any
 * cross-field `customError` a parent previously layered on via
 * `host.setCustomValidity()`. The parent's cross-field check always runs
 * *after* the child's own validation on the same cycle, so it re-asserts
 * its `customError` on top of this the next time it runs — see ADR-0020.
 *
 * Not reactive — the control's `validationMessage` has no signal
 * counterpart, so re-run this from `on(control, 'input'/'change', …)`. Not
 * gated behind `formAssociated()`: usable by any component with `internals`.
 *
 * @see ADR-0020
 * @since 2.3.4
 * @param internals - The host's `ElementInternals`
 * @param control - The native control whose `ValidityState` to relay
 * @param anchor - Focus target on blocked submission or `reportValidity()`; defaults to `control`
 */
declare const relayValidity: (internals: ElementInternals | null, control: ValidatableControl, anchor?: HTMLElement) => void;
export { FALLBACK_VALIDITY_MESSAGE, type FormAssociatedCheckboxExtension, type FormAssociatedExtension, formAssociated, formAssociatedCheckbox, relayValidity, type ValidatableControl, };
