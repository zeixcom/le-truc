import type { ComponentExtension } from '../extension';
/** The `ComponentExtension` returned by {@link formAssociated}. */
type FormAssociatedExtension = ComponentExtension & {
    readonly __kind: 'form-associated';
};
/** The `ComponentExtension` returned by {@link formAssociatedCheckbox}. */
type FormAssociatedCheckboxExtension = ComponentExtension & {
    readonly __kind: 'form-associated-checkbox';
};
/** Element shape required by {@link relayValidity}: exposes the native Constraint Validation trio. */
type ValidatableControl = HTMLElement & {
    readonly validity: ValidityState;
    readonly validationMessage: string;
    checkValidity(): boolean;
};
/**
 * Fallback message when a flag is `true` but no real message is available.
 * Covers native controls barred from constraint validation (`disabled`,
 * `readonly`), which report an empty `validationMessage` despite live `.validity` flags.
 */
declare const FALLBACK_VALIDITY_MESSAGE = "Invalid value";
/**
 * Extension enabling the managed form-control convention: native-parity host contract
 * (`form`, `name`, `labels`, `validity`, ...), managed `disabled`, value sync, reset, and state restore.
 * Pass to `defineComponent`'s third parameter. See ADR 0016.
 *
 * @since 2.3
 */
declare const formAssociated: () => FormAssociatedExtension;
/**
 * Extension enabling the managed checkbox-shaped form-control convention: same host contract as
 * {@link formAssociated}, keyed on a reactive `checked: boolean` prop, and value sync submits nothing when unchecked.
 * Covers checkbox-shaped controls (switches, toggles), not radio groups or multi-select lists — those fit
 * `formAssociated()` instead.
 *
 * Do not combine with `formAssociated()` on the same component; see ADR 0019.
 *
 * @since 2.3
 */
declare const formAssociatedCheckbox: () => FormAssociatedCheckboxExtension;
/**
 * Relays a wrapped native `control`'s full `ValidityState` onto a form-associated host's `internals`.
 * Replaces the host's validity state entirely rather than merging; see ADR-0020 for cross-field interaction.
 * Not reactive: re-run from an `on(control, 'input'/'change', …)` handler. Usable by any component with `internals`.
 *
 * @see ADR-0020
 * @since 2.3.4
 * @param internals - The host's `ElementInternals`.
 * @param control - The native control whose `ValidityState` to relay.
 * @param anchor - Focus target on blocked submission or `reportValidity()`. Defaults to `control`.
 */
declare const relayValidity: (internals: ElementInternals | null, control: ValidatableControl, anchor?: HTMLElement) => void;
export { FALLBACK_VALIDITY_MESSAGE, type FormAssociatedCheckboxExtension, type FormAssociatedExtension, formAssociated, formAssociatedCheckbox, relayValidity, type ValidatableControl, };
