import {
	createEffect,
	createSlot,
	createState,
	DEEP_EQUALITY,
	isFunction,
	isSignal,
	isSlot,
	isState,
	type MaybeCleanup,
	type State,
} from '@zeix/cause-effect'
import type { ComponentExtension } from '../extension'
import { getSignals, internalsMap, retainedInitializers } from '../internal'
import type { FactoryResult } from '../types'
import { isParser } from '../types'
import { elementName } from '../util'

/* === Constants === */

/**
 * Genuinely empty NodeList for the `labels` fallback when `internals` is null.
 * `new NodeList()` throws `TypeError: Illegal constructor` — NodeList has no
 * public constructor. A DocumentFragment's `childNodes` is a live, permanently
 * empty NodeList, the idiomatic browser-side way to obtain an empty one.
 */
const EMPTY_NODELIST: NodeList =
	typeof document !== 'undefined'
		? document.createDocumentFragment().childNodes
		: ([] as unknown as NodeList)

/** Fallback ValidityState for when internals is null (attachInternals failed). */
const EMPTY_VALIDITY_STATE: ValidityState = {
	valueMissing: false,
	typeMismatch: false,
	patternMismatch: false,
	tooLong: false,
	tooShort: false,
	rangeUnderflow: false,
	rangeOverflow: false,
	stepMismatch: false,
	badInput: false,
	customError: false,
	valid: true,
} as ValidityState

/**
 * Snapshot a native `ValidityState` into a plain object. `ValidityState`'s
 * fields (`valid`, `valueMissing`, `typeMismatch`, …) are accessor properties
 * on the prototype, not own enumerable properties — `{ ...validity }` silently
 * copies nothing and yields `{}`. Reads the field list off
 * {@link EMPTY_VALIDITY_STATE} so the two stay in sync by construction.
 */
const snapshotValidity = (validity: ValidityState): ValidityState => {
	const snapshot = {} as Record<keyof ValidityState, boolean>
	for (const key of Object.keys(
		EMPTY_VALIDITY_STATE,
	) as (keyof ValidityState)[])
		snapshot[key] = validity[key]
	return snapshot as ValidityState
}

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
const HOST_CONTRACT_DESCRIPTORS = {
	form: {
		get(this: HTMLElement) {
			return internalsMap.get(this)?.form ?? null
		},
		enumerable: true,
		configurable: true,
	},
	name: {
		get(this: HTMLElement) {
			return this.getAttribute('name') ?? ''
		},
		set(this: HTMLElement, v: string) {
			if (v == null) this.removeAttribute('name')
			else this.setAttribute('name', v)
		},
		enumerable: true,
		configurable: true,
	},
	labels: {
		get(this: HTMLElement) {
			return internalsMap.get(this)?.labels ?? EMPTY_NODELIST
		},
		enumerable: true,
		configurable: true,
	},
	validity: {
		get(this: HTMLElement) {
			const signal = getSignals(this)['validity']
			return isState(signal)
				? (signal.get() as ValidityState)
				: (internalsMap.get(this)?.validity ?? EMPTY_VALIDITY_STATE)
		},
		enumerable: true,
		configurable: true,
	},
	validationMessage: {
		get(this: HTMLElement) {
			const signal = getSignals(this)['validationMessage']
			return isState(signal)
				? (signal.get() as string)
				: (internalsMap.get(this)?.validationMessage ?? '')
		},
		enumerable: true,
		configurable: true,
	},
	willValidate: {
		get(this: HTMLElement) {
			return internalsMap.get(this)?.willValidate ?? false
		},
		enumerable: true,
		configurable: true,
	},
	checkValidity: {
		value(this: HTMLElement) {
			return internalsMap.get(this)?.checkValidity() ?? true
		},
		enumerable: true,
		configurable: true,
		writable: true,
	},
	reportValidity: {
		value(this: HTMLElement) {
			return internalsMap.get(this)?.reportValidity() ?? true
		},
		enumerable: true,
		configurable: true,
		writable: true,
	},
	setCustomValidity: {
		value(this: HTMLElement, message: string) {
			const internals = internalsMap.get(this)
			if (internals)
				managedSetCustomValidity(internals, this as HTMLElement, message)
		},
		enumerable: true,
		configurable: true,
		writable: true,
	},
} as const

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
const MANAGED_FORM_MEMBERS: ReadonlySet<string> = new Set([
	...Object.keys(HOST_CONTRACT_DESCRIPTORS),
	'disabled',
])

