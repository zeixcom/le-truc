/**
 * Unit tests for src/bindings.ts
 *
 * `safeSetAttribute`/`escapeHTML` are pure-logic, tested against plain stub
 * elements. The `bind*` helpers and `setTextPreservingComments` need a few
 * real DOM globals (`Node.COMMENT_NODE`, `document.createTextNode`,
 * `document.createElement`) that bun:test doesn't provide — `installFakeDom`
 * installs a minimal stand-in, scoped to this file via beforeEach/afterEach.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	type AriaValue,
	bindAria,
	bindAttribute,
	bindClass,
	bindProperty,
	bindState,
	bindStyle,
	bindText,
	bindVisible,
	dangerouslyBindInnerHTML,
	escapeHTML,
	safeSetAttribute,
	setTextPreservingComments,
} from '../bindings'
import { internalsHosts } from '../internal'

/* === Fake DOM (minimal, test-only) === */

class FakeElement {
	tagName: string
	attrs = new Map<string, string>()
	children: FakeElement[] = []
	textContent: string | null = null
	classList = makeClassList()
	style = makeStyle()
	hidden = false
	shadowRoot: FakeElement | null = null
	removed = false
	childNodes: FakeChildNode[] = []
	private _innerHTML = ''

	constructor(tagName: string) {
		this.tagName = tagName.toUpperCase()
	}

	get localName() {
		return this.tagName.toLowerCase()
	}

	get innerHTML() {
		return this._innerHTML
	}

	// Minimal "parser": pulls out <script> tags so the allowScripts
	// re-execution path (which queries `target.querySelectorAll('script')`
	// right after assignment) has something to find — approximates what a
	// real innerHTML parse does, without parsing arbitrary markup. Uses
	// indexOf/slice rather than a backtracking regex over the whole string,
	// so malformed input (no closing tag, no '>') can't cause quadratic blowup.
	set innerHTML(html: string) {
		this._innerHTML = html
		this.children = []
		let pos = 0
		while (true) {
			const openStart = html.toLowerCase().indexOf('<script', pos)
			if (openStart === -1) break
			const openEnd = html.indexOf('>', openStart)
			if (openEnd === -1) break
			const closeStart = html.toLowerCase().indexOf('</script', openEnd + 1)
			if (closeStart === -1) break
			const closeEnd = html.indexOf('>', closeStart)
			if (closeEnd === -1) break
			const attrs = html.slice(openStart + '<script'.length, openEnd)
			const script = new FakeElement('script')
			const attrRe = /([a-zA-Z-]+)(?:="([^"]*)")?/g
			let attrMatch: RegExpExecArray | null
			while ((attrMatch = attrRe.exec(attrs)))
				script.setAttribute(attrMatch[1]!, attrMatch[2] ?? '')
			script.textContent = html.slice(openEnd + 1, closeStart)
			this.children.push(script)
			pos = closeEnd + 1
		}
	}

	getAttribute(name: string) {
		return this.attrs.has(name) ? this.attrs.get(name)! : null
	}
	setAttribute(name: string, value: string) {
		this.attrs.set(name, value)
	}
	hasAttribute(name: string) {
		return this.attrs.has(name)
	}
	removeAttribute(name: string) {
		this.attrs.delete(name)
	}
	toggleAttribute(name: string, force: boolean) {
		if (force) this.attrs.set(name, '')
		else this.attrs.delete(name)
	}
	appendChild(child: FakeElement) {
		this.children.push(child)
		return child
	}
	append(...nodes: FakeChildNode[]) {
		this.childNodes.push(...nodes)
	}
	remove() {
		this.removed = true
	}
	replaceChildren(...nodes: FakeElement[]) {
		this.children = nodes
	}
	querySelectorAll(selector: string) {
		return this.children.filter(
			c => c.tagName.toLowerCase() === selector.toLowerCase(),
		)
	}
	attachShadow(_opts: { mode: ShadowRootMode }) {
		this.shadowRoot = new FakeElement('#shadow-root')
		return this.shadowRoot
	}
}

type FakeChildNode = {
	nodeType: number
	textContent: string
	remove: () => void
}

// `setTextPreservingComments` calls `.remove()` on each non-comment child, so
// fake child nodes need to splice themselves out of their parent's list.
const makeChildNode = (
	parent: FakeElement,
	nodeType: number,
	textContent: string,
): FakeChildNode => {
	const node: FakeChildNode = {
		nodeType,
		textContent,
		remove: () => {
			const idx = parent.childNodes.indexOf(node)
			if (idx >= 0) parent.childNodes.splice(idx, 1)
		},
	}
	parent.childNodes.push(node)
	return node
}

function makeClassList(initial: string[] = []) {
	const tokens = new Set(initial)
	return {
		toggle: (token: string, force?: boolean) => {
			const shouldAdd = force === undefined ? !tokens.has(token) : force
			if (shouldAdd) tokens.add(token)
			else tokens.delete(token)
			return shouldAdd
		},
		contains: (token: string) => tokens.has(token),
	}
}

