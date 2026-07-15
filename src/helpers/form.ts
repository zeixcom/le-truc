import { isFunction, isSignal, isSlot, type Signal } from '@zeix/cause-effect'
import { getSignals, initialValueInitializers, internalsMap } from '../internal'
import { isParser } from '../types'

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
 * Member-spec table: the single source of truth for the native-parity host
 * contract installed on form-associated components. Each entry maps a member
 * name to its property descriptor. Driving both the reserved set and the
 * prototype install from one table makes "reserved but not installed"
 * impossible — the exact bug that caused `name` to go missing.
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
			return internalsMap.get(this)?.validity ?? EMPTY_VALIDITY_STATE
		},
		enumerable: true,
		configurable: true,
	},
	validationMessage: {
		get(this: HTMLElement) {
			return internalsMap.get(this)?.validationMessage ?? ''
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

/* === Types === */

/** The `this` type for form lifecycle callbacks — has the managed `value`. */
type FormAssociatedHost = HTMLElement & {
	value: unknown
	disabled: boolean
}

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
 * Managed reset: restore `value` to its default by re-running the retained
 * initializer — re-parse the current `value` attribute for a Parser (native
 * defaultValue semantics), or restore a static value. No-op if signals are not
 * yet initialized or no value initializer was retained (e.g. value was
 * pre-set on the instance before upgrade).
 */
const formResetCallback = function (this: FormAssociatedHost) {
	const initializer = initialValueInitializers.get(this)
	if (initializer === undefined) return
	if (isParser(initializer)) {
		const parse = initializer as (
			v: string | null | undefined,
		) => NonNullable<unknown>
		const result = parse(this.getAttribute('value'))
		if (result != null) this.value = result
	} else if (!isSignal(initializer) && !isFunction(initializer)) {
		this.value = initializer
	}
}

/**
 * Managed state restore: the browser always restores what `setFormValue`
 * submitted — a string — so non-string states (File/FormData, custom
 * two-argument setFormValue states) are not managed. The restored string must
 * land in the correct type: run it through the retained Parser if the component
 * uses one, coerce to number for number-valued components (e.g.
 * form-spinbutton), or assign as-is for string-valued components.
 */
const formStateRestoreCallback = function (
	this: FormAssociatedHost,
	state: unknown,
	_mode: string,
) {
	if (typeof state !== 'string') return
	const initializer = initialValueInitializers.get(this)
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
 * Managed: write the effective disabled state into the `disabled` signal.
 * Covers both own `disabled` attribute and ancestor `<fieldset disabled>`
 * (which never touches the element's attribute).
 */
const formDisabledCallback = function (
	this: FormAssociatedHost,
	disabled: boolean,
) {
	const signals = getSignals(this as HTMLElement)
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

export {
	EMPTY_NODELIST,
	EMPTY_VALIDITY_STATE,
	FOCUSABLE_FORM_CONTROL_SELECTOR,
	HOST_CONTRACT_DESCRIPTORS,
	installFormAssociatedMembers,
	MANAGED_FORM_MEMBERS,
	managedSetCustomValidity,
	resolveAnchor,
}