/** Selector for the managed validation-anchor heuristic. */
const FOCUSABLE_FORM_CONTROL_SELECTOR =
	'input, select, textarea, button, [tabindex]'

/* === Internal Helpers === */

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
const resolveAnchor = (host: HTMLElement): HTMLElement =>
	host.querySelector<HTMLElement>(FOCUSABLE_FORM_CONTROL_SELECTOR) ?? host

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
const managedSetCustomValidity = (
	internals: ElementInternals,
	host: HTMLElement,
	message: string,
): void => {
	internals.setValidity(
		{ customError: !!message },
		message || undefined,
		resolveAnchor(host),
	)
}

/* === Form Lifecycle Callbacks === */

/**
 * Build a managed `formResetCallback` for the given reactive prop: restore it
 * to its default by re-running the retained initializer — re-parse the prop's
 * same-named attribute for a Parser (native `defaultValue`/`defaultChecked`
 * semantics), or restore a static value. No-op if signals are not yet
 * initialized or no initializer was retained (e.g. the prop was pre-set on
 * the instance before upgrade).
 *
 * Shared by `formAssociated()` (`prop: 'value'`) and `formAssociatedCheckbox()`
 * (`prop: 'checked'`) — the reset mechanics are identical, only the target
 * prop differs.
 */
const makeResetCallback = (prop: string) =>
	function (this: HTMLElement) {
		const initializer = retainedInitializers.get(this)?.[prop]
		if (initializer === undefined) return
		if (isParser(initializer)) {
			const parse = initializer as (
				v: string | null | undefined,
			) => NonNullable<unknown>
			const result = parse(this.getAttribute(prop))
			if (result != null) (this as any)[prop] = result
		} else if (!isSignal(initializer) && !isFunction(initializer)) {
			;(this as any)[prop] = initializer
		}
	}

const formResetCallback = makeResetCallback('value')
const checkboxResetCallback = makeResetCallback('checked')

/**
 * Managed state restore: the browser always restores what `setFormValue`
 * submitted — a string — so non-string states (File/FormData, custom
 * two-argument setFormValue states) are not managed. The restored string must
 * land in the correct type: run it through the retained Parser if the component
 * uses one, coerce to number for number-valued components (e.g.
 * form-spinbutton), or assign as-is for string-valued components.
 */
const formStateRestoreCallback = function (
	this: HTMLElement & { value: unknown },
	state: unknown,
	_mode: string,
) {
	if (typeof state !== 'string') return
	const initializer = retainedInitializers.get(this)?.['value']
	if (isParser(initializer)) {
		const parse = initializer as (
			v: string | null | undefined,
		) => NonNullable<unknown>
		const result = parse(state)
		if (result != null) this.value = result
	} else if (typeof this.value === 'number') {
		const n = Number(state)
		if (!Number.isNaN(n)) this.value = n
	} else {
		this.value = state
	}
}

/**
 * Managed state restore for checkbox-shaped controls: `setFormValue` was
 * called with either a string (checked) or `null` (unchecked, submits
 * nothing) — restoring is just the inverse: a string state means it was
 * checked.
 */
const checkboxFormStateRestoreCallback = function (
	this: HTMLElement & { checked: boolean },
	state: unknown,
	_mode: string,
) {
	this.checked = typeof state === 'string'
}

/**
 * Managed: write the effective disabled state into the `disabled` signal.
 * Covers both own `disabled` attribute and ancestor `<fieldset disabled>`
 * (which never touches the element's attribute). Shape-agnostic — shared by
 * `formAssociated()` and `formAssociatedCheckbox()`.
 */
const formDisabledCallback = function (
	this: HTMLElement & { disabled: boolean },
	disabled: boolean,
) {
	const signals = getSignals(this)
	const slot = signals['disabled']
	if (isSlot(slot)) slot.set(disabled)
	else this.disabled = disabled
}

/* === Exported Functions === */

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
const installFormAssociatedMembers = (proto: HTMLElement): void => {
	Object.defineProperties(proto, HOST_CONTRACT_DESCRIPTORS)
	Object.defineProperties(proto, {
		formResetCallback: {
			value: formResetCallback,
			writable: true,
			configurable: true,
		},
		formStateRestoreCallback: {
			value: formStateRestoreCallback,
			writable: true,
			configurable: true,
		},
		formDisabledCallback: {
			value: formDisabledCallback,
			writable: true,
			configurable: true,
		},
	})
}

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
const installFormAssociatedCheckboxMembers = (proto: HTMLElement): void => {
	Object.defineProperties(proto, HOST_CONTRACT_DESCRIPTORS)
	Object.defineProperties(proto, {
		formResetCallback: {
			value: checkboxResetCallback,
			writable: true,
			configurable: true,
		},
		formStateRestoreCallback: {
			value: checkboxFormStateRestoreCallback,
			writable: true,
			configurable: true,
		},
		formDisabledCallback: {
			value: formDisabledCallback,
			writable: true,
			configurable: true,
		},
	})
}

