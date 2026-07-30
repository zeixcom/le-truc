/**
 * Unit tests for ElementInternals support (form association, custom states).
 *
 * Tests the **managed form-control convention**: a form-associated component
 * exposes a reactive `value` property, and the library owns form value sync
 * (value → setFormValue), formResetCallback (restore default), state restore,
 * formDisabledCallback (managed disabled signal), and the native-parity host
 * contract. The `internals` escape hatch is tested for typed validity flags
 * and custom :state() pseudo-classes.
 *
 * Uses the same FakeHTMLElement / fake customElements pattern as component.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { defineComponent } from '../component'
import { InvalidPropertyNameError } from '../errors'
import { formAssociated, formAssociatedCheckbox } from '../extensions/form'
import { asParser } from '../types'

/* === Fake customElements registry + HTMLElement base === */

class FakeHTMLElement {
	#attrs = new Map<string, string>()
	localName = 'fake-element'
	shadowRoot: null = null
	#internals: FakeElementInternals | null = null

	getAttribute(name: string): string | null {
		return this.#attrs.has(name) ? this.#attrs.get(name)! : null
	}
	setAttribute(name: string, value: string) {
		this.#attrs.set(name, value)
	}
	hasAttribute(name: string) {
		return this.#attrs.has(name)
	}
	removeAttribute(name: string) {
		this.#attrs.delete(name)
	}
	addEventListener() {}
	removeEventListener() {}
	dispatchEvent() {
		return true
	}
	attachInternals() {
		if (!this.#internals) this.#internals = new FakeElementInternals()
		return this.#internals
	}
	querySelector(): HTMLElement | null {
		return null
	}
}

/** Mutable ValidityState — the real DOM type has readonly fields. */
type MutableValidityState = {
	-readonly [K in keyof ValidityState]: boolean
}

class FakeElementInternals {
	formValue: string | File | FormData | null = null
	validity: MutableValidityState = {
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
	validationMessage = ''
	states = new Set<string>()
	willValidate = true
	form: HTMLFormElement | null = null
	labels: NodeList = [] as unknown as NodeList

	setFormValue(value: string | File | FormData | null) {
		this.formValue = value
	}
	setValidity(
		flags: ValidityStateFlags,
		message?: string,
		anchor?: HTMLElement,
	) {
		Object.assign(this.validity, flags)
		this.validity.valid =
			!this.validity.valueMissing &&
			!this.validity.typeMismatch &&
			!this.validity.patternMismatch &&
			!this.validity.tooLong &&
			!this.validity.tooShort &&
			!this.validity.rangeUnderflow &&
			!this.validity.rangeOverflow &&
			!this.validity.stepMismatch &&
			!this.validity.badInput &&
			!this.validity.customError
		this.validationMessage = message ?? ''
	}
	checkValidity() {
		return this.validity.valid
	}
	reportValidity() {
		return this.validity.valid
	}
}

/**
 * FakeHTMLElement that throws on attachInternals to simulate the
 * pre-upgrade / parser-ordering edge case.
 */
class FakeHTMLElementNoInternals extends FakeHTMLElement {
	attachInternals(): FakeElementInternals {
		throw new DOMException(
			'NotSupportedError',
			'ElementInternals is not supported',
		)
	}
}

const registry = new Map<string, CustomElementConstructor>()

const installFakeCustomElements = (base?: typeof FakeHTMLElement) => {
	const Base = base ?? FakeHTMLElement
	;(globalThis as any).HTMLElement = Base
	;(globalThis as any).customElements = {
		define: (name: string, ctor: CustomElementConstructor) => {
			if (registry.has(name)) throw new Error(`already defined: <${name}>`)
			registry.set(name, ctor)
		},
		get: (name: string) => registry.get(name),
		whenDefined: (name: string) =>
			registry.has(name) ? Promise.resolve() : new Promise(() => {}),
	}
}

let nameCounter = 0
const uniqueName = () => `test-form-${nameCounter++}`

beforeEach(() => {
	installFakeCustomElements()
})

afterEach(() => {
	registry.clear()
})

/* === static formAssociated === */

describe('static formAssociated', () => {
	test('defaults to false when no extensions are provided', () => {
		const Ctor = defineComponent(uniqueName(), () => [])!
		expect((Ctor as any).formAssociated).toBe(false)
	})

	test('is false when an empty extensions array is passed explicitly', () => {
		const Ctor = defineComponent(uniqueName(), () => [], [])!
		expect((Ctor as any).formAssociated).toBe(false)
	})

	test('is true when [formAssociated()] is passed', () => {
		const Ctor = defineComponent(uniqueName(), () => [], [formAssociated()])!
		expect((Ctor as any).formAssociated).toBe(true)
	})
})

/* === Managed value sync === */

describe('managed value sync', () => {
	test('value is synced to internals.setFormValue on connect', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'initial' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals
		expect(internals.formValue).toBe('initial')
	})

	test('value changes propagate to internals.setFormValue', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		instance.value = 'hello'
		expect(internals.formValue).toBe('hello')

		instance.value = 'world'
		expect(internals.formValue).toBe('world')
	})

