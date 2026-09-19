/**
 * Whole-module verbatim scans shared by both front ends (LT-202, ADR 0032
 * sub-design 6: the anti-drift half of the dual front-end contract) —
 * malformed `first()`/`all()` selectors (LTC026), collector-requiring
 * helpers deferred into nested functions (LTC045), and authored
 * `'@zeix/le-truc'` import mismatches (LTC036/037). Front-end-neutral like
 * the other front-end stage modules: no parser values, only the loose
 * `AstNode` structural type. The walks are estree-generic, so they run
 * unchanged over either surface's AST.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	COLLECTOR_HELPERS,
	CONTEXT_NAMES,
	collectBoundNames,
	FACTORY_CONTEXT_MEMBERS,
	identifierName,
	isNode,
	REAL_EXPORT_NAMES,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import type { LeTrucImport } from './imports'
import type { ExtractContext } from './ir'
import { malformedSelectorReason } from './selector-syntax'

/**
 * Report every malformed `first()`/`all()` selector in the module (LTC026,
 * LT-157b, ADR 0028 sub-design 5). Scanning the whole AST rather than just
 * setup is what makes this worth having: `all()` is legitimately called from
 * inside an event handler or a `defineMethod()` body (form-listbox does
 * both), and those calls never pass through the setup extraction below.
 *
 * Only a selector this compiler can prove no CSS parser accepts is reported
 * — see `selector-syntax.ts` on why the check is deliberately one-sided.
 * The walk is estree-generic, so it runs unchanged over both front ends'
 * ASTs.
 */
export const reportMalformedSelectors = (
	ctx: ExtractContext,
	ast: AstNode,
): void => {
	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child)
			return
		}
		if (!isNode(node)) return
		if (node.type === 'CallExpression') {
			const helper = identifierName(node.callee)
			if (helper === 'first' || helper === 'all') {
				const arg = asArray(node.arguments)[0]
				if (
					isNode(arg) &&
					arg.type === 'Literal' &&
					typeof arg.value === 'string'
				) {
					const reason = malformedSelectorReason(arg.value)
					if (reason)
						ctx.diagnostics.push(
							diagnostic.malformedSelector(
								ctx.source,
								arg.start,
								helper,
								arg.value,
								reason,
							),
						)
				}
			}
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			visit(value)
		}
	}
	visit(ast)
}

/**
 * Report every collector-requiring helper called from inside a nested
 * function in the component body (LTC045, LT-157d, ADR 0028 sub-design 5).
 *
 * `watch`/`on`/`pass`/`provideContexts` do not create their effect where
 * they are called — they push a descriptor into the ambient collector, which
 * exists only for the duration of the factory call (ADR 0018). Deferring one
 * into a callback therefore throws `NoActiveCollectorError` at connect, and
 * since LT-155 that throw is contained: the effect silently never activates.
 * The compiler never emits this shape, so the rule is entirely about
 * hand-authored setup statements.
 *
 * The walk starts INSIDE the component function, so its own body is depth 0
 * and only genuinely nested functions count.
 */
export const reportDeferredCollectorCalls = (
	ctx: ExtractContext,
	fn: AstNode,
): void => {
	const FUNCTION_TYPES = new Set([
		'FunctionDeclaration',
		'FunctionExpression',
		'ArrowFunctionExpression',
	])
	const visit = (node: unknown, depth: number): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child, depth)
			return
		}
		if (!isNode(node)) return
		if (depth > 0 && node.type === 'CallExpression') {
			// `identifierName` returns null for a member callee, so
			// `list.pass(…)` on some unrelated object never matches.
			const helper = identifierName(node.callee)
			if (helper && COLLECTOR_HELPERS.has(helper))
				ctx.diagnostics.push(
					diagnostic.deferredCollectorCall(ctx.source, node.start, helper),
				)
		}
		const nextDepth = FUNCTION_TYPES.has(String(node.type)) ? depth + 1 : depth
		for (const [key, value] of Object.entries(node)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			visit(value, nextDepth)
		}
	}
	visit(fn.body, 0)
}