/**
 * Build the managed form-control value-sync effect descriptor. Returns an
 * `EffectDescriptor` (a thunk) that activates after dependency resolution in
 * the same pipeline as author effects. Watches `value` and calls
 * `internals.setFormValue(String(value))`.
 */
const managedValueSyncDescriptor =
	(instance: HTMLElement, internals: ElementInternals): (() => MaybeCleanup) =>
	// Thunk — activated lazily inside the component scope, like author effect
	// descriptors. Reading `(instance as any).value` inside createEffect
	// registers the Slot-backed accessor as a dependency.
	() =>
		createEffect(() => {
			const v = (instance as any).value
			internals.setFormValue(typeof v === 'string' ? v : String(v ?? ''))
		})

/**
 * Build the managed value-sync effect descriptor for checkbox-shaped
 * components. Watches `checked` and calls `internals.setFormValue(checked ?
 * submitValue : null)` — native checkboxes submit nothing when unchecked,
 * unlike `formAssociated()`'s always-on `setFormValue`. `submitValue` is the
 * host's own `value` attribute (default `'on'`, matching native
 * `<input type="checkbox">`), read once at connect — not reactive, since
 * native checkbox `.value` is a static identifier, not the commit signal.
 */
const checkedValueSyncDescriptor =
	(
		instance: HTMLElement,
		internals: ElementInternals,
		submitValue: string,
	): (() => MaybeCleanup) =>
	() =>
		createEffect(() => {
			const checked = (instance as any).checked
			internals.setFormValue(checked ? submitValue : null)
		})

/**
 * Create the managed `disabled` reactive property on a form-associated host.
 * Slot-backed so `formDisabledCallback` can write the effective disabled
 * state (including `<fieldset disabled>` inheritance). The getter and setter
 * go through the Slot, not the raw backing signal, so `host.disabled`,
 * `watch('disabled')`, and `formDisabledCallback` stay consistent even after
 * `pass()` replaces the Slot's delegate. The setter also reflects to the
 * `disabled` content attribute, so FACE gives native `:disabled` for free.
 */
const createManagedDisabledProperty = (instance: HTMLElement): void => {
	const initial = instance.hasAttribute('disabled')
	const slot = createSlot(createState(initial))
	const signals = getSignals(instance)
	signals['disabled'] = slot
	Object.defineProperty(instance, 'disabled', {
		get: () => slot.get(),
		set: (v: boolean) => {
			slot.set(v)
			if (v) instance.setAttribute('disabled', '')
			else instance.removeAttribute('disabled')
		},
		enumerable: true,
		configurable: true,
	})
}

/**
 * Register the managed `validationMessage` and `validity` reactive signals on
 * a form-associated host, so `watch('validationMessage', …)` / `watch('validity',
 * …)` resolve to real signals instead of `toSignal()`'s non-reactive one-shot
 * `createMemo` fallback (the root cause of the reported one-way propagation:
 * `setCustomValidity()` called from outside the component updated
 * `ElementInternals` but had no reactive counterpart for the component's own
 * setup code to observe — `validity` has the identical gap, driven by the
 * same underlying call).
 *
 * Wraps `internals.setValidity` itself — not just `managedSetCustomValidity`
 * — so both signals stay in sync regardless of *how* validity changes:
 * `host.setCustomValidity()` from outside the component, or a component's own
 * `watch('value', v => internals?.setValidity({ rangeOverflow: … }, msg))`
 * for typed native constraints (a documented, supported pattern — see
 * `FactoryContext.internals` in `component.ts`). Both call the same
 * `internals.setValidity`, so wrapping it once here is the single place that
 * covers every path, instead of re-deriving "was this called through our
 * wrapper" per call site.
 *
 * `validity` uses `DEEP_EQUALITY` — `internals.validity` snapshots are always
 * a new object reference, so without it every `setValidity` call would
 * propagate even when clearing-and-reasserting the same flags produces a
 * structurally identical `ValidityState`.
 *
 * Neither signal is Slot-backed like `disabled` — both are read-only to
 * consumers (native parity: there is no `host.validationMessage = …` or
 * `host.validity = …`), so a plain `State` is enough. The prototype getters
 * in {@link HOST_CONTRACT_DESCRIPTORS} read these signals directly.
 *
 * `onConnect` only runs once per instance lifetime (guarded by `#initialized`
 * in `component.ts`), so this wraps `setValidity` exactly once — no risk of
 * stacking wrappers across reconnects.
 *
 * @since 2.3.3
 */
