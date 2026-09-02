import {
	createCell,
	createEffect,
	createSlot,
	DEEP_EQUALITY,
	isFunction,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type MutableCell,
} from '@zeix/cause-effect'
import type { ComponentExtension } from '../extension'
import { getSignals, internalsMap, retainedInitializers } from '../internal'
import type { FactoryResult } from '../types'
import { isParser } from '../types'
import { elementName, isSlotDescriptor } from '../util'

/* === Types === */

/** The `ComponentExtension` returned by {@link formAssociated}. */
type FormAssociatedExtension = ComponentExtension & {
	readonly __kind: 'form-associated'
}

/** The `ComponentExtension` returned by {@link formAssociatedCheckbox}. */
type FormAssociatedCheckboxExtension = ComponentExtension & {
	readonly __kind: 'form-associated-checkbox'
}

/** Config shared by `formAssociated()` and `formAssociatedCheckbox()`, parameterized on the driving prop. */
type FormAssociatedVariantConfig<Tag extends string> = {
	__kind: Tag
	name: string
	propName: 'value' | 'checked'
	/** The reset-baseline property name: `defaultValue` or `defaultChecked`. */
	defaultPropName: 'defaultValue' | 'defaultChecked'
	installOnPrototype: (proto: HTMLElement) => void
	makeSyncDescriptor: (
		instance: HTMLElement,
		internals: ElementInternals,
	) => () => MaybeCleanup
}

/** Element shape required by {@link relayValidity}: exposes the native Constraint Validation trio. */
type ValidatableControl = HTMLElement & {
	readonly validity: ValidityState
	readonly validationMessage: string
	checkValidity(): boolean
}

/* === Constants === */

/**
 * Empty NodeList for the `labels` fallback when `internals` is null.
 * `NodeList` has no public constructor, so this uses a detached
 * `DocumentFragment`'s `childNodes` instead. Cached lazily; some
 * non-browser `document` stubs lack `createDocumentFragment`.
 */
let emptyNodeList: NodeList | undefined
const getEmptyNodeList = (): NodeList =>
	(emptyNodeList ??=
		typeof document !== 'undefined' &&
		typeof document.createDocumentFragment === 'function'
			? document.createDocumentFragment().childNodes
			: ([] as unknown as NodeList))

/** Fallback ValidityState for when `internals` is null (`attachInternals` failed). */
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
}

/**
 * Copy a native `ValidityState` into a plain object.
 * `ValidityState` fields are prototype accessors, so a spread copies nothing;
 * this reads each key explicitly instead.
 */
const snapshotValidity = (validity: ValidityState): ValidityState => {
	const snapshot = {} as Record<keyof ValidityState, boolean>
	for (const key of Object.keys(
		EMPTY_VALIDITY_STATE,
	) as (keyof ValidityState)[])
		snapshot[key] = validity[key]
	return snapshot
}

/** The settable `ValidityStateFlags` keys — every validity key except `valid`, which the platform computes. */
const VALIDITY_FLAG_KEYS = (
	Object.keys(EMPTY_VALIDITY_STATE) as (keyof ValidityState)[]
).filter(key => key !== 'valid') as (keyof ValidityStateFlags)[]

