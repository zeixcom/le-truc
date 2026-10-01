/**
 * The `.tsx` front end's parser: authored source → estree-shaped `AstNode`.
 *
 * Everything downstream of the front end — `ast-utils.ts` walks,
 * `reactivity.ts`, `evaluability.ts`, `analysis/*`, both emitters, `sim/` —
 * consumes the estree-shaped loose `AstNode` structural type declared by
 * `server/compiler/ast-node.ts` (`{ type: string; start?; end?; … }`), with
 * `start`/`end` brackets that slice the authored source verbatim
 * (`ast-utils.ts`'s `text()`).
 *
 * The TypeScript → ESTree conversion itself is
 * `@typescript-eslint/typescript-estree`'s (LT-243), maintained against
 * every `typescript` major — the hand-written converter this module used to
 * be had to track that drift itself (ADR 0032's stated cost). What remains
 * here is a thin normalization pass onto the shape the shared stages were
 * written against, which is also the shape `@tsrx/core` gives `.tsrx`:
 *
 * - `range` becomes `start`/`end`; `loc`/`range`/`parent` are dropped.
 * - A `ChainExpression` is unwrapped onto its expression, and an optional
 *   call (`f?.()`) is typed `OptionalCallExpression` — member optionality
 *   stays on `MemberExpression.optional`.
 * - A `{/* comment *\/}` container's `JSXEmptyExpression` becomes `null`.
 * - JSX text and JSX attribute strings keep their source characters:
 *   typescript-estree decodes HTML entities into `value`, but the lowering
 *   collapses the raw text and the emitters write attribute values as
 *   authored.
 * - A template element's `raw` is its cooked text, as before.
 * - An exported declaration's span starts at the `export` keyword, like the
 *   wrapper's.
 *
 * Type positions arrive fully converted; the shared walks skip them by key
 * (`ast-utils.ts`'s `TYPE_POSITION_KEYS`), so a type name is never a value
 * read. A function parameter's annotation rides its pattern as
 * `typeAnnotation`, with the pattern's span extended over it — the shape the
 * shared stages read for arg types (LT-298).
 *
 * **Supported `typescript` range:** the pinned typescript-estree (8.71.0)
 * declares `typescript >=4.8.4 <6.1.0` as its peer; the repo pins
 * `typescript ^6.0.3`. A `typescript` bump past 6.0.x needs a
 * typescript-estree release that covers it — check its peer range first.
 * The package requires `node:path`/`node:fs` at load; that is a dependency
 * fact, outside the compiler's own neutrality rule (ADR 0038 s2).
 */

import { astConverter } from '@typescript-eslint/typescript-estree/use-at-your-own-risk'
import * as ts from 'typescript'
import type { AstNode } from '../../ast-node'

export type { AstNode }

type RawNode = {
	type: string
	range?: [number, number]
	[key: string]: unknown
}

const isRawNode = (value: unknown): value is RawNode =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as { type?: unknown }).type === 'string'

/** Keys typescript-estree adds that carry no shape the stages read. */
const DROPPED_KEYS: ReadonlySet<string> = new Set(['range', 'loc', 'parent'])

/** A JSX string's characters as authored, quotes stripped. */
const authoredString = (raw: unknown): string | undefined =>
	typeof raw === 'string' ? raw.slice(1, -1) : undefined

const normalizeValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(normalizeValue)
	if (isRawNode(value)) return normalize(value)
	return value
}

/** One typescript-estree node → the stages' `AstNode` shape. */
const normalize = (node: RawNode): AstNode | null => {
	if (node.type === 'ChainExpression')
		return normalize(node.expression as RawNode)
	if (node.type === 'JSXEmptyExpression') return null
	const out: AstNode = { type: node.type }
	if (node.range) {
		out.start = node.range[0]
		out.end = node.range[1]
	}
	for (const [key, value] of Object.entries(node)) {
		if (key === 'type' || DROPPED_KEYS.has(key)) continue
		out[key] = normalizeValue(value)
	}
	switch (node.type) {
		case 'CallExpression':
			if (node.optional) out.type = 'OptionalCallExpression'
			break
		case 'JSXText':
			out.value = node.raw
			break
		case 'JSXAttribute': {
			const value = out.value as AstNode | null
			if (value?.type === 'Literal') value.value = authoredString(value.raw)
			break
		}
		case 'TemplateElement': {
			const value = node.value as { raw: string; cooked: string | null }
			out.value = { raw: value.cooked ?? value.raw, cooked: value.cooked }
			break
		}
		case 'ExportNamedDeclaration': {
			const declaration = out.declaration as AstNode | null
			if (declaration && out.start !== undefined) declaration.start = out.start
			break
		}
	}
	return out
}

/**
 * Parse a `.tsx` module into an estree-shaped `Program` — the same entry
 * shape `@tsrx/core`'s `parseModule` produces for `.tsrx`: `body` holds the
 * top-level statements, with exported declarations wrapped in
 * `ExportNamedDeclaration` (`declaration` = the inner statement, whose own
 * span starts at the `export` keyword — consumers slice the WRAPPER for
 * verbatim text and read only names/kinds from the inner).
 */
export const parseTsxModule = (source: string, filename: string): AstNode => {
	const sourceFile = ts.createSourceFile(
		filename,
		source,
		ts.ScriptTarget.ESNext,
		true,
		ts.ScriptKind.TSX,
	)
	// Throws on the first TypeScript parse diagnostic (`compileSourceTsx`
	// reports it as LTC008).
	const { estree } = astConverter(
		sourceFile,
		{
			allowInvalidAST: false,
			errorOnUnknownASTType: false,
			suppressDeprecatedPropertyWarnings: true,
			range: true,
			loc: false,
			tokens: false,
			comment: false,
		} as unknown as Parameters<typeof astConverter>[1],
		false,
	)
	return {
		...(normalize(estree as unknown as RawNode) as AstNode),
		start: 0,
		end: source.length,
	}
}
