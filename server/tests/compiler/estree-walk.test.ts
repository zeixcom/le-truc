/**
 * The shared estree child enumeration (LT-229): `forEachChild`/`walkNodes`
 * take their child keys from `eslint-visitor-keys`, fall back to every
 * non-bookkeeping key for node types it doesn't know (TS nodes, TSRX
 * directives, CSS), and follow one explicit type-position policy.
 *
 * The convergence block pins the sites whose answer changed when they moved
 * onto the walk's `'skip'` default: each used to descend into type
 * positions, so a name in an annotation counted as a runtime read.
 */
import { describe, expect, test } from 'bun:test'
import type { AstNode } from '../../compiler/ast-node'
import {
	forEachChild,
	type TypePositions,
	walkNodes,
} from '../../compiler/ast-utils'
import { parseModule } from '../../compiler/core.ts'
import { impureAmbientCauses } from '../../compiler/evaluability'
import { classifyChild } from '../../compiler/reactivity'
import { stubbedApiRead } from '../../compiler/tier.ts'

/* === Helpers === */

/** Parse a bare expression and return its node. */
const expr = (code: string): AstNode => {
	const program = parseModule(
		`const _ = (${code})`,
		'expr.ts',
	) as unknown as AstNode
	const [decl] = program.body as [AstNode]
	const [declarator] = decl.declarations as [AstNode]
	return declarator.init as AstNode
}

/** Identifier names reached under a policy, in walk order. */
const names = (node: AstNode, types?: TypePositions): string[] => {
	const out: string[] = []
	walkNodes(
		node,
		current => {
			if (current.type === 'Identifier') out.push(String(current.name))
		},
		types,
	)
	return out
}

/* === Tests === */

describe('forEachChild — the key policy', () => {
	test('type positions are skipped by default', () => {
		expect(names(expr('(d: Date): Foo => d as Bar<Baz>'))).toEqual(['d', 'd'])
	})

	test("'descend' walks annotations, return types and type arguments", () => {
		expect(names(expr('(d: Date): Foo => d as Bar<Baz>'), 'descend')).toEqual(
			expect.arrayContaining(['d', 'Date', 'Foo', 'Bar', 'Baz']),
		)
	})

	test('children follow the parser key order', () => {
		expect(names(expr('a ? b : c'))).toEqual(['a', 'b', 'c'])
		expect(names(expr('f(x, ...y)'))).toEqual(['f', 'x', 'y'])
	})

	test('an unknown node type falls back to its non-bookkeeping keys', () => {
		const nonNull = expr('value!')
		expect(nonNull.type).toBe('TSNonNullExpression')
		const children: string[] = []
		forEachChild(nonNull, child => children.push(child.type))
		expect(children).toEqual(['Identifier'])
	})

	test('comments are not children', () => {
		const node = expr('{ /* lead */ a: 1 }')
		const types: string[] = []
		walkNodes(node, current => {
			types.push(current.type)
		})
		expect(types).not.toContain('Block')
	})

	test('returning false from walkNodes prunes the subtree', () => {
		const seen: string[] = []
		walkNodes(expr('f(g(x))'), current => {
			if (current.type === 'Identifier') seen.push(String(current.name))
			return !(
				current.type === 'CallExpression' &&
				(current.callee as AstNode).name === 'g'
			)
		})
		expect(seen).toEqual(['f'])
	})
})

describe("sites converged onto 'skip' — a type position is not a read", () => {
	test('classifyChild: a signal named in a type query neither reads nor escapes', () => {
		const verdict = classifyChild(
			expr('label as unknown as typeof count'),
			new Set(['count']),
		)
		expect(verdict).toEqual({ kind: 'server' })
	})

	test('impureAmbientCauses: a Date or Intl annotation is not an ambient read', () => {
		expect(impureAmbientCauses(expr('(d: Date) => d.getTime()'))).toEqual([])
		expect(
			impureAmbientCauses(expr('(f: Intl.NumberFormat) => f.format(1)')),
		).toEqual([])
		// The value read still flags.
		expect(impureAmbientCauses(expr('(d: Date) => Date.now()'))).toEqual([
			'date',
		])
	})

	test('stubbedApiRead: an observer type annotation is not a stubbed read', () => {
		expect(
			stubbedApiRead(expr('(ro: ResizeObserver) => ro.disconnect()')),
		).toBeNull()
		expect(stubbedApiRead(expr('new ResizeObserver(() => {})'))).toContain(
			'ResizeObserver',
		)
	})
})