/**
 * Property descriptors for the native-parity host contract on form-associated components.
 * Drives both the reserved-member set and the prototype install from one table.
 * `disabled` is managed separately, per instance. `value` is exposed by the component itself.
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
			return internalsMap.get(this)?.labels ?? getEmptyNodeList()
		},
		enumerable: true,
		configurable: true,
	},
	validity: {
		get(this: HTMLElement) {
			const signal = getSignals(this)['validity']
			return isSignal<ValidityState>(signal)
				? signal.get()
				: (internalsMap.get(this)?.validity ?? EMPTY_VALIDITY_STATE)
		},
		enumerable: true,
		configurable: true,
	},
	validationMessage: {
		get(this: HTMLElement) {
			const signal = getSignals(this)['validationMessage']
			return isSignal<string>(signal)
				? signal.get()
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
		value(this: HTMLElement, ownMessage: string) {
			const internals = internalsMap.get(this)
			if (internals) {
				const current = snapshotValidity(internals.validity)
				const flags = {
					customError: !!ownMessage,
				} as Partial<ValidityStateFlags>
				const merged = {} as ValidityStateFlags
				for (const key of VALIDITY_FLAG_KEYS)
					merged[key] = flags[key] ?? current[key]
				const anyTrue = VALIDITY_FLAG_KEYS.some(key => merged[key])
				const message =
					ownMessage ||
					(anyTrue
						? internals.validationMessage || FALLBACK_VALIDITY_MESSAGE
						: undefined)
				internals.setValidity(
					merged,
					message || undefined,
					this.querySelector<HTMLElement>(FOCUSABLE_FORM_CONTROL_SELECTOR) ??
						this,
				)
			}
		},
		enumerable: true,
		configurable: true,
		writable: true,
	},
} as const

/**
 * Managed member names reserved on form-associated components.
 * `expose()` throws `InvalidPropertyNameError` for any of these names. `value` is exempt: the component must expose it.
 */
const MANAGED_FORM_MEMBERS: ReadonlySet<string> = new Set([
	...Object.keys(HOST_CONTRACT_DESCRIPTORS),
	'disabled',
])

/** Selector for the managed validation-anchor heuristic. */
const FOCUSABLE_FORM_CONTROL_SELECTOR =
	'input, select, textarea, button, [tabindex]'

/**
 * Fallback message when a flag is `true` but no real message is available.
 * Covers native controls barred from constraint validation (`disabled`,
 * `readonly`), which report an empty `validationMessage` despite live `.validity` flags.
 */
const FALLBACK_VALIDITY_MESSAGE = 'Invalid value'

/**
 * Build the reset-baseline property descriptor (`defaultValue`/`defaultChecked`), mirroring native `<input>` semantics.
 * For a Parser-backed prop (see ADR 0003), it reflects the live attribute through the Parser.
 * Otherwise it returns the retained static initializer as-is.
 * Writing it only moves the baseline that `formResetCallback` restores `value`/`checked` to; it never marks the control dirty.
 */
const makeDefaultPropDescriptor = (
	prop: 'value' | 'checked',
): PropertyDescriptor => ({
	get(this: HTMLElement) {
		const initializer = retainedInitializers.get(this)?.[prop]
		if (isParser(initializer)) return initializer(this.getAttribute(prop))
		if (initializer !== undefined) return initializer
		return prop === 'checked'
			? this.hasAttribute('checked')
			: (this.getAttribute(prop) ?? '')
	},
	set(this: HTMLElement, v: unknown) {
		if (prop === 'checked') {
			if (v) this.setAttribute('checked', '')
			else this.removeAttribute('checked')
		} else if (v == null) this.removeAttribute(prop)
		else this.setAttribute(prop, String(v))
	},
	enumerable: true,
	configurable: true,
})

/* === Internal Helpers === */

/**
 * Install the host contract, reset-baseline property, and the three managed lifecycle callbacks on a prototype.
 *
 * @since 2.3
 * @internal
 */
