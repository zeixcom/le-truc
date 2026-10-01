/**
 * `ir.ts` is a pure-data leaf (LT-244): type-only imports of the loose
 * `AstNode` and other data leaves, and no function-bearing type anywhere —
 * the front end's mutable `ExtractContext` lives in `extract-context.ts`.
 * A `ComponentIR` therefore stays a serializable data structure.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { parse } from '@typescript-eslint/typescript-estree'
import type { AstNode } from '../../compiler/ast-node'
import { walkNodes } from '../../compiler/ast-utils'

const IR_PATH = path.resolve(import.meta.dir, '../../compiler/ir.ts')

/** The leaves `ir.ts` may import types from. */
const ALLOWED_IMPORTS: ReadonlySet<string> = new Set([
	'./ast-node',
	'./icu/parse',
	'./surface',
])

const FUNCTION_TYPE_NODES: ReadonlySet<string> = new Set([
	'TSFunctionType',
	'TSMethodSignature',
	'TSConstructorType',
	'TSCallSignatureDeclaration',
])

const ast = parse(readFileSync(IR_PATH, 'utf8'), {
	range: true,
}) as unknown as AstNode

describe('ir.ts leaf (LT-244)', () => {
	test('imports only types, only from data leaves', () => {
		const imports = (ast.body as AstNode[]).filter(
			n => n.type === 'ImportDeclaration',
		)
		for (const decl of imports) {
			expect(decl.importKind).toBe('type')
			expect(ALLOWED_IMPORTS).toContain(
				(decl.source as AstNode).value as string,
			)
		}
	})

	test('declares no function-bearing type and no ExtractContext', () => {
		const found: string[] = []
		walkNodes(
			ast,
			node => {
				if (FUNCTION_TYPE_NODES.has(node.type)) found.push(node.type)
				if (
					node.type === 'TSTypeAliasDeclaration' &&
					(node.id as AstNode).name === 'ExtractContext'
				)
					found.push('ExtractContext')
			},
			'descend',
		)
		expect(found).toEqual([])
	})
})
