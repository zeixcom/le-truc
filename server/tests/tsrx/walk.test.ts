/**
 * Unit tests for the one structural `TemplateNode` visitor (LT-042,
 * walk.ts): visit order over every node kind, parent pairing, and the two
 * traversal rules that vary by consumer (`intoPending`, `intoCompose`).
 * The tree is hand-built IR — no compiler front end needed, which is the
 * point of extracting the visitor.
 */
import { describe, expect, test } from 'bun:test'
import type { TsrxNode } from '@tsrx/core'
import type { TemplateNode } from '../../tsrx/ir'
import { childNodes, collectAttrs, walkTemplate } from '../../tsrx/walk'

const n = (type: string): TsrxNode => ({ type }) as TsrxNode

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
			lazy: true,
			node: n('Expr'),
		},
		{
			kind: 'if',
			testText: 'ok',
			test: n('Identifier'),
			then: [
				{
					kind: 'element',
					tag: 'a',
					attrs: [{ kind: 'static', name: 'id', value: 'one' }],
					children: [],
					node: n('JSXElement'),
				},
			],
			alternate: [
				{
					kind: 'client-stmt',
					text: 'host.foo()',
					node: n('ExpressionStatement'),
				},
			],
			node: n('If'),
		},
		{
			kind: 'switch',
			discriminantText: 'state',
			discriminant: n('Identifier'),
			cases: [
				{
					testText: "'on'",
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
				{ testText: null, children: [{ kind: 'text', value: 'off' }] },
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
		const ifNode = tree.children[2] as Extract<TemplateNode, { kind: 'if' }>
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
			'if',
			'el:a',
			'client-stmt',
			'switch',
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

	test('intoPending: false skips @pending arms but keeps body and catch', () => {
		const tags: string[] = []
		walkTemplate(
			tree,
			node => {
				if (node.kind === 'element') tags.push(node.tag)
			},
			{ intoPending: false },
		)
		expect(tags).toEqual(['x-root', 'a', 'b', 'c', 'd'])
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
			'if',
			'el:a',
			'client-stmt',
			'switch',
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

	test('intoPending: false drops pending-arm attrs', () => {
		expect(collectAttrs(tree, { intoPending: false }).map(nameOf)).toEqual([
			'role',
			'@click',
			'id',
			'id',
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