const installManagedFormMembers = (
	proto: HTMLElement,
	propName: 'value' | 'checked',
	defaultPropName: 'defaultValue' | 'defaultChecked',
	resetCallback: (this: any) => void,
	stateRestoreCallback: (this: any, state: unknown, mode: string) => void,
): void => {
	Object.defineProperties(proto, {
		...HOST_CONTRACT_DESCRIPTORS,
		[defaultPropName]: makeDefaultPropDescriptor(propName),
		formResetCallback: {
			value: resetCallback,
			writable: true,
			configurable: true,
		},
		formStateRestoreCallback: {
			value: stateRestoreCallback,
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
 * Register reactive `disabled`, `validationMessage`, and `validity` signals on a form-associated host.
 * `disabled` is Slot-backed so `formDisabledCallback` and `pass()` stay consistent, and reflects to the
 * `disabled` content attribute for native `:disabled` support.
 * Wraps `internals.setValidity` so both the managed and a component's own calls keep the signals in sync.
 * `validity` uses `DEEP_EQUALITY` because each `internals.validity` snapshot is a new object.
 *
 * @since 2.3.3
 */
const createManagedProperties = (
	instance: HTMLElement,
	internals: ElementInternals,
): MutableCell<string> => {
	const disabledSlot = createSlot(createCell(instance.hasAttribute('disabled')))
	const messageState = createCell(internals.validationMessage)
	const validityState = createCell(snapshotValidity(internals.validity), {
		equals: DEEP_EQUALITY,
	})
	const signals = getSignals(instance)

	signals['disabled'] = disabledSlot
	Object.defineProperty(instance, 'disabled', {
		get: () => disabledSlot.get(),
		set: (v: boolean) => {
			disabledSlot.set(v)
			if (v) instance.setAttribute('disabled', '')
			else instance.removeAttribute('disabled')
		},
		enumerable: true,
		configurable: true,
	})

	signals['validationMessage'] = messageState
	signals['validity'] = validityState
	const setValidity = internals.setValidity.bind(internals)
	internals.setValidity = (
		flags?: ValidityStateFlags,
		message?: string,
		anchor?: HTMLElement,
	) => {
		setValidity(flags, message, anchor)
		messageState.set(internals.validationMessage)
		validityState.set(snapshotValidity(internals.validity))
	}
	return messageState
}

/**
 * Build a managed form-control extension from a {@link FormAssociatedVariantConfig}.
 * `formAssociated()` and `formAssociatedCheckbox()` both call into this; see ADR 0019 for why they stay separate public functions.
 */
const makeFormAssociatedExtension = <Tag extends string>(
	config: FormAssociatedVariantConfig<Tag>,
): ComponentExtension & { readonly __kind: Tag } => ({
	name: config.name,
	__kind: config.__kind,
	staticProps: { formAssociated: true },
	reservedMembers: new Set([...MANAGED_FORM_MEMBERS, config.defaultPropName]),
	installOnPrototype: config.installOnPrototype,
	onConnect: (instance, internals): FactoryResult | void => {
		if (!internals) return
		const { propName } = config
		const hasSignal = propName in instance && getSignals(instance)[propName]
		if (process.env.DEV_MODE === 'true' && !hasSignal)
			console.warn(
				`${config.__kind} component ${elementName(instance)} did not expose a reactive '${propName}' property. The managed ${config.__kind === 'form-associated-checkbox' ? 'checkbox' : 'form-control'} convention requires a reactive '${propName}' for form value sync, reset, and state restore.`,
			)
		createManagedProperties(instance, internals)
		return [config.makeSyncDescriptor(instance, internals)]
	},
})

/* === Form Lifecycle Callbacks === */

/**
 * Build a managed `formResetCallback` for the given reactive prop.
 * Restores the prop from its paired default property (`this[prop] = this[defaultProp]`).
 * No-op if no initializer was retained, or if the initializer is a `Signal`, `MemoCallback`/`TaskCallback`,
 * or `SlotDescriptor` — none of these carry a default value to restore.
 * Shared by `formAssociated()` and `formAssociatedCheckbox()`; only the target prop pair differs.
 */
const makeResetCallback = (
	prop: 'value' | 'checked',
	defaultProp: 'defaultValue' | 'defaultChecked',
) =>
	function (this: HTMLElement) {
		const initializer = retainedInitializers.get(this)?.[prop]
		if (initializer === undefined) return
		// A Parser is itself a function — check it first so this exclusion
		// doesn't catch it before the "no default to restore" cases below.
		if (
			!isParser(initializer) &&
			(isSignal(initializer) ||
				isFunction(initializer) ||
				isSlotDescriptor(initializer))
		)
			return
		// Deferred to a microtask: form reset runs in tree order, so the host's
		// formResetCallback fires before the browser resets its own inner native
		// control. A synchronous write here would race that native reset and lose.
		queueMicrotask(() => {
			const result = (this as any)[defaultProp]
			if (result != null) (this as any)[prop] = result
		})
	}

/**
 * Managed state restore for `value`. Ignores non-string states; a string state is run through
 * the retained Parser if the component uses one, coerced to number for number-valued components, or assigned as-is.
 */
const formStateRestoreCallback = function (
	this: HTMLElement & { value: unknown },
	state: unknown,
) {
	if (typeof state !== 'string') return
	const initializer = retainedInitializers.get(this)?.['value']
	if (isParser(initializer)) {
		const result = initializer(state)
		if (result != null) this.value = result
	} else if (typeof this.value === 'number') {
		const n = Number(state)
		if (!Number.isNaN(n)) this.value = n
	} else {
		this.value = state
	}
}

/** Managed state restore for checkbox-shaped controls: a string state means it was checked. */
const checkboxFormStateRestoreCallback = function (
	this: HTMLElement & { checked: boolean },
	state: unknown,
) {
	this.checked = typeof state === 'string'
}

/** Writes the effective disabled state, including inherited `<fieldset disabled>`, into the `disabled` signal. */
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
 * Extension enabling the managed form-control convention: native-parity host contract
 * (`form`, `name`, `labels`, `validity`, ...), managed `disabled`, value sync, reset, and state restore.
 * Pass to `defineComponent`'s third parameter. See ADR 0016.
 *
 * @since 2.3
 */
const formAssociated = (): FormAssociatedExtension =>
	makeFormAssociatedExtension({
		__kind: 'form-associated',
		name: 'formAssociated',
		propName: 'value',
		defaultPropName: 'defaultValue',
		installOnPrototype: proto =>
			installManagedFormMembers(
				proto,
				'value',
				'defaultValue',
				makeResetCallback('value', 'defaultValue'),
				formStateRestoreCallback,
			),
		makeSyncDescriptor: (instance, internals) => () =>
			createEffect(() => {
				const v = (instance as any).value
				internals.setFormValue(typeof v === 'string' ? v : String(v ?? ''))
			}),
	})

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
const formAssociatedCheckbox = (): FormAssociatedCheckboxExtension =>
	makeFormAssociatedExtension({
		__kind: 'form-associated-checkbox',
		name: 'formAssociatedCheckbox',
		propName: 'checked',
		defaultPropName: 'defaultChecked',
		installOnPrototype: proto =>
			installManagedFormMembers(
				proto,
				'checked',
				'defaultChecked',
				makeResetCallback('checked', 'defaultChecked'),
				checkboxFormStateRestoreCallback,
			),
		makeSyncDescriptor: (instance, internals) => () =>
			createEffect(() => {
				const checked = (instance as any).checked
				internals.setFormValue(
					checked ? (instance.getAttribute('value') ?? 'on') : null,
				)
			}),
	})

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
const relayValidity = (
	internals: ElementInternals | null,
	control: ValidatableControl,
	anchor: HTMLElement = control,
): void => {
	if (!internals) return
	control.checkValidity()
	const flags = {} as ValidityStateFlags
	for (const key of VALIDITY_FLAG_KEYS) flags[key] = control.validity[key]
	const anyTrue = VALIDITY_FLAG_KEYS.some(key => flags[key])
	internals.setValidity(
		flags,
		control.validationMessage ||
			(anyTrue ? FALLBACK_VALIDITY_MESSAGE : undefined),
		anchor,
	)
}

export {
	FALLBACK_VALIDITY_MESSAGE,
	type FormAssociatedCheckboxExtension,
	type FormAssociatedExtension,
	formAssociated,
	formAssociatedCheckbox,
	relayValidity,
	type ValidatableControl,
}