const createManagedValidityProperties = (
	instance: HTMLElement,
	internals: ElementInternals,
): State<string> => {
	const messageState = createState(internals.validationMessage)
	const validityState = createState(snapshotValidity(internals.validity), {
		equals: DEEP_EQUALITY,
	})
	const signals = getSignals(instance)
	signals['validationMessage'] = messageState
	signals['validity'] = validityState
	const setValidity = internals.setValidity.bind(internals)
	internals.setValidity = ((
		flags?: ValidityStateFlags,
		message?: string,
		anchor?: HTMLElement,
	) => {
		setValidity(flags, message, anchor)
		messageState.set(internals.validationMessage)
		validityState.set(snapshotValidity(internals.validity))
	}) as ElementInternals['setValidity']
	return messageState
}

/** Brand distinguishing the form-associated extension at the type level. */
type FormAssociatedTag = { readonly __kind: 'form-associated' }

/** The `ComponentExtension` returned by {@link formAssociated}. */
type FormAssociatedExtension = ComponentExtension & FormAssociatedTag

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
const formAssociated = (): FormAssociatedExtension => ({
	name: 'formAssociated',
	__kind: 'form-associated',
	staticProps: { formAssociated: true },
	reservedMembers: MANAGED_FORM_MEMBERS,
	installOnPrototype: installFormAssociatedMembers,
	onConnect: (instance, internals): FactoryResult | void => {
		if (!internals) return
		const hasValueSignal = 'value' in instance && getSignals(instance).value
		if (process.env.DEV_MODE === 'true' && !hasValueSignal)
			console.warn(
				`form-associated component ${elementName(instance)} did not expose a reactive 'value' property. The managed form-control convention requires a reactive 'value' for form value sync, reset, and state restore.`,
			)
		createManagedDisabledProperty(instance)
		createManagedValidityProperties(instance, internals)
		return [managedValueSyncDescriptor(instance, internals)]
	},
})

/** Brand distinguishing the checkbox-shaped form-associated extension. */
type FormAssociatedCheckboxTag = {
	readonly __kind: 'form-associated-checkbox'
}

/** The `ComponentExtension` returned by {@link formAssociatedCheckbox}. */
type FormAssociatedCheckboxExtension = ComponentExtension &
	FormAssociatedCheckboxTag

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
const formAssociatedCheckbox = (): FormAssociatedCheckboxExtension => ({
	name: 'formAssociatedCheckbox',
	__kind: 'form-associated-checkbox',
	staticProps: { formAssociated: true },
	reservedMembers: MANAGED_FORM_MEMBERS,
	installOnPrototype: installFormAssociatedCheckboxMembers,
	onConnect: (instance, internals): FactoryResult | void => {
		if (!internals) return
		const hasCheckedSignal =
			'checked' in instance && getSignals(instance).checked
		if (process.env.DEV_MODE === 'true' && !hasCheckedSignal)
			console.warn(
				`form-associated-checkbox component ${elementName(instance)} did not expose a reactive 'checked' property. The managed checkbox convention requires a reactive 'checked' for form value sync, reset, and state restore.`,
			)
		const submitValue = instance.getAttribute('value') ?? 'on'
		createManagedDisabledProperty(instance)
		createManagedValidityProperties(instance, internals)
		return [checkedValueSyncDescriptor(instance, internals, submitValue)]
	},
})

export {
	EMPTY_NODELIST,
	EMPTY_VALIDITY_STATE,
	FOCUSABLE_FORM_CONTROL_SELECTOR,
	type FormAssociatedCheckboxExtension,
	type FormAssociatedCheckboxTag,
	type FormAssociatedExtension,
	type FormAssociatedTag,
	formAssociated,
	formAssociatedCheckbox,
	HOST_CONTRACT_DESCRIPTORS,
	installFormAssociatedCheckboxMembers,
	installFormAssociatedMembers,
	MANAGED_FORM_MEMBERS,
	managedSetCustomValidity,
	resolveAnchor,
}