function makeStyle() {
	const props = new Map<string, string>()
	return {
		setProperty: (prop: string, value: string) => props.set(prop, value),
		removeProperty: (prop: string) => {
			props.delete(prop)
		},
		getPropertyValue: (prop: string) => props.get(prop) ?? '',
	}
}

const installFakeDom = () => {
	;(globalThis as any).document = {
		createElement: (tag: string) => new FakeElement(tag),
		createTextNode: (text: string) => ({
			nodeType: 3,
			textContent: text,
			remove: () => {},
		}),
	}
	;(globalThis as any).Node = { COMMENT_NODE: 8, TEXT_NODE: 3 }
}

/* === RAF Mock (dangerouslyBindInnerHTML schedules via src/scheduler.ts) === */

type RafCb = (timestamp: number) => void
let rafCallbacks: RafCb[] = []
const flushRAF = () => {
	const cbs = rafCallbacks.splice(0)
	for (const cb of cbs) cb(0)
}

beforeEach(() => {
	installFakeDom()
	rafCallbacks = []
	;(globalThis as any).requestAnimationFrame = (cb: RafCb) => {
		rafCallbacks.push(cb)
		return rafCallbacks.length
	}
})

afterEach(() => {
	flushRAF()
	delete (globalThis as any).document
	delete (globalThis as any).Node
	delete (globalThis as any).requestAnimationFrame
})

describe('safeSetAttribute', () => {
	const makeEl = () => {
		const attrs: Record<string, string> = {}
		return {
			localName: 'a',
			setAttribute: (attr: string, val: string) => {
				attrs[attr] = val
			},
			_attrs: attrs,
		} as unknown as Element & { _attrs: Record<string, string> }
	}

	test('blocks javascript: URIs', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'javascript:alert(1)'),
		).toThrow()
	})

	test('blocks data: URIs', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'data:text/html,<h1>XSS</h1>'),
		).toThrow()
	})

	test('blocks vbscript: URIs', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'vbscript:MsgBox(1)'),
		).toThrow()
	})

	test('blocks on* event handler attributes', () => {
		expect(() => safeSetAttribute(makeEl(), 'onclick', 'alert(1)')).toThrow()
	})

	test('allows https: URIs', () => {
		const el = makeEl()
		expect(() =>
			safeSetAttribute(el, 'href', 'https://example.com'),
		).not.toThrow()
	})

	test('allows mailto: URIs', () => {
		const el = makeEl()
		expect(() =>
			safeSetAttribute(el, 'href', 'mailto:foo@example.com'),
		).not.toThrow()
	})

	test('allows relative paths', () => {
		const el = makeEl()
		expect(() => safeSetAttribute(el, 'href', '/page')).not.toThrow()
	})

	test('allows tel: URIs', () => {
		const el = makeEl()
		expect(() => safeSetAttribute(el, 'href', 'tel:+15551234')).not.toThrow()
	})

	test('allows fragment-only URLs', () => {
		const el = makeEl()
		expect(() => safeSetAttribute(el, 'href', '#section')).not.toThrow()
	})

	test('allows query-only URLs', () => {
		const el = makeEl()
		expect(() => safeSetAttribute(el, 'href', '?q=1')).not.toThrow()
	})

	test('allows same-directory page URLs', () => {
		const el = makeEl()
		expect(() => safeSetAttribute(el, 'href', 'page.html')).not.toThrow()
	})

	test('allows ftp: URIs', () => {
		const el = makeEl()
		expect(() =>
			safeSetAttribute(el, 'href', 'ftp://example.com/file'),
		).not.toThrow()
	})

	test('blocks javascript: with internal tab', () => {
		// Browsers strip internal tab when parsing URL schemes, so "java\tscript:"
		// executes. Previously this slipped past the ^javascript: regex.
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'java\tscript:alert(1)'),
		).toThrow()
	})

	test('blocks javascript: with internal newline', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'java\nscript:alert(1)'),
		).toThrow()
	})

	test('blocks javascript: with internal carriage return', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'java\rscript:alert(1)'),
		).toThrow()
	})

	test('blocks javascript: with leading whitespace', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', '   javascript:alert(1)'),
		).toThrow()
	})

	test('blocks javascript: with leading C0 control characters', () => {
		// Browsers strip leading U+0000–U+001F before parsing schemes. Tab/LF/CR
		// are covered above; this catches the remaining C0 range (0x00–0x08,
		// 0x0E–0x1F) that neither the old [\t\n\r\f\v] regex nor trim() removed.
		const codes = [
			...Array.from({ length: 9 }, (_, i) => i),
			...Array.from({ length: 18 }, (_, i) => i + 0x0e),
		]
		for (const code of codes) {
			const payload = String.fromCharCode(code) + 'javascript:alert(1)'
			expect(() => safeSetAttribute(makeEl(), 'href', payload)).toThrow()
		}
	})

	test('blocks protocol-relative URL //host', () => {
		// "//evil.com" contains no "://", so it previously fell through to the
		// allow-by-default return and resolved against the page origin.
		expect(() => safeSetAttribute(makeEl(), 'href', '//evil.com/x')).toThrow()
	})

	test('blocks backslash-prefixed URL \\\\host', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', '\\\\evil.com\\x'),
		).toThrow()
	})

	test('blocks mixed slash-backslash /\\host', () => {
		expect(() => safeSetAttribute(makeEl(), 'href', '/\\evil.com')).toThrow()
	})

	test('blocks javascript: with comment/newline trick', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'javascript:/*\n*/alert(1)'),
		).toThrow()
	})
})

