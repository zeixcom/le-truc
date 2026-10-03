/**
 * Unit tests for the one structural `TemplateNode` visitor (LT-042,
 * walk.ts): visit order over every node kind, parent pairing, the one
 * traversal rule that varies by consumer (`intoCompose`), and the
 * always-enter `@pending` policy (LT-230).
 * The tree is hand-built IR — no compiler front end needed, which is the
 * point of extracting the visitor.
 */
import { describe, expect, test } from 'bun:test'
import type { AstNode } from '../../compiler/ast-node'
import type { TemplateNode } from '../../compiler/ir'
import { NO_DEPS } from '../../compiler/reactivity'
import {
	childNodes,
	collectAttrs,
	someNode,
	walkTemplate,
} from '../../compiler/walk'

const n = (type: string): AstNode => ({ type }) as AstNode

/** A tree exercising every TemplateNode kind:
 *  root(el) → [ text, expr, if(then: el(a), else: client-stmt),
 *               switch(2 arms: el(b), text), try(body: el(c), catch: compose
 *               → el(d), pending: el(e)) ] */
const tree: TemplateNode & { kind: 'element' } = {
	kind: 'element',
	tag: 'x-root',
	attrs: [
		{ kind: 'static', name: 'role', value: 'list' },
		{
			kind: 'event',
			name: '@click',
			event: 'click',
			handler: n('Arrow'),
			handlerText: '() => {}',
		},
	],
	children: [
		{ kind: 'text', value: 'hello' },
		{
			kind: 'expr',
			expr: n('Identifier'),
			exprText: 'count',
			reactivity: 'reactive',
			deps: NO_DEPS,
			node: n('Expr'),
		},
		{
			kind: 'conditional',
			construct: 'if',
			mode: 'server',
			testText: 'ok',
			test: n('Identifier'),
			arms: [
				{
					key: 'then',
					test: null,
					testText: null,
					children: [
						{
							kind: 'element',
							tag: 'a',
							attrs: [{ kind: 'static', name: 'id', value: 'one' }],
							children: [],
							node: n('JSXElement'),
						},
					],
				},
				{
					key: 'else',
					test: null,
					testText: null,
					children: [
						{
							kind: 'client-stmt',
							text: 'host.foo()',
							node: n('ExpressionStatement'),
						},
					],
				},
			],
			initial: { fold: true },
			node: n('If'),
		},
		{
			kind: 'conditional',
			construct: 'switch',
			mode: 'server',
			testText: 'state',
			test: n('Identifier'),
			initial: { fold: true },
			arms: [
				{
					key: 'case:on',
					testText: "'on'",
					test: n('Literal'),
					children: [
						{
							kind: 'element',
							tag: 'b',
							attrs: [],
							children: [],
							node: n('JSXElement'),
						},
					],
				},
				{
					key: 'default',
					testText: null,
					test: null,
					children: [{ kind: 'text', value: 'off' }],
				},
			],
			node: n('Switch'),
		},
		{
			kind: 'try',
			children: [
				{
					kind: 'element',
					tag: 'c',
					attrs: [],
					children: [],
					node: n('JSXElement'),
				},
			],
			catchParam: 'e',
			catchChildren: [
				{
					kind: 'compose',
					component: 'Child',
					source: './child.tsrx',
					attrs: [],
					children: [
						{
							kind: 'element',
							tag: 'd',
							attrs: [{ kind: 'static', name: 'id', value: 'deep' }],
							children: [],
							node: n('JSXElement'),
						},
					],
					node: n('JSXElement'),
				},
			],
			pendingChildren: [
				{
					kind: 'element',
					tag: 'e',
					attrs: [{ kind: 'static', name: 'data-pending', value: '1' }],
					children: [],
					node: n('JSXElement'),
				},
			],
			node: n('Try'),
		},
	],
	node: n('JSXElement'),
}

describe('childNodes', () => {
	test('element/compose children, if branches, switch arms, try arms (pending last)', () => {
		expect(childNodes(tree).length).toBe(5)
		const ifNode = tree.children[2] as Extract<
			TemplateNode,
			{ kind: 'conditional' }
		>
		expect(childNodes(ifNode).length).toBe(2)
		const tryNode = tree.children[4] as Extract<TemplateNode, { kind: 'try' }>
		expect(
			childNodes(tryNode).map(c => (c.kind === 'element' ? c.tag : c.kind)),
		).toEqual(['c', 'compose', 'e'])
		const plainTry: Extract<TemplateNode, { kind: 'try' }> = {
			...tryNode,
			pendingChildren: null,
		}
		expect(
			childNodes(plainTry).map(c => (c.kind === 'element' ? c.tag : c.kind)),
		).toEqual(['c', 'compose'])
	})
})

describe('walkTemplate', () => {
	test('default options visit every node of every kind, pre-order, with parents', () => {
		const seen: Array<[string, string | null]> = []
		walkTemplate(tree, (node, parent) => {
			const label =
				node.kind === 'element'
					? `el:${node.tag}`
					: node.kind === 'compose'
						? 'compose'
						: node.kind
			const parentLabel =
				parent?.kind === 'element' ? `el:${parent.tag}` : (parent?.kind ?? null)
			seen.push([label, parentLabel])
		})
		expect(seen.map(([l]) => l)).toEqual([
			'el:x-root',
			'text',
			'expr',
			'conditional',
			'el:a',
			'client-stmt',
			'conditional',
			'el:b',
			'text',
			'try',
			'el:c',
			'compose',
			'el:d',
			'el:e',
		])
		// parent pairing: the pending-arm element's parent is the try node
		const pending = seen.find(([l]) => l === 'el:e')
		expect(pending?.[1]).toBe('try')
	})

	test('intoCompose: false visits the compose node but not its children', () => {
		const labels: string[] = []
		walkTemplate(
			tree,
			node => {
				labels.push(node.kind === 'element' ? `el:${node.tag}` : node.kind)
			},
			{ intoCompose: false },
		)
		expect(labels).toEqual([
			'el:x-root',
			'text',
			'expr',
			'conditional',
			'el:a',
			'client-stmt',
			'conditional',
			'el:b',
			'text',
			'try',
			'el:c',
			'compose',
			'el:e',
		])
	})
})

describe('collectAttrs', () => {
	const nameOf = (a: ReturnType<typeof collectAttrs>[number]): string =>
		'name' in a ? a.name : a.kind

	test('collects element attrs across control flow, compose children, and pending arms', () => {
		expect(collectAttrs(tree).map(nameOf)).toEqual([
			'role',
			'@click',
			'id',
			'id',
			'data-pending',
		])
	})

	test('intoCompose: false keeps compose attrs out of reach below the boundary', () => {
		expect(collectAttrs(tree, { intoCompose: false }).map(nameOf)).toEqual([
			'role',
			'@click',
			'id',
			'data-pending',
		])
	})
})

describe('someNode', () => {
	test('enters @pending arms (LT-230 policy) and stops at the first hit', () => {
		const seen: string[] = []
		const hit = someNode(tree, node => {
			if (node.kind === 'element') seen.push(node.tag)
			return node.kind === 'element' && node.tag === 'e'
		})
		expect(hit).toBe(true)
		expect(seen.at(-1)).toBe('e')
	})

	test('intoCompose: false tests the compose node but not its children', () => {
		const seen: string[] = []
		someNode(
			tree,
			node => {
				seen.push(node.kind === 'element' ? `el:${node.tag}` : node.kind)
				return false
			},
			{ intoCompose: false },
		)
		expect(seen).toContain('compose')
		expect(seen).not.toContain('el:d')
	})
})