	test('numeric value is coerced with String()', () => {
		const Ctor = defineComponent<{ value: number }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 0 })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(internals.formValue).toBe('0')
		instance.value = 42
		expect(internals.formValue).toBe('42')
	})
})

/* === Managed formResetCallback === */

describe('managed formResetCallback', () => {
	test('restores value to static default', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'default' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		instance.value = 'changed'
		expect(instance.value).toBe('changed')

		instance.formResetCallback()
		expect(instance.value).toBe('default')
	})

	test('restores value by re-parsing the value attribute (parser initializer)', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: asParser(v => v ?? '') })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.setAttribute('value', 'from-attribute')
		instance.connectedCallback()
		expect(instance.value).toBe('from-attribute')

		instance.value = 'changed'
		instance.formResetCallback()
		expect(instance.value).toBe('from-attribute')
	})

	test('is a no-op when value was not exposed', () => {
		const Ctor = defineComponent<{ foo: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ foo: 'bar' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(() => instance.formResetCallback()).not.toThrow()
	})
})

/* === Managed formStateRestoreCallback === */

describe('managed formStateRestoreCallback', () => {
	test('assigns string state to value', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formStateRestoreCallback('restored', 'restore')
		expect(instance.value).toBe('restored')
	})

	test('ignores non-string state', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'keep' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formStateRestoreCallback({ custom: 'object' }, 'restore')
		expect(instance.value).toBe('keep')
	})

	test('coerces restored string to number for number-valued components', () => {
		const Ctor = defineComponent<{ value: number }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 0 })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		// The browser restores what setFormValue submitted — a string "42".
		// A number-valued component (e.g. form-spinbutton) must receive a
		// number, not the raw string, or downstream arithmetic concatenates.
		instance.formStateRestoreCallback('42', 'restore')
		expect(instance.value).toBe(42)
		expect(typeof instance.value).toBe('number')
	})

	test('re-parses restored string through a Parser initializer', () => {
		const Ctor = defineComponent<{ value: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: asParser(v => v === 'true') })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		// The restored string "true" must be re-parsed to boolean, not
		// assigned as the string "true" (which is truthy but wrong type).
		instance.formStateRestoreCallback('true', 'restore')
		expect(instance.value).toBe(true)
		expect(typeof instance.value).toBe('boolean')
	})
})

/* === Managed formDisabledCallback === */

describe('managed formDisabledCallback', () => {
	test('writes disabled state into the managed disabled signal', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		expect(instance.disabled).toBe(false)
		instance.formDisabledCallback(true)
		expect(instance.disabled).toBe(true)
		instance.formDisabledCallback(false)
		expect(instance.disabled).toBe(false)
	})

	test('disabled can be watched by authors', () => {
		let lastDisabled = false
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, watch }) => {
				expose({ value: '' })
				return [
					watch('disabled', d => {
						lastDisabled = d
					}),
				]
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formDisabledCallback(true)
		expect(lastDisabled).toBe(true)
	})

	test('host.disabled stays consistent when the Slot delegate is replaced', () => {
		// Regression: #createManagedDisabledProperty used to close over the raw
		// backing State signal while the signals map held the Slot wrapping it.
		// After pass() calls slot.replace(newSignal), host.disabled would read
		// the stale original signal instead of the new delegate.
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		// Writing via formDisabledCallback must update host.disabled
		instance.formDisabledCallback(true)
		expect(instance.disabled).toBe(true)

		// Setting host.disabled must reflect to the attribute AND stay in sync
		instance.disabled = false
		expect(instance.disabled).toBe(false)
		expect(instance.hasAttribute('disabled')).toBe(false)
		instance.disabled = true
		expect(instance.disabled).toBe(true)
		expect(instance.hasAttribute('disabled')).toBe(true)

		// After host.disabled = true, formDisabledCallback(false) must override it
		instance.formDisabledCallback(false)
		expect(instance.disabled).toBe(false)
	})
})

/* === Native-parity host contract === */