describe('escapeHTML', () => {
	test('escapes ampersand', () => {
		expect(escapeHTML('foo & bar')).toBe('foo &amp; bar')
	})

	test('escapes less than', () => {
		expect(escapeHTML('foo < bar')).toBe('foo &lt; bar')
	})

	test('escapes greater than', () => {
		expect(escapeHTML('foo > bar')).toBe('foo &gt; bar')
	})

	test('escapes double quotes', () => {
		expect(escapeHTML('foo "bar"')).toBe('foo &quot;bar&quot;')
	})

	test('escapes single quotes', () => {
		expect(escapeHTML("foo 'bar'")).toBe('foo &#39;bar&#39;')
	})

	test('escapes multiple special characters', () => {
		expect(escapeHTML('<script>alert("XSS")</script>')).toBe(
			'&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
		)
	})

	test('returns empty string for empty input', () => {
		expect(escapeHTML('')).toBe('')
	})

	test('returns same string when no special characters', () => {
		expect(escapeHTML('hello world')).toBe('hello world')
	})

	test('escapes all special characters together', () => {
		expect(escapeHTML('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
	})
})

describe('setTextPreservingComments', () => {
	test('keeps comment nodes and removes other children before appending text', () => {
		const el = new FakeElement('div')
		const comment = makeChildNode(el, Node.COMMENT_NODE, ' marker ')
		makeChildNode(el, Node.TEXT_NODE, 'old text')

		setTextPreservingComments(el as unknown as Element, 'new text')

		expect(el.childNodes).toHaveLength(2)
		expect(el.childNodes[0]).toBe(comment)
		expect(el.childNodes[1]?.textContent).toBe('new text')
	})

	test('appends text when there are no existing children', () => {
		const el = new FakeElement('div')
		setTextPreservingComments(el as unknown as Element, 'hello')
		expect(el.childNodes).toHaveLength(1)
		expect(el.childNodes[0]?.textContent).toBe('hello')
	})
})

describe('bindText', () => {
	test('sets textContent directly by default', () => {
		const el = new FakeElement('div')
		bindText(el as unknown as Element)('hello')
		expect(el.textContent).toBe('hello')
	})

	test('coerces numbers to strings', () => {
		const el = new FakeElement('div')
		bindText(el as unknown as Element)(42)
		expect(el.textContent).toBe('42')
	})

	test('preserves comment nodes when preserveComments is true', () => {
		const el = new FakeElement('div')
		const comment = makeChildNode(el, Node.COMMENT_NODE, ' marker ')
		bindText(el as unknown as Element, true)('hello')
		expect(el.childNodes).toContain(comment)
		expect(el.childNodes.at(-1)?.textContent).toBe('hello')
	})
})

describe('bindProperty', () => {
	test('sets the given property on the target object', () => {
		const obj = { count: 0 }
		bindProperty(obj, 'count')(5)
		expect(obj.count).toBe(5)
	})

	test('overwrites a previously set value', () => {
		const obj = { label: 'a' }
		const setLabel = bindProperty(obj, 'label')
		setLabel('b')
		setLabel('c')
		expect(obj.label).toBe('c')
	})

	describe('map form', () => {
		test('patches multiple keys present in the map', () => {
			const obj = { a: 1, b: 2, c: 3 }
			bindProperty(obj, ['a', 'b', 'c'])({ a: 10, b: 20, c: 30 })
			expect(obj).toEqual({ a: 10, b: 20, c: 30 })
		})

		test('skips keys absent from the map, leaving their previous value', () => {
			const obj = { a: 1, b: 2 }
			bindProperty(obj, ['a', 'b'])({ a: 10 })
			expect(obj).toEqual({ a: 10, b: 2 })
		})

		test('an empty map leaves every declared key untouched', () => {
			const obj = { a: 1, b: 2 }
			bindProperty(obj, ['a', 'b'])({})
			expect(obj).toEqual({ a: 1, b: 2 })
		})
	})
})

describe('bindClass', () => {
	test('adds the class token when value is true', () => {
		const el = new FakeElement('div')
		bindClass(el as unknown as Element, 'active')(true)
		expect(el.classList.contains('active')).toBe(true)
	})

	test('removes the class token when value is false', () => {
		const el = new FakeElement('div')
		el.classList.toggle('active', true)
		bindClass(el as unknown as Element, 'active')(false)
		expect(el.classList.contains('active')).toBe(false)
	})

	test('coerces truthy non-boolean values', () => {
		const el = new FakeElement('div')
		bindClass<number>(el as unknown as Element, 'has-items')(3)
		expect(el.classList.contains('has-items')).toBe(true)
	})

	describe('map form', () => {
		test('toggles every declared token from one map', () => {
			const el = new FakeElement('div')
			bindClass(el as unknown as Element, ['active', 'selected'])({
				active: true,
				selected: false,
			})
			expect(el.classList.contains('active')).toBe(true)
			expect(el.classList.contains('selected')).toBe(false)
		})

		test('a token absent from the map coerces to false (off)', () => {
			const el = new FakeElement('div')
			el.classList.toggle('selected', true)
			bindClass(el as unknown as Element, ['active', 'selected'])({
				active: true,
			})
			expect(el.classList.contains('active')).toBe(true)
			expect(el.classList.contains('selected')).toBe(false)
		})

		test('an empty map clears every declared token', () => {
			const el = new FakeElement('div')
			el.classList.toggle('active', true)
			el.classList.toggle('selected', true)
			bindClass(el as unknown as Element, ['active', 'selected'])({})
			expect(el.classList.contains('active')).toBe(false)
			expect(el.classList.contains('selected')).toBe(false)
		})
	})
})

describe('bindState', () => {
	// A real Set matches the add/delete surface of CustomStateSet.
	const fakeInternals = () => {
		const states = new Set<string>()
		return { states, internals: { states } as unknown as ElementInternals }
	}

	test('adds the state token when value is true', () => {
		const { states, internals } = fakeInternals()
		bindState(internals, 'overflow-end')(true)
		expect(states.has('overflow-end')).toBe(true)
	})

	test('removes the state token when value is false', () => {
		const { states, internals } = fakeInternals()
		states.add('overflow-end')
		bindState(internals, 'overflow-end')(false)
		expect(states.has('overflow-end')).toBe(false)
	})

	test('coerces truthy non-boolean values', () => {
		const { states, internals } = fakeInternals()
		bindState<number>(internals, 'has-items')(3)
		expect(states.has('has-items')).toBe(true)
	})

	test('is a no-op when internals is null', () => {
		expect(() => {
			bindState(null, 'overflow-end')(true)
		}).not.toThrow()
	})

	describe('map form', () => {
		test('toggles every declared token from one map', () => {
			const { states, internals } = fakeInternals()
			bindState(internals, ['overflow-start', 'overflow-end'])({
				'overflow-start': true,
				'overflow-end': false,
			})
			expect(states.has('overflow-start')).toBe(true)
			expect(states.has('overflow-end')).toBe(false)
		})

		test('a token absent from the map coerces to false (off)', () => {
			const { states, internals } = fakeInternals()
			states.add('overflow-end')
			bindState(internals, ['overflow-start', 'overflow-end'])({
				'overflow-start': true,
			})
			expect(states.has('overflow-start')).toBe(true)
			expect(states.has('overflow-end')).toBe(false)
		})

		test('an empty map clears every declared token', () => {
			const { states, internals } = fakeInternals()
			states.add('overflow-start')
			states.add('overflow-end')
			bindState(internals, ['overflow-start', 'overflow-end'])({})
			expect(states.has('overflow-start')).toBe(false)
			expect(states.has('overflow-end')).toBe(false)
		})

		test('is a no-op when internals is null', () => {
			expect(() => {
				bindState(null, ['overflow-start', 'overflow-end'])({
					'overflow-start': true,
				})
			}).not.toThrow()
		})
	})
})

describe('bindVisible', () => {
	test('value=true makes the element visible (hidden=false)', () => {
		const el = new FakeElement('div')
		el.hidden = true
		bindVisible(el as unknown as HTMLElement)(true)
		expect(el.hidden).toBe(false)
	})

	test('value=false hides the element (hidden=true)', () => {
		const el = new FakeElement('div')
		bindVisible(el as unknown as HTMLElement)(false)
		expect(el.hidden).toBe(true)
	})
})

describe('bindStyle', () => {
	test('ok sets the inline style property', () => {
		const el = new FakeElement('div')
		bindStyle(el as unknown as HTMLElement, 'color').ok('red')
		expect(el.style.getPropertyValue('color')).toBe('red')
	})

	test('nil removes the inline style property', () => {
		const el = new FakeElement('div')
		el.style.setProperty('color', 'red')
		bindStyle(el as unknown as HTMLElement, 'color').nil?.()
		expect(el.style.getPropertyValue('color')).toBe('')
	})

	describe('map form', () => {
		test('ok sets multiple properties in one call', () => {
			const el = new FakeElement('div')
			bindStyle(el as unknown as HTMLElement, ['color', '--x']).ok({
				color: 'red',
				'--x': '1px',
			})
			expect(el.style.getPropertyValue('color')).toBe('red')
			expect(el.style.getPropertyValue('--x')).toBe('1px')
		})

		test('ok removes a property whose value is null, leaving others set', () => {
			const el = new FakeElement('div')
			el.style.setProperty('color', 'red')
			bindStyle(el as unknown as HTMLElement, ['color', '--x']).ok({
				color: null,
				'--x': '1px',
			})
			expect(el.style.getPropertyValue('color')).toBe('')
			expect(el.style.getPropertyValue('--x')).toBe('1px')
		})

		test('ok removes a property absent from the map', () => {
			const el = new FakeElement('div')
			el.style.setProperty('color', 'red')
			bindStyle(el as unknown as HTMLElement, ['color', '--x']).ok({
				'--x': '1px',
			})
			expect(el.style.getPropertyValue('color')).toBe('')
		})

		test('nil clears every declared property', () => {
			const el = new FakeElement('div')
			el.style.setProperty('color', 'red')
			el.style.setProperty('--x', '1px')
			bindStyle(el as unknown as HTMLElement, ['color', '--x']).nil?.()
			expect(el.style.getPropertyValue('color')).toBe('')
			expect(el.style.getPropertyValue('--x')).toBe('')
		})
	})
})

describe('bindAttribute', () => {
	test('ok with a safe string value sets the attribute', () => {
		const el = new FakeElement('a')
		bindAttribute(el as unknown as Element, 'href').ok('https://example.com')
		expect(el.getAttribute('href')).toBe('https://example.com')
	})

	test('ok with an unsafe string value throws (delegates to safeSetAttribute)', () => {
		const el = new FakeElement('a')
		expect(() =>
			bindAttribute(el as unknown as Element, 'href').ok('javascript:alert(1)'),
		).toThrow()
	})

	test('allowUnsafe bypasses safeSetAttribute validation', () => {
		const el = new FakeElement('a')
		expect(() =>
			bindAttribute(el as unknown as Element, 'href', true).ok(
				'javascript:alert(1)',
			),
		).not.toThrow()
		expect(el.getAttribute('href')).toBe('javascript:alert(1)')
	})

	test('ok with true toggles the attribute on', () => {
		const el = new FakeElement('button')
		bindAttribute(el as unknown as Element, 'disabled').ok(true)
		expect(el.hasAttribute('disabled')).toBe(true)
	})

	test('ok with false toggles the attribute off', () => {
		const el = new FakeElement('button')
		el.toggleAttribute('disabled', true)
		bindAttribute(el as unknown as Element, 'disabled').ok(false)
		expect(el.hasAttribute('disabled')).toBe(false)
	})

	test('nil removes the attribute', () => {
		const el = new FakeElement('button')
		el.setAttribute('disabled', '')
		bindAttribute(el as unknown as Element, 'disabled').nil?.()
		expect(el.hasAttribute('disabled')).toBe(false)
	})

	describe('map form', () => {
		test('ok sets a string and toggles a boolean in one call', () => {
			const el = new FakeElement('button')
			bindAttribute(el as unknown as Element, ['title', 'disabled']).ok({
				title: 'hi',
				disabled: true,
			})
			expect(el.getAttribute('title')).toBe('hi')
			expect(el.hasAttribute('disabled')).toBe(true)
		})

		test('ok removes a key whose value is null, leaving others set', () => {
			const el = new FakeElement('button')
			el.setAttribute('title', 'hi')
			bindAttribute(el as unknown as Element, ['title', 'disabled']).ok({
				title: null as unknown as string,
				disabled: true,
			})
			expect(el.hasAttribute('title')).toBe(false)
			expect(el.hasAttribute('disabled')).toBe(true)
		})

		test('ok removes a key absent from the map', () => {
			const el = new FakeElement('button')
			el.setAttribute('title', 'hi')
			bindAttribute(el as unknown as Element, ['title', 'disabled']).ok({
				disabled: true,
			})
			expect(el.hasAttribute('title')).toBe(false)
		})

		test('ok with an unsafe string value throws (delegates to safeSetAttribute)', () => {
			const el = new FakeElement('a')
			expect(() =>
				bindAttribute(el as unknown as Element, ['href']).ok({
					href: 'javascript:alert(1)',
				}),
			).toThrow()
		})

		test('allowUnsafe bypasses safeSetAttribute validation', () => {
			const el = new FakeElement('a')
			bindAttribute(el as unknown as Element, ['href'], true).ok({
				href: 'javascript:alert(1)',
			})
			expect(el.getAttribute('href')).toBe('javascript:alert(1)')
		})

		test('nil removes every declared attribute', () => {
			const el = new FakeElement('button')
			el.setAttribute('title', 'hi')
			el.setAttribute('disabled', '')
			bindAttribute(el as unknown as Element, ['title', 'disabled']).nil?.()
			expect(el.hasAttribute('title')).toBe(false)
			expect(el.hasAttribute('disabled')).toBe(false)
		})
	})
})

describe('dangerouslyBindInnerHTML', () => {
	test('ok sets innerHTML on the element', () => {
		const el = new FakeElement('div')
		dangerouslyBindInnerHTML(el as unknown as Element).ok('<p>hi</p>')
		flushRAF()
		expect(el.innerHTML).toBe('<p>hi</p>')
	})

	test('nil resets via replaceChildren (no shadow root)', () => {
		const el = new FakeElement('div')
		el.innerHTML = '<p>hi</p>'
		dangerouslyBindInnerHTML(el as unknown as Element).nil?.()
		flushRAF()
		expect(el.children).toHaveLength(0)
	})

	test('ok with an empty string resets instead of assigning', () => {
		const el = new FakeElement('div')
		el.innerHTML = '<p>hi</p>'
		dangerouslyBindInnerHTML(el as unknown as Element).ok('')
		flushRAF()
		expect(el.children).toHaveLength(0)
	})

	test('shadowRootMode attaches a shadow root and writes innerHTML there', () => {
		const el = new FakeElement('my-el')
		dangerouslyBindInnerHTML(el as unknown as Element, {
			shadowRootMode: 'open',
		}).ok('<p>hi</p>')
		flushRAF()
		expect(el.shadowRoot).not.toBeNull()
		expect(el.shadowRoot?.innerHTML).toBe('<p>hi</p>')
		expect(el.innerHTML).toBe('') // host's own innerHTML untouched
	})

	test('nil with an existing shadow root resets to a <slot>', () => {
		const el = new FakeElement('my-el')
		el.attachShadow({ mode: 'open' })
		el.shadowRoot!.innerHTML = '<p>hi</p>'
		dangerouslyBindInnerHTML(el as unknown as Element, {
			shadowRootMode: 'open',
		}).nil?.()
		flushRAF()
		expect(el.shadowRoot?.children).toHaveLength(1)
		expect(el.shadowRoot?.children[0]?.tagName).toBe('SLOT')
	})

	test('sanitize hook is applied before assignment', () => {
		const el = new FakeElement('div')
		const sanitize = (html: string) => html.replace(/<img[^>]*>/gi, '')
		dangerouslyBindInnerHTML(el as unknown as Element, { sanitize }).ok(
			'<img src=x onerror="alert(1)"><p>safe</p>',
		)
		flushRAF()
		expect(el.innerHTML).toBe('<p>safe</p>')
	})

	test('allowScripts re-creates and appends a script element, removing the original', () => {
		const el = new FakeElement('div')
		dangerouslyBindInnerHTML(el as unknown as Element, {
			allowScripts: true,
		}).ok('<script type="text/javascript">console.log(1)</script>')
		flushRAF()

		const original = el.querySelectorAll('script')[0] as FakeElement
		expect(original?.removed).toBe(true)

		const appended = el.children.filter(c => c.tagName === 'SCRIPT')
		expect(appended.length).toBeGreaterThan(0)
		const newScript = appended[appended.length - 1]!
		expect(newScript.getAttribute('type')).toBe('text/javascript')
	})

	test('without allowScripts, inline scripts are left untouched', () => {
		const el = new FakeElement('div')
		dangerouslyBindInnerHTML(el as unknown as Element).ok(
			'<script>console.log(1)</script>',
		)
		flushRAF()

		const script = el.querySelectorAll('script')[0] as FakeElement
		expect(script?.removed).toBe(false)
	})
})

/* === bindAria (ADR 0026) === */

/**
 * Minimal stand-in for `ElementInternals` — only the ARIAMixin members the
 * tests touch. A real ElementInternals is unreachable in bun:test.
 */
class FakeAriaInternals {
	role: string | null = null
	ariaExpanded: string | null = null
	ariaValueNow: string | null = null
	ariaActiveDescendantElement: Element | null = null
	ariaDescribedByElements: readonly Element[] | null = null
	ariaLabelledByElements: readonly Element[] | null = null
}

/** Register stub internals against a stub host, enabling the removal rule. */
const makeRegisteredInternals = () => {
	const internals = new FakeAriaInternals()
	const host = new FakeElement('test-foo')
	internalsHosts.set(
		internals as unknown as ElementInternals,
		host as unknown as HTMLElement,
	)
	return { internals, host }
}

describe('bindAria — ADR 0026 §2 mapping table', () => {
	test('ok(boolean) → "true"/"false", never toggleAttribute-style empty string', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(true)
		expect(internals.ariaExpanded).toBe('true')
		handlers.ok(false)
		expect(internals.ariaExpanded).toBe('false')
	})

	test('ok(number) → decimal string', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaValueNow')
		handlers.ok(42)
		expect(internals.ariaValueNow).toBe('42')
	})

	test('ok(string) → pass-through', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'role')
		handlers.ok('slider')
		expect(internals.role).toBe('slider')
	})

	test('ok(Element) → pass-through', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(
			internals as unknown as ARIAMixin,
			'ariaActiveDescendantElement',
		)
		const option = new FakeElement('option') as unknown as Element
		handlers.ok(option)
		expect(internals.ariaActiveDescendantElement).toBe(option)
	})

	test('ok(readonly Element[]) → pass-through', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(
			internals as unknown as ARIAMixin,
			'ariaDescribedByElements',
		)
		const description = new FakeElement('p') as unknown as Element
		handlers.ok([description])
		expect(internals.ariaDescribedByElements).toEqual([description])
	})

	test('ok(null | undefined) → clears (assigns null)', () => {
		// `ok()`'s static type excludes null/undefined (SingleMatchHandlers<T>
		// requires T extends {}) but guards for both at runtime — see the
		// AriaValue doc comment in src/bindings.ts. A signal whose *resolved
		// value* is legitimately null (not merely unset) still reaches ok(null)
		// via cause-effect's match(), so this exercises real, reachable
		// behavior, not just a type escape hatch.
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		internals.ariaExpanded = 'true'
		handlers.ok(null as never)
		expect(internals.ariaExpanded).toBeNull()
		internals.ariaExpanded = 'true'
		handlers.ok(undefined as never)
		expect(internals.ariaExpanded).toBeNull()
	})

	test('nil → clears (assigns null), same as ok(null)', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		internals.ariaExpanded = 'true'
		handlers.nil?.()
		expect(internals.ariaExpanded).toBeNull()
	})

	test('null target: every handler is a no-op (attachInternals()-failed degradation)', () => {
		const handlers = bindAria(null, 'ariaExpanded')
		expect(() => handlers.ok(true)).not.toThrow()
		expect(() => handlers.nil?.()).not.toThrow()
	})

	test('undefined target: every handler is a no-op', () => {
		const handlers = bindAria(undefined, 'ariaExpanded')
		expect(() => handlers.ok('x')).not.toThrow()
	})
})

