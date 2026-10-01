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
	forEachChild,
	forEachFreeIdentifier,
	identifierName,
	isNode,
	walkNodes,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import type { ExtractContext } from './extract-context'
import type { LeTrucImport } from './imports'
import { malformedSelectorReason } from './selector-syntax'
import {
	COLLECTOR_HELPERS,
	CONTEXT_NAMES,
	FACTORY_CONTEXT_MEMBERS,
	REAL_EXPORT_NAMES,
} from './vocabulary'

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
	// Type positions are skipped: they hold no call expressions.
	walkNodes(ast, node => {
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
	})
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
		// `each(collection, item => …)` runs its callback inside a collector
		// of its own (`withCollector`, src/helpers/reactive.ts), so a helper
		// called directly in that callback is registered, not deferred
		// (LT-108, module-carousel's per-slide `watch`). Its body keeps the
		// caller's depth; a function nested inside it is still deferred.
		if (
			node.type === 'CallExpression' &&
			identifierName(node.callee) === 'each'
		) {
			const [collection, callback, ...rest] = Array.isArray(node.arguments)
				? node.arguments
				: []
			visit(node.callee, depth)
			visit(collection, depth)
			if (isNode(callback) && FUNCTION_TYPES.has(String(callback.type))) {
				visit(callback.params, depth + 1)
				visit(callback.body, depth)
			} else visit(callback, depth)
			visit(rest, depth)
			return
		}
		// Type positions are skipped: they hold no call expressions.
		const nextDepth = FUNCTION_TYPES.has(String(node.type)) ? depth + 1 : depth
		forEachChild(node, child => visit(child, nextDepth))
	}
	visit(fn.body, 0)
}

/**
 * Validate authored `'@zeix/le-truc'` imports against real usage (ADR 0024
 * sub-design 16, LT-082), on the same scope walk as `freeIdentifiers`
 * (`forEachFreeIdentifier`): params, declarator, loop and catch bindings,
 * function-declaration names, non-computed property keys and member
 * properties never count as reads — a local `const createCell = …`
 * shadowing the export must not fire. Two checks:
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
 * walk's `JSXCodeBlock` case (setup statements, then the template in its
 * `render` slot) is inert for `.tsx` sources, which never produce one.
 */
export const reportLeTrucImportMismatch = (
	ctx: ExtractContext,
	ast: AstNode,
	leTrucImports: LeTrucImport[],
): void => {
	const usage = new Map<string, number>()
	// Type positions are walked: an unimported name in one (`typeof
	// createState`, an error class as an annotation) is missing its import
	// exactly as a value read is.
	forEachFreeIdentifier(
		ast,
		node => {
			const name = String(node.name)
			if (REAL_EXPORT_NAMES.has(name) && !usage.has(name))
				usage.set(name, typeof node.start === 'number' ? node.start : 0)
		},
		'descend',
	)

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
