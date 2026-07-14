/**
 * Unit tests for ElementInternals support (form association, custom states).
 *
 * Tests the integration between `defineComponent({ formAssociated: true })`,
 * the `internals` context property, and the `onForm*()` lifecycle helpers.
 * Uses the same FakeHTMLElement / fake customElements pattern as component.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createState } from '@zeix/cause-effect'
import { defineComponent } from '../component'

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

	setFormValue(value: string | File | FormData | null) {
		this.formValue = value
	}
	setValidity(
		flags: ValidityStateFlags,
		message?: string,
		anchor?: HTMLElement,
	) {
		Object.assign(this.validity, flags)
		// Recompute valid: true only if no error flag is set
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
	test('defaults to false when no options are provided', () => {
		const Ctor = defineComponent(uniqueName(), () => [])!
		expect((Ctor as any).formAssociated).toBe(false)
	})

	test('is true when { formAssociated: true } is passed', () => {
		const Ctor = defineComponent(uniqueName(), () => [], {
			formAssociated: true,
		})!
		expect((Ctor as any).formAssociated).toBe(true)
	})

	test('is false when { formAssociated: false } is passed explicitly', () => {
		const Ctor = defineComponent(uniqueName(), () => [], {
			formAssociated: false,
		})!
		expect((Ctor as any).formAssociated).toBe(false)
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
				return []
			},
			{ formAssociated: true },
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
				return []
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		// Should not throw during construction or connection
		expect(() => instance.connectedCallback()).not.toThrow()
		expect(capturedInternals).toBe(null)
	})

	test('internals can be used imperatively inside watch() to setFormValue', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, host, internals, watch }) => {
				expose({ value: '' })
				return [
					watch('value', v => {
						internals?.setFormValue(v)
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = (
			instance as any
		).attachInternals() as FakeElementInternals
		expect(internals.formValue).toBe('')

		instance.value = 'hello'
		expect(internals.formValue).toBe('hello')
	})

	test('internals can be used to setValidity', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, host, internals, watch }) => {
				expose({ value: '' })
				return [
					watch('value', v => {
						const valid = v.length > 0
						internals?.setValidity(
							{ valueMissing: !valid, customError: !valid },
							valid ? '' : 'Value is required',
						)
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		const internals = (
			instance as any
		).attachInternals() as FakeElementInternals

		// Initial: value is '', should be invalid
		expect(internals.validity.valid).toBe(false)
		expect(internals.validity.valueMissing).toBe(true)
		expect(internals.validationMessage).toBe('Value is required')

		instance.value = 'ok'
		expect(internals.validity.valid).toBe(true)
		expect(internals.validationMessage).toBe('')
	})
})

/* === onForm* lifecycle helpers === */

describe('onFormReset', () => {
	test('handler is called when formResetCallback fires', () => {
		let resetCount = 0
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, host, onFormReset }) => {
				expose({ value: 'initial' })
				return [
					onFormReset(() => {
						resetCount++
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(resetCount).toBe(0)

		instance.formResetCallback()
		expect(resetCount).toBe(1)
	})

	test('handler can reset host state', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, host, onFormReset }) => {
				expose({ value: 'initial' })
				return [
					onFormReset(() => {
						host.value = 'initial'
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		instance.value = 'changed'
		expect(instance.value).toBe('changed')

		instance.formResetCallback()
		expect(instance.value).toBe('initial')
	})
})

describe('onFormDisabled', () => {
	test('handler is called with the disabled value', () => {
		const calls: boolean[] = []
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, onFormDisabled }) => {
				expose({ value: '' })
				return [
					onFormDisabled(d => {
						calls.push(d)
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formDisabledCallback(true)
		instance.formDisabledCallback(false)
		expect(calls).toEqual([true, false])
	})
})

describe('onFormAssociated', () => {
	test('handler is called when formAssociatedCallback fires', () => {
		const calls: (HTMLFormElement | null)[] = []
		const fakeForm = {} as HTMLFormElement
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, onFormAssociated }) => {
				expose({ value: '' })
				return [
					onFormAssociated(form => {
						calls.push(form)
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formAssociatedCallback(fakeForm)
		expect(calls).toEqual([fakeForm])

		instance.formAssociatedCallback(null)
		expect(calls).toEqual([fakeForm, null])
	})

	test('late-registration replay: handler fires with cached form if callback already fired', () => {
		const calls: (HTMLFormElement | null)[] = []
		const fakeForm = {} as HTMLFormElement

		// Simulate the scenario: formAssociatedCallback fires BEFORE the
		// effect activates (e.g. no child dependencies to wait for, but
		// the onFormAssociated descriptor hasn't run yet).
		// We achieve this by calling formAssociatedCallback before
		// connectedCallback, then connecting — the handler should replay.
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, onFormAssociated }) => {
				expose({ value: '' })
				return [
					onFormAssociated(form => {
						calls.push(form)
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any

		// formAssociatedCallback fires during DOM insertion, before the
		// factory's effect descriptors activate.
		instance.formAssociatedCallback(fakeForm)
		expect(calls).toEqual([]) // no handler registered yet

		instance.connectedCallback()
		// The handler was registered and replayed with the cached form value
		expect(calls).toEqual([fakeForm])
	})
})

describe('onFormStateRestore', () => {
	test('handler is called with state and mode', () => {
		const calls: Array<{ state: unknown; mode: string }> = []
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, onFormStateRestore }) => {
				expose({ value: '' })
				return [
					onFormStateRestore((state, mode) => {
						calls.push({ state, mode })
					}),
				]
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.formStateRestoreCallback('restored-value', 'restore')
		expect(calls).toEqual([{ state: 'restored-value', mode: 'restore' }])
	})
})

/* === Form callbacks without registered handlers === */

describe('form callbacks without registered handlers', () => {
	test('formResetCallback does not throw when no handler is registered', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
				return []
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(() => instance.formResetCallback()).not.toThrow()
	})

	test('formDisabledCallback does not throw when no handler is registered', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
				return []
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(() => instance.formDisabledCallback(true)).not.toThrow()
	})

	test('formAssociatedCallback does not throw when no handler is registered', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
				return []
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(() =>
			instance.formAssociatedCallback(null as unknown as HTMLFormElement),
		).not.toThrow()
	})

	test('formStateRestoreCallback does not throw when no handler is registered', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
				return []
			},
			{ formAssociated: true },
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(() =>
			instance.formStateRestoreCallback(null, 'restore'),
		).not.toThrow()
	})
})

/* === Non-form-associated components === */

describe('non-form-associated components', () => {
	test('internals is still available (attachInternals is unconditional)', () => {
		let capturedInternals: unknown = 'unset'
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose, internals }) => {
				expose({ value: '' })
				capturedInternals = internals
				return []
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(capturedInternals).not.toBe(null)
	})

	test('form callback stubs exist but are no-ops', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: '' })
				return []
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(() => instance.formResetCallback()).not.toThrow()
		expect(() => instance.formDisabledCallback(true)).not.toThrow()
		expect(() =>
			instance.formAssociatedCallback(null as unknown as HTMLFormElement),
		).not.toThrow()
		expect(() =>
			instance.formStateRestoreCallback(null, 'restore'),
		).not.toThrow()
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

/* === Backward compatibility === */

describe('backward compatibility', () => {
	test('two-argument defineComponent still works', () => {
		let ran = false
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: 'hello' })
				ran = true
				return []
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(ran).toBe(true)
		expect(instance.value).toBe('hello')
		expect((Ctor as any).formAssociated).toBe(false)
	})
})