describe('bindAria — map form', () => {
	test('ok assigns every declared name from one map, per the coercion table', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, [
			'ariaExpanded',
			'ariaValueNow',
			'role',
		])
		handlers.ok({ ariaExpanded: true, ariaValueNow: 180, role: 'slider' })
		expect(internals.ariaExpanded).toBe('true')
		expect(internals.ariaValueNow).toBe('180')
		expect(internals.role).toBe('slider')
	})

	test('ok with a nullish entry clears that property, leaving the others set', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, [
			'ariaExpanded',
			'ariaValueNow',
		])
		handlers.ok({ ariaExpanded: true, ariaValueNow: 180 })
		handlers.ok({ ariaExpanded: true })
		expect(internals.ariaExpanded).toBe('true')
		expect(internals.ariaValueNow).toBeNull()
	})

	test('nil clears every declared property', () => {
		const { internals } = makeRegisteredInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, [
			'ariaExpanded',
			'ariaValueNow',
		])
		handlers.ok({ ariaExpanded: true, ariaValueNow: 180 })
		handlers.nil?.()
		expect(internals.ariaExpanded).toBeNull()
		expect(internals.ariaValueNow).toBeNull()
	})

	test('null target: every handler is a no-op', () => {
		const handlers = bindAria(null, ['ariaExpanded', 'ariaValueNow'])
		expect(() => handlers.ok({ ariaExpanded: true })).not.toThrow()
		expect(() => handlers.nil?.()).not.toThrow()
	})
})

