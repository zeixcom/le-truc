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

/**
 * Shared shape of everything `formAssociated()` and `formAssociatedCheckbox()`
 * do identically — host contract, managed `disabled`, managed validity
 * signals — parameterized over the one thing that varies: which reactive
 * prop drives value sync/reset/state-restore, and how the sync effect reads
 * it.
 */
type FormAssociatedVariantConfig<Tag extends string> = {
	__kind: Tag
	name: string
	propName: 'value' | 'checked'
	/** The reset-baseline property's name: `defaultValue`/`defaultChecked`. */
	defaultPropName: 'defaultValue' | 'defaultChecked'
	installOnPrototype: (proto: HTMLElement) => void
	makeSyncDescriptor: (
		instance: HTMLElement,
		internals: ElementInternals,
	) => () => MaybeCleanup
}

/**
 * Structural shape required by {@link relayValidity}: any element exposing
 * the native Constraint Validation trio. `HTMLInputElement`,
 * `HTMLSelectElement`, `HTMLTextAreaElement`, `HTMLButtonElement`, and others
 * all satisfy this without a cast.
 */
type ValidatableControl = HTMLElement & {
	readonly validity: ValidityState
	readonly validationMessage: string
	checkValidity(): boolean
}

/* === Constants === */

/**
 * Genuinely empty NodeList for the `labels` fallback when `internals` is null.
 * `new NodeList()` throws `TypeError: Illegal constructor` — NodeList has no
 * public constructor. A DocumentFragment's `childNodes` is a live, permanently
 * empty NodeList, the idiomatic browser-side way to obtain an empty one.
 * Computed lazily and cached on first access rather than at module-evaluation
 * time, and guards the method itself, not just `document`'s existence: some
 * non-browser or test-stub `document` globals are partial and don't implement
 * `createDocumentFragment`.
 */
let emptyNodeList: NodeList | undefined
const getEmptyNodeList = (): NodeList =>
	(emptyNodeList ??=
		typeof document !== 'undefined' &&
		typeof document.createDocumentFragment === 'function'
			? document.createDocumentFragment().childNodes
			: ([] as unknown as NodeList))

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
}

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
	return snapshot
}

/**
 * The settable `ValidityStateFlags` keys — every {@link EMPTY_VALIDITY_STATE}
 * key except `valid`, which is computed by the platform, not a flag a caller
 * can set via `internals.setValidity()`.
 */
const VALIDITY_FLAG_KEYS = (
	Object.keys(EMPTY_VALIDITY_STATE) as (keyof ValidityState)[]
).filter(key => key !== 'valid') as (keyof ValidityStateFlags)[]

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

/**
 * Fallback message when a flag is `true` but no real message is available.
 * Native controls barred from constraint validation (`disabled`, or
 * `readonly` on `type="number"`/`text`/etc.) always report an empty
 * `validationMessage` even though their `.validity` flags stay live —
 * {@link relayValidity} relaying such a control hits this on the *first*
 * flag transition, before any prior message exists to fall back to.
 */
const FALLBACK_VALIDITY_MESSAGE = 'Invalid value'