/**
 * Validate authored `'@zeix/le-truc'` imports against real usage (ADR 0024
 * sub-design 16, LT-082), scope-aware the same way `freeIdentifiers` is:
 * params, declarator bindings, function-declaration names, non-computed
 * property keys and member properties never count as reads — a local
 * `const createCell = …` shadowing the export must not fire. Two checks:
 *
 * - LTC036: a `REAL_EXPORT_NAMES` identifier is read somewhere in the
 *   module but not imported from `'@zeix/le-truc'` — the first read
 *   position is reported.
 * - LTC037: a FactoryContext member (`FACTORY_CONTEXT_MEMBERS` ∪
 *   `CONTEXT_NAMES`) is named in an authored `'@zeix/le-truc'` import —
 *   not a package export; the line is a false declaration.
 *
 * `ImportDeclaration` nodes are skipped entirely — an import specifier
 * introduces a name, it is not a read of it. Shared by both front ends: the
 * `.tsrx` profile's `JSXCodeBlock` scope case is inert for `.tsx` sources
 * (no such node is ever produced), so the superset walk serves both.
 */
export const reportLeTrucImportMismatch = (
	ctx: ExtractContext,
	ast: AstNode,
	leTrucImports: LeTrucImport[],
): void => {
	const usage = new Map<string, number>()
	const visit = (node: unknown, bound: ReadonlySet<string>): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child, bound)
			return
		}
		if (!isNode(node)) return
		switch (node.type) {
			case 'ImportDeclaration':
				return
			case 'Identifier': {
				const name = String(node.name)
				if (!bound.has(name) && REAL_EXPORT_NAMES.has(name) && !usage.has(name))
					usage.set(name, typeof node.start === 'number' ? node.start : 0)
				return
			}
			case 'MemberExpression':
				visit(node.object, bound)
				if (node.computed) visit(node.property, bound)
				return
			case 'Property':
				if (node.computed) visit(node.key, bound)
				visit(node.value, bound)
				return
			case 'ArrowFunctionExpression':
			case 'FunctionExpression': {
				const inner = new Set(bound)
				const paramNames = new Set<string>()
				for (const param of asArray(node.params))
					collectBoundNames(param, paramNames)
				for (const n of paramNames) inner.add(n)
				visit(node.body, inner)
				return
			}
			case 'FunctionDeclaration': {
				const inner = new Set(bound)
				const paramNames = new Set<string>()
				for (const param of asArray(node.params))
					collectBoundNames(param, paramNames)
				for (const n of paramNames) inner.add(n)
				const id = identifierName(node.id)
				if (id) inner.add(id)
				visit(node.body, inner)
				return
			}
			case 'VariableDeclarator': {
				visit(node.init, bound)
				const declared = new Set<string>()
				collectBoundNames(node.id, declared)
				visit(node.id, new Set([...bound, ...declared]))
				return
			}
			case 'BlockStatement':
			case 'Program':
			case 'JSXCodeBlock': {
				// Statements execute in order: a declaration adds its names to
				// scope for every statement that follows it (same sequential
				// rule as `freeIdentifiers`). The `@{ }` setup container is a
				// JSXCodeBlock node holding plain statements — without it in
				// this group, a top-level `const match = …` inside `@{ }`
				// would not bind `match` for later statements.
				const inner = new Set(bound)
				for (const stmt of asArray(node.body)) {
					if (stmt.type === 'VariableDeclaration') {
						for (const decl of asArray(stmt.declarations))
							visit(decl.init, inner)
						const declared = new Set<string>()
						for (const decl of asArray(stmt.declarations))
							collectBoundNames(decl.id, declared)
						for (const name of declared) inner.add(name)
					} else {
						visit(stmt, inner)
						if (stmt.type === 'FunctionDeclaration') {
							const id = identifierName(stmt.id)
							if (id) inner.add(id)
						}
					}
				}
				return
			}
			default:
				for (const [key, value] of Object.entries(node)) {
					if (key === 'loc' || key === 'range' || key === 'parent') continue
					visit(value, bound)
				}
		}
	}
	visit(ast, new Set())

	const imported = new Map<string, number>()
	for (const imp of leTrucImports)
		for (const name of imp.names)
			if (!imported.has(name)) imported.set(name, imp.start)
	const contextVocabulary = new Set<string>([
		...FACTORY_CONTEXT_MEMBERS,
		...CONTEXT_NAMES,
	])
	for (const [name, offset] of usage)
		if (!imported.has(name))
			ctx.diagnostics.push(
				diagnostic.missingRealExportImport(ctx.source, offset, name),
			)
	for (const [name, offset] of imported)
		if (contextVocabulary.has(name))
			ctx.diagnostics.push(
				diagnostic.contextNameInImport(ctx.source, offset, name),
			)
}
