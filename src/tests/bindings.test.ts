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