describe('native-parity host contract', () => {
	test('checkValidity delegates to internals', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(instance.checkValidity()).toBe(true)
		internals.setValidity({ valueMissing: true }, 'Required')
		expect(instance.checkValidity()).toBe(false)
		expect(instance.validationMessage).toBe('Required')
	})

	test('reportValidity delegates to internals', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(instance.reportValidity()).toBe(true)
		internals.setValidity({ customError: true }, 'Bad')
		expect(instance.reportValidity()).toBe(false)
	})

	test('setCustomValidity delegates to internals with customError flag and anchor', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		instance.setCustomValidity('Something went wrong')
		expect(internals.validity.customError).toBe(true)
		expect(internals.validationMessage).toBe('Something went wrong')

		instance.setCustomValidity('')
		expect(internals.validity.customError).toBe(false)
		expect(internals.validationMessage).toBe('')
	})

	test('validity, willValidate, form, labels delegate to internals', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(instance.willValidate).toBe(true)
		expect(instance.form).toBe(null)
		expect(instance.validity.valid).toBe(true)

		internals.willValidate = false
		internals.form = {} as HTMLFormElement
		internals.setValidity({ valueMissing: true }, 'x')
		expect(instance.willValidate).toBe(false)
		expect(instance.form).toBe(internals.form)
		expect(instance.validity.valid).toBe(false)
	})

	test('name reflects the name attribute', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any

		// Absent → empty string (native parity: <input> returns '')
		expect(instance.name).toBe('')

		// Set via attribute
		instance.setAttribute('name', 'email')
		expect(instance.name).toBe('email')

		// Set via property reflects to attribute
		instance.name = 'username'
		expect(instance.getAttribute('name')).toBe('username')
		expect(instance.name).toBe('username')

		// Setting to null removes the attribute
		instance.name = null
		expect(instance.hasAttribute('name')).toBe(false)
		expect(instance.name).toBe('')
	})

	test('labels fallback returns empty list when internals is null', () => {
		installFakeCustomElements(FakeHTMLElementNoInternals)
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).not.toThrow()

		// Must not throw — new NodeList() would throw TypeError: Illegal constructor
		const labels = instance.labels
		expect(labels).toBeDefined()
		expect(labels.length).toBe(0)
	})

	test('form lifecycle callbacks are installed on the prototype', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
			[formAssociated()],
		)!
		expect(typeof Ctor.prototype.formResetCallback).toBe('function')
		expect(typeof Ctor.prototype.formStateRestoreCallback).toBe('function')
		expect(typeof Ctor.prototype.formDisabledCallback).toBe('function')
	})
})

/* === Managed-name collision guard === */

describe('managed-name collision guard', () => {
	test('throws InvalidPropertyNameError when exposing a managed member name', () => {
		const Ctor = defineComponent<Record<string, NonNullable<unknown>>>(
			uniqueName(),
			({ expose }) => {
				expose({ validity: 'evil' } as any)
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).toThrow(InvalidPropertyNameError)
	})

	test('throws for disabled specifically', () => {
		const Ctor = defineComponent<Record<string, NonNullable<unknown>>>(
			uniqueName(),
			({ expose }) => {
				expose({ disabled: true } as any)
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).toThrow(InvalidPropertyNameError)
	})

	test('value is the deliberate exception — exposing it is required', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'ok' })
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).not.toThrow()
		expect(instance.value).toBe('ok')
	})

	test('non-form-associated components may expose these names freely', () => {
		const Ctor = defineComponent<{ validity: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ validity: 'fine' })
			},
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).not.toThrow()
		expect(instance.validity).toBe('fine')
	})
})

/* === internals on FactoryContext === */

describe('internals on FactoryContext', () => {
	test('is a non-null ElementInternals when attachInternals succeeds', () => {
		let capturedInternals: unknown = 'unset'
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, internals }) => {
				expose({ value: '' })
				capturedInternals = internals
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(capturedInternals).not.toBe(null)
		expect(capturedInternals).toBeInstanceOf(FakeElementInternals)
	})

	test('is null when attachInternals throws (graceful degradation)', () => {
		installFakeCustomElements(FakeHTMLElementNoInternals)
		let capturedInternals: unknown = 'unset'
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, internals }) => {
				expose({ value: '' })
				capturedInternals = internals
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).not.toThrow()
		expect(capturedInternals).toBe(null)
	})

	test('internals can be used imperatively for typed validity flags', () => {
		const Ctor = defineComponent<{ value: number }>(
			uniqueName(),
			({ expose, internals, watch }) => {
				expose({ value: 0 })
				watch('value', v => {
					internals?.setValidity(
						{ rangeOverflow: v > 10 },
						v > 10 ? 'Too high' : '',
					)
				})
			},
			[formAssociated()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(internals.validity.rangeOverflow).toBe(false)
		instance.value = 15
		expect(internals.validity.rangeOverflow).toBe(true)
		expect(internals.validationMessage).toBe('Too high')
	})
})

/* === Custom :state() pseudo-classes via internals.states === */