describe('bindAria — stale-attribute rule (ADR 0026 §1)', () => {
	test('removes the shadowing attribute once, at the first value assertion', () => {
		const { internals, host } = makeRegisteredInternals()
		host.setAttribute('aria-expanded', 'false')
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(true)
		expect(host.hasAttribute('aria-expanded')).toBe(false)
		expect(internals.ariaExpanded).toBe('true')
	})

	test('IDL → attribute mapping covers all four shapes', () => {
		// ariaValueNow → aria-valuenow (no inner hyphens despite the casing),
		// ariaDescribedByElements → aria-describedby, ariaActiveDescendantElement
		// → aria-activedescendant, role → itself.
		const cases: Array<[keyof ARIAMixin & string, string, AriaValue]> = [
			['ariaValueNow', 'aria-valuenow', 5],
			[
				'ariaDescribedByElements',
				'aria-describedby',
				new FakeElement('p') as unknown as Element,
			],
			[
				'ariaActiveDescendantElement',
				'aria-activedescendant',
				new FakeElement('option') as unknown as Element,
			],
			['role', 'role', 'slider'],
		]
		for (const [idl, attr, value] of cases) {
			const { internals, host } = makeRegisteredInternals()
			host.setAttribute(attr, 'stale')
			bindAria(internals as unknown as ARIAMixin, idl).ok(value)
			expect(host.hasAttribute(attr)).toBe(false)
		}
	})

	test('is NOT kebab-case: ariaLabelledByElements removes "aria-labelledby" only', () => {
		// A naive kebab-case transform yields 'aria-labelled-by' and silently
		// removes nothing — the stale attribute would keep shadowing forever.
		const { internals, host } = makeRegisteredInternals()
		host.setAttribute('aria-labelledby', 'real-label')
		host.setAttribute('aria-labelled-by', 'naive-kebab')
		const description = new FakeElement('p') as unknown as Element
		bindAria(internals as unknown as ARIAMixin, 'ariaLabelledByElements').ok([
			description,
		])
		expect(host.hasAttribute('aria-labelledby')).toBe(false)
		expect(host.getAttribute('aria-labelled-by')).toBe('naive-kebab')
	})

	test('nil does not remove (no assertion → attribute keeps authority)', () => {
		const { internals, host } = makeRegisteredInternals()
		host.setAttribute('aria-expanded', 'false')
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.nil?.()
		expect(host.getAttribute('aria-expanded')).toBe('false')
		expect(internals.ariaExpanded).toBeNull()
	})

	test('ok(null) does not remove (clearing restores attribute authority)', () => {
		const { internals, host } = makeRegisteredInternals()
		host.setAttribute('aria-expanded', 'false')
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(null as never)
		expect(host.getAttribute('aria-expanded')).toBe('false')
		expect(internals.ariaExpanded).toBeNull()
	})

	test('removal fires once — an attribute re-set later (consumer override) survives updates', () => {
		const { internals, host } = makeRegisteredInternals()
		host.setAttribute('aria-expanded', 'false')
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(true)
		expect(host.hasAttribute('aria-expanded')).toBe(false)
		// A consumer (or parent framework) re-asserts via the attribute channel
		// AFTER the binding took over — the override channel (§1 row 2).
		host.setAttribute('aria-expanded', 'false')
		handlers.ok(false)
		handlers.ok(true)
		expect(host.getAttribute('aria-expanded')).toBe('false')
	})

	test("map form: removal is per property, at that property's own first assertion", () => {
		const { internals, host } = makeRegisteredInternals()
		host.setAttribute('aria-valuenow', '210')
		host.setAttribute('aria-valuetext', '210 degrees')
		const handlers = bindAria(internals as unknown as ARIAMixin, [
			'ariaValueNow',
			'ariaValueText',
		])
		handlers.ok({ ariaValueNow: 180 })
		// ariaValueNow asserted → its echo removed; ariaValueText only cleared
		// (nullish entry) → its echo keeps authority until first asserted.
		expect(host.hasAttribute('aria-valuenow')).toBe(false)
		expect(host.getAttribute('aria-valuetext')).toBe('210 degrees')
		handlers.ok({ ariaValueNow: 180, ariaValueText: '180 degrees' })
		expect(host.hasAttribute('aria-valuetext')).toBe(false)
		expect(
			(internals as unknown as Record<string, unknown>).ariaValueText,
		).toBe('180 degrees')
	})

	test('internals absent from the reverse lookup: no removal, no throw', () => {
		// Internals this library did not create (e.g. hand-attached in a raw
		// custom element) are not in internalsHosts — the rule degrades to a
		// no-op rather than throwing or guessing a host.
		const internals = new FakeAriaInternals()
		const host = new FakeElement('test-foo')
		host.setAttribute('aria-expanded', 'false')
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(true)
		expect(host.getAttribute('aria-expanded')).toBe('false')
		expect(internals.ariaExpanded).toBe('true')
	})
})

describe('bindAria — compile-time rejections (@ts-expect-error pins)', () => {
	test('type-level pins compile only if the errors below are real', () => {
		const internals = new FakeAriaInternals() as unknown as ARIAMixin

		// @ts-expect-error — 'aria-expanded' is the content-attribute name, not
		// the ARIAMixin IDL property ('ariaExpanded'); bindAria is typed off the
		// platform property names, not attribute strings (that's bindAttribute's
		// job, which — unlike bindAria — would toggleAttribute() a boolean into
		// an invalid empty-string ARIA value; ADR 0026 §2 exists to avoid that).
		bindAria(internals, 'aria-expanded')

		// @ts-expect-error — not an ARIAMixin property at all.
		bindAria(internals, 'textContent')

		const handlers = bindAria(internals, 'ariaExpanded')
		// @ts-expect-error — a plain object is not a valid AriaValue (not
		// boolean/number/string/Element/Element[]/null/undefined).
		handlers.ok({ not: 'a valid aria value' })

		// @ts-expect-error — a symbol is not a valid AriaValue either.
		handlers.ok(Symbol('nope'))

		expect(true).toBe(true)
	})
})
