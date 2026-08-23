/**
 * Unit tests for the TSRX compiler front end (server/tsrx/compiler.ts):
 * JSX text collapsing, free-identifier scoping, and template classification.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'
import { collapseJsxText, freeIdentifiers } from '../../tsrx/ast-utils'
import { compileSource, type TemplateNode } from '../../tsrx/compiler'

type ElementNode = Extract<TemplateNode, { kind: 'element' }>

const firstElementChild = (
	node: TemplateNode | undefined,
): ElementNode | undefined => {
	if (node?.kind !== 'element') return undefined
	return node.children.find((c): c is ElementNode => c.kind === 'element')
}

describe('attribute shorthand `{name}`', () => {
	// @tsrx/core parses `<c-el {name}>` to the same JSXAttribute shape as
	// `name={name}`, so the whole pipeline treats them identically. This test
	// pins that equivalence — a parser pin upgrade must not silently drop it.
	const compile = (attr: string) => {
		const source = `export function C({ name }: { name?: string })
	@{
		expose({})
		<>
			<c-el ${attr}>ok</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		if (!component)
			throw new Error(
				`shorthand ${attr} must compile: ${JSON.stringify(diagnostics)}`,
			)
		return { server: component.serverCode, client: component.clientCode }
	}

	test('{name} lowers identically to name={name} in both halves', () => {
		const shorthand = compile('{name}')
		const longhand = compile('name={name}')
		expect(shorthand.server).toBe(longhand.server)
		expect(shorthand.client).toBe(longhand.client)
	})
})

describe('collapseJsxText', () => {
	test('strips indentation around newlines', () => {
		expect(collapseJsxText('\n\t\t\t\t\t💐 ')).toBe('💐 ')
	})
	test('collapses interior newline runs to one space', () => {
		expect(collapseJsxText('a\n\t\tb')).toBe('a b')
	})
	test('drops pure whitespace containing a newline', () => {
		expect(collapseJsxText('\n\t\t\t')).toBe('')
	})
	test('keeps single-line text untouched', () => {
		expect(collapseJsxText('Add')).toBe('Add')
	})
})

describe('freeIdentifiers', () => {
	test('signal reads are free, .get is not a name', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				const selected = createCell('a')
				const open = createCell(false)
				expose({ selected: selected.get })
				<>
					<c-el hidden={() => !open.get() && selected.get() === 'a'}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const hidden = component?.root.attrs.find(a => a.kind === 'reactive')
		if (hidden?.kind !== 'reactive') throw new Error('expected reactive attr')
		const free = freeIdentifiers(hidden.thunk)
		expect([...free].sort()).toEqual(['open', 'selected'])
	})

	test('handler-local declarations are bound, not free', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				const selected = createCell('x')
				expose({ selected: selected.get })
				<>
					<c-el onClick={(e: Event) => {
						const local = e.target
						selected.set(String(local))
					}}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const onClick = component?.root.attrs.find(a => a.kind === 'event')
		if (onClick?.kind !== 'event') throw new Error('expected event attr')
		const free = freeIdentifiers(onClick.handler)
		// `String` is a JS global — freeIdentifiers reports it raw; global
		// filtering is the analyzer's dependency-provability concern.
		expect([...free].sort()).toEqual(['String', 'selected'])
	})
})

describe('template classification', () => {
	test('static, server, reactive, and event attributes classify', () => {
		const { component, diagnostics } = compileSource(
			`export function C({ label }: { label?: string })
			@{
				const state = createCell(1)
				expose({ state: state.get })
				<>
					<c-el
						type="button"
						aria-label={label}
						hidden={() => state.get() > 0}
						onClick={() => state.set(0)}
					>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		expect(diagnostics).toEqual([])
		expect(component?.root.tag).toBe('c-el')
		expect(component?.root.attrs.map(a => a.kind)).toEqual([
			'static',
			'server',
			'reactive',
			'event',
		])
	})

	test('ref attribute classifies as ref', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el><input ref={box} /></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const input = firstElementChild(component?.root)
		expect(input?.attrs).toEqual([{ kind: 'ref', name: 'box' }])
	})

	test('lazy child detected via & sigil', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				const n = createCell(1)
				expose({ n: n.get })
				<>
					<c-el><span>&{n}</span></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const span = firstElementChild(component?.root)
		const expr = span?.children.find(c => c.kind === 'expr')
		expect(expr).toMatchObject({ lazy: true, exprText: 'n' })
	})

	test('non-lazy child expression is not lazy', () => {
		const { component } = compileSource(
			`export function C({ label }: { label?: string })
			@{
				expose({})
				<>
					<c-el><span>{label}</span></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const span = firstElementChild(component?.root)
		const expr = span?.children.find(c => c.kind === 'expr')
		expect(expr).toMatchObject({ lazy: false })
	})

	test('@for over server data collects hoisted consts', () => {
		const { component, diagnostics } = compileSource(
			`export function C({ tabs }: { tabs: { id: string }[] })
			@{
				const selected = createCell('a')
				expose({ selected: selected.get })
				<>
					<c-el>
						@for (const tab of tabs; index i) {
							const pid = tab.id
							<button aria-selected={() => String(selected.get() === pid)} onClick={() => selected.set(pid)}>{tab.id}</button>
						}
					</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		expect(diagnostics).toEqual([])
		expect(component?.fors.size).toBe(1)
		const loop = [...(component?.fors.values() ?? [])][0]
		expect(loop?.itemName).toBe('tab')
		expect(loop?.indexName).toBe('i')
		expect(loop?.hoisted.map(h => h.name)).toEqual(['pid'])
	})
})

describe('extension activation — export const config (sub-design 8)', () => {
	const configSource = (config: string): string =>
		`export const config = ${config}
export function C({ value = '' }: { value?: string })
@{
	expose({ value: asString('') })
	<>
		<c-el value={value}><input value={() => host.value} /></c-el>
		<style>c-el { color: red }</style>
	</>
}`

	test('formAssociated + observedAttributes parse into ConfigIR', () => {
		const { component, diagnostics } = compileSource(
			configSource(`{ formAssociated: true, observedAttributes: ['value'] }`),
			'c.tsrx',
		)
		expect(diagnostics).toEqual([])
		expect(component?.config).toEqual({
			form: 'value',
			observedAttributes: ['value'],
		})
	})

	test('formAssociatedCheckbox selects the checked variant', () => {
		const { component, diagnostics } = compileSource(
			configSource(`{ formAssociatedCheckbox: true }`),
			'c.tsrx',
		)
		expect(diagnostics).toEqual([])
		expect(component?.config?.form).toBe('checked')
	})

	test('Parser-expose props collect factory and fallback; defineMethod marks ambients', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({
					value: asString('x'),
					count: asInteger(0),
					clear: defineMethod(() => {}),
				})
				<>
					<c-el><span>ok</span></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		expect(component?.parserExposeProps.get('value')).toEqual({
			parser: 'asString',
			fallbackText: "'x'",
		})
		expect(component?.parserExposeProps.get('count')).toEqual({
			parser: 'asInteger',
			fallbackText: '0',
		})
		expect(component?.parserExposeProps.has('clear')).toBe(false)
		expect(component?.exposeAmbients).toEqual([
			'asInteger',
			'asString',
			'defineMethod',
		])
	})

	test('host/internals references inside expose initializers collect as context refs', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({
					value: asString(''),
					clear: defineMethod(() => {
						host.value = ''
						internals?.states.add('on')
					}),
				})
				<>
					<c-el><span>ok</span></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		expect(component?.contextRefs).toEqual(['host', 'internals'])
	})

	test('managed lazy child requires form config to be more than text', () => {
		// Without config.form, `&{'validationMessage'}` is an ordinary
		// string-literal child — the managed-prop lowering never applies.
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el><p>&{'validationMessage'}</p></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		expect(component?.config).toBeNull()
		const p = firstElementChild(component?.root)
		const expr = p?.children.find(c => c.kind === 'expr')
		expect(expr).toMatchObject({ lazy: true, exprText: "'validationMessage'" })
	})
})