/**
 * The reset-baseline property descriptor for a variant: `defaultValue`/`defaultChecked`, mirroring the native
 * `<input>.defaultValue`/`.defaultChecked` pair. When the prop is
 * Parser-backed (the attribute-driven convention, ADR 0003), this reflects
 * the LIVE same-named content attribute through the retained Parser, so it
 * matches the live prop's own type and can be moved from outside via
 * `setAttribute`/`this[defaultProp] =`. When it isn't Parser-backed (a
 * static initializer, `expose({ value: 'default' })`), there is no
 * attribute contract to reflect — the getter returns the retained
 * initializer as-is, unchanged from how `formResetCallback` always restored
 * it. Writing this never marks the control dirty and is never itself the
 * live prop — it only moves the baseline a future `formResetCallback`
 * restores `value`/`checked` to (`this[prop] = this[defaultProp]`, the same
 * relationship `<input>` has between its own two properties).
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
 * Install the native-parity host contract ({@link HOST_CONTRACT_DESCRIPTORS}),
 * the reset-baseline property ({@link makeDefaultPropDescriptor}), plus the
 * three managed lifecycle callbacks on a prototype, given the variant-specific
 * reset/state-restore pair. `formDisabledCallback` is shape-agnostic, so it's
 * shared unconditionally.
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
 * Register reactive `disabled`/`validationMessage`/`validity` signals on a
 * form-associated host.
 *
 * Managed `disabled` is a reactive property on a form-associated host.
 * Slot-backed so `formDisabledCallback` can write the effective disabled
 * state (including `<fieldset disabled>` inheritance). The getter and setter
 * go through the Slot, not the raw backing signal, so `host.disabled`,
 * `watch('disabled')`, and `formDisabledCallback` stay consistent even after
 * `pass()` replaces the Slot's delegate. The setter also reflects to the
 * `disabled` content attribute, so FACE gives native `:disabled` for free.
 *
 * `watch('validationMessage', …)` / `watch('validity',…)` see every change.
 * Wraps `internals.setValidity` itself, so both the managed `setCustomValidity`
 * path and a component's own typed-flags `internals.setValidity(...)` calls stay
 * in sync. `validity` uses `DEEP_EQUALITY` since `internals.validity` snapshots
 * are always a new object reference. Both signals are read-only `State` (no Slot),
 * {@link HOST_CONTRACT_DESCRIPTORS} reads them directly.
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
 * Build a managed form-control extension from a {@link
 * FormAssociatedVariantConfig}. `formAssociated()` and
 * `formAssociatedCheckbox()` are both thin config calls into this — see ADR
 * 0019 for why they stay two public functions rather than one parameterized
 * one (their `defineComponent` overloads need distinct types to widen the
 * factory context correctly).
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
 * Build a managed `formResetCallback` for the given reactive prop: restore it
 * to its baseline by assigning from the paired {@link makeDefaultPropDescriptor}
 * property (`this[prop] = this[defaultProp]`) — the same relationship
 * `<input>.value`/`.defaultValue` have natively. No-op if no
 * initializer was retained (e.g. the prop was pre-set on the instance before
 * upgrade) or signals are not yet initialized. Also a no-op for a `Signal`,
 * `MemoCallback`/`TaskCallback`, or `SlotDescriptor` (`{ get, set? }`)
 * initializer — none of these carry a "default value" to restore; the prop
 * already derives live from whatever backs it.
 *
 * The restoring write is deferred to a microtask: form
 * reset runs in TREE ORDER, and a form-associated host precedes its own inner
 * native control in the light DOM — `formResetCallback` fires on the host
 * FIRST, then the browser resets the descendant control to its own
 * `defaultValue`/`defaultChecked` a moment later, in the same synchronous
 * walk. Writing `this[prop]` synchronously here raced that native reset and
 * lost — the reactive effect it triggers (`bindProperty`/`bindState` writing
 * the new value into the control) ran before the control's own native reset
 * fired, which then silently overwrote it. Deferring past the synchronous
 * reset walk means the write lands after the control's own reset has already
 * happened; the two converge on the same baseline now that `defaultValue`'s
 * content attribute is never touched by live edits, so this is not
 * a race anymore, just a same-tick reconciliation. The host's OWN internal
 * "dirty" flag isn't cleared by this write — only the form reset algorithm
 * clears it, which it does regardless, since the inner control is owned by
 * the same form.
 *
 * Shared by `formAssociated()` (`prop: 'value'`, `defaultProp: 'defaultValue'`)
 * and `formAssociatedCheckbox()` (`prop: 'checked'`, `defaultProp:
 * 'defaultChecked'`) — the reset mechanics are identical, only the target
 * prop pair differs.
 */
const makeResetCallback = (
	prop: 'value' | 'checked',
	defaultProp: 'defaultValue' | 'defaultChecked',
) =>
	function (this: HTMLElement) {
		const initializer = retainedInitializers.get(this)?.[prop]
		if (initializer === undefined) return
		// A Parser is itself a function — this exclusion must not catch it
		// (checked first) before falling through to the MemoCallback/
		// TaskCallback/SlotDescriptor "no default to restore" cases.
		if (
			!isParser(initializer) &&
			(isSignal(initializer) ||
				isFunction(initializer) ||
				isSlotDescriptor(initializer))
		)
			return
		queueMicrotask(() => {
			const result = (this as any)[defaultProp]
			if (result != null) (this as any)[prop] = result
		})
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

/**
 * Managed state restore for checkbox-shaped controls: `setFormValue` was
 * called with either a string (checked) or `null` (unchecked, submits
 * nothing) — restoring is just the inverse: a string state means it was
 * checked.
 */
const checkboxFormStateRestoreCallback = function (
	this: HTMLElement & { checked: boolean },
	state: unknown,
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