describe('internals.states', () => {
	test('can add and remove custom states', () => {
		const Ctor = defineComponent<{ open: boolean }>(
			uniqueName(),
			({ expose, internals, watch }) => {
				expose({ open: false })
				return [
					watch('open', open => {
						if (open) internals?.states.add('open')
						else internals?.states.delete('open')
					}),
				]
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = (
			instance as any
		).attachInternals() as FakeElementInternals

		expect(internals.states.has('open')).toBe(false)
		instance.open = true
		expect(internals.states.has('open')).toBe(true)
		instance.open = false
		expect(internals.states.has('open')).toBe(false)
	})
})

/* === internals on non-form-associated components === */

describe('non-form-associated components', () => {
	test('internals is still available (attachInternals is unconditional)', () => {
		let capturedInternals: unknown = 'unset'
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, internals }) => {
				expose({ value: '' })
				capturedInternals = internals
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(capturedInternals).not.toBe(null)
	})

	test('no managed value sync effect runs (no setFormValue call)', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'test' })
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals
		// No managed sync — formValue stays null
		expect(internals.formValue).toBe(null)
	})

	test('form lifecycle callbacks are not on the prototype', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
			},
		)!
		// The three form lifecycle callbacks live only on form-associated
		// prototypes — not on every component's prototype.
		expect(Ctor.prototype.formResetCallback).toBeUndefined()
		expect(Ctor.prototype.formStateRestoreCallback).toBeUndefined()
		expect(Ctor.prototype.formDisabledCallback).toBeUndefined()
	})
})

/* === formAssociatedCheckbox() === */

describe('managed checkbox value sync', () => {
	test('checked syncs to internals.setFormValue with the default "on" value', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: false })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(internals.formValue).toBe(null)
		instance.checked = true
		expect(internals.formValue).toBe('on')
		instance.checked = false
		expect(internals.formValue).toBe(null)
	})

	test('submits the host value attribute instead of "on" when set', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: true })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.setAttribute('value', 'newsletter')
		instance.connectedCallback()
		const internals = instance.attachInternals() as FakeElementInternals

		expect(internals.formValue).toBe('newsletter')
	})
})

describe('managed checkbox formResetCallback', () => {
	test('restores checked to its static default', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: true })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		instance.checked = false
		expect(instance.checked).toBe(false)

		instance.formResetCallback()
		expect(instance.checked).toBe(true)
	})

	test('restores checked by re-parsing the checked attribute (parser initializer)', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: asParser(v => v != null) })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.setAttribute('checked', '')
		instance.connectedCallback()
		expect(instance.checked).toBe(true)

		instance.checked = false
		instance.formResetCallback()
		expect(instance.checked).toBe(true)
	})
})

describe('managed checkbox formStateRestoreCallback', () => {
	test('a string state (was checked) restores to true', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: false })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formStateRestoreCallback('on', 'restore')
		expect(instance.checked).toBe(true)
	})

	test('a null state (was unchecked) restores to false', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: true })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formStateRestoreCallback(null, 'restore')
		expect(instance.checked).toBe(false)
	})
})

describe('formAssociatedCheckbox() shares the generic managed layer', () => {
	test('static formAssociated is true', () => {
		const Ctor = defineComponent(uniqueName(), () => [], [
			formAssociatedCheckbox(),
		])!
		expect((Ctor as any).formAssociated).toBe(true)
	})

	test('formDisabledCallback still writes the managed disabled signal', () => {
		const Ctor = defineComponent<{ checked: boolean }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: false })
			},
			[formAssociatedCheckbox()],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		expect(instance.disabled).toBe(false)
		instance.formDisabledCallback(true)
		expect(instance.disabled).toBe(true)
	})

	test('managed-name collision guard still applies', () => {
		const Ctor = defineComponent<{ checked: boolean; name: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ checked: false, name: 'oops' })
			},
			[formAssociatedCheckbox()],
		)
		expect(() => {
			const instance = new Ctor!() as any
			instance.connectedCallback()
		}).toThrow(InvalidPropertyNameError)
	})

	test('combining with formAssociated() throws ExtensionCollisionError in DEV_MODE', () => {
		const prevDevMode = process.env.DEV_MODE
		process.env.DEV_MODE = 'true'
		try {
			expect(() =>
				defineComponent(uniqueName(), () => [], [
					formAssociated(),
					formAssociatedCheckbox(),
				]),
			).toThrow()
		} finally {
			if (prevDevMode === undefined) delete process.env.DEV_MODE
			else process.env.DEV_MODE = prevDevMode
		}
	})
})

/* === Backward compatibility === */

describe('backward compatibility', () => {
	test('two-argument defineComponent still works', () => {
		let ran = false
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'hello' })
				ran = true
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(ran).toBe(true)
		expect(instance.value).toBe('hello')
		expect((Ctor as any).formAssociated).toBe(false)
	})
})
