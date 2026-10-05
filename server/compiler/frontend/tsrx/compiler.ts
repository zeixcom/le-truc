/**
 * TSRX compiler front end for `.tsrx` sources — the surface-specific half.
 * Everything downstream consumes the component IR produced here.
 * `@tsrx/core` VALUES enter through the `core.ts` pin adapter (pinned
 * 0.1.63, ADR 0024 sub-design 2; LT-040) — a pin upgrade touches only that
 * file and core-shim.d.ts — and the IR type vocabulary shared by the rest
 * of the compiler lives in `ir.ts` (LT-039).
 *
 * Owns the `.tsrx`-specific decisions only, as the `SurfaceAdapter` the
 * shared driver (`front-end.ts`, LT-233) runs: the component function's
 * body is an `@{ }` statement container whose statements are the setup and
 * whose trailing output is the template, `<style>` blocks arrive as
 * `JSXStyleElement` nodes, and the grammar's own scans (the React near-miss
 * family) run first. Parsing stays here because `@tsrx/core`'s failure
 * carries the position `newerGrammarHint` reads. Everything else — the
 * module scans, the params contract, setup extraction, output resolution,
 * the post-lowering tail and IR assembly — is the one shared script (ADR
 * 0032 sub-design 6's anti-drift contract); template lowering shares
 * `lower-shared.ts` under `lower-template.ts`'s directive dispatch, and
 * diagnostic wording comes from `surface.ts`.
 */

import type { AstNode } from '../../ast-node'
import {
	asArray,
	identifierName,
	isNode,
	text,
	walkNodes,
} from '../../ast-utils'
import { getStyleElementStylesheet, parseModule } from '../../core'
import { diagnostic, type Site } from '../../diagnostics'
import { DEFAULT_EMIT_PATHS, type EmitPaths } from '../../emit-paths'
import type { ExtractContext } from '../../extract-context'
import { createExtractContext } from '../../extract-context'
import {
	type CompileResult,
	runFrontEnd,
	type SurfaceAdapter,
} from '../../front-end'
import { lowerElement } from './lower-template'

/* === Types === */

export type { CompileResult } from '../../front-end'

/* === Internal Functions === */

/**
 * When a parse fails, check the error position for constructs the pinned
 * @tsrx/core cannot parse in that POSITION — a statement-form `switch`
 * inside a template. The hint turns a bare "Unexpected token" into an
 * actionable diagnosis.
 *
 * Four signatures were removed in LT-137: `{html …}`, `{text …}`, `{ref …}`
 * and `component` declarations. They named constructs that do not exist in
 * ANY published upstream release — verified against `@tsrx/core` 0.1.60 and
 * 0.1.63, `@tsrx/ripple`, and `ripple` (components are plain functions
 * upstream, `plugin.js`: "so components can be written as `function
 * Something()`"). The hints sent an author looking for a pin upgrade that
 * would not have helped, which is worse than the bare parse error they
 * replaced. Le Truc's own dynamic-rendering attribute is `truc:html={…}`
 * (LT-128); it is host-owned, not a polyfill for upstream vocabulary.
 *
 * The `await in setup` entry went the same way (LT-222): no pin upgrade
 * helps, because the component function must not be `async` at all
 * (LTC008) — `await` belongs in an event handler or a client-only setup
 * statement, which the live rejection already says.
 */
const newerGrammarHint = (source: string, error: unknown): string => {
	const pos =
		error &&
		typeof error === 'object' &&
		typeof (error as { pos?: unknown }).pos === 'number'
			? (error as { pos: number }).pos
			: undefined
	const around =
		pos !== undefined ? source.slice(Math.max(0, pos - 24), pos + 48) : ''
	const signatures: Array<[RegExp, string]> = [
		[/\bswitch\b/, 'a statement-form switch inside a template'],
	]
	for (const [pattern, what] of signatures)
		if (pattern.test(around))
			return ` — ${what} is not parseable by the pinned @tsrx/core 0.1.63 (pin upgrades are reviewed changes — see ADR 0024 sub-design 2)`
	return ''
}

/** Is `node` a JSX value (`<x/>` or `<>…</>`)? */
const isJsxNode = (node: unknown): boolean => {
	const t = isNode(node) ? String(node.type) : null
	return t === 'JSXElement' || t === 'JSXFragment'
}

/** Does an arrow/function body produce JSX, directly or via a `return`? */
const producesJsx = (body: unknown): boolean => {
	if (isJsxNode(body)) return true
	if (!isNode(body) || body.type !== 'BlockStatement') return false
	return asArray(body.body).some(
		stmt => stmt.type === 'ReturnStatement' && isJsxNode(stmt.argument),
	)
}

/**
 * Report React JSX idioms that TSRX renders literally instead of
 * conditionally or iteratively (LT-054): `{cond && <jsx/>}`, `{cond ? <a/> :
 * <b/>}`, and `.map()` producing JSX in child position. None of these fail
 * to parse — @tsrx/core accepts every one as an ordinary expression — so
 * without this scan they compile silently into broken output (a JSX node,
 * or an array of them, stringified into the HTML; verified empirically
 * before scoping this task). Scanning the whole AST also catches the idiom
 * nested inside setup expressions, not just direct template children.
 *
 * `.tsx`-authored components have no counterpart: these idioms are that
 * surface's CORRECT spellings (ADR 0032 sub-design 2), so the TSRX021–024
 * family stays in force for `.tsrx` sources only.
 */
const reportReactJsxNearMisses = (ctx: ExtractContext, ast: AstNode): void => {
	// Type positions are skipped: they hold no JSX, conditionals or calls.
	walkNodes(ast, node => {
		if (
			node.type === 'LogicalExpression' &&
			node.operator === '&&' &&
			isJsxNode(node.right)
		)
			ctx.diagnostics.push(
				diagnostic.reactLogicalJsx(
					ctx.source,
					node,
					text(ctx.source, node.left as AstNode),
					text(ctx.source, node),
				),
			)
		if (
			node.type === 'ConditionalExpression' &&
			(isJsxNode(node.consequent) || isJsxNode(node.alternate))
		)
			ctx.diagnostics.push(
				diagnostic.reactTernaryJsx(
					ctx.source,
					node,
					text(ctx.source, node.test as AstNode),
					text(ctx.source, node),
				),
			)
		if (
			node.type === 'CallExpression' &&
			isNode(node.callee) &&
			node.callee.type === 'MemberExpression' &&
			!node.callee.computed &&
			identifierName(node.callee.property) === 'map'
		) {
			const callback = asArray(node.arguments)[0]
			if (
				callback &&
				/Function(Expression)?$/.test(callback.type) &&
				producesJsx(callback.body)
			)
				ctx.diagnostics.push(
					diagnostic.reactMapJsx(
						ctx.source,
						node,
						identifierName(asArray(callback.params)[0]) ?? 'item',
						text(ctx.source, node.callee.object as AstNode),
						text(ctx.source, node),
					),
				)
		}
	})
}

/** The `.tsrx` grammar's half of the shared driver (`front-end.ts`). */
const TSRX_ADAPTER: SurfaceAdapter = {
	surface: 'tsrx',
	componentBodyType: 'JSXCodeBlock',
	preScans: reportReactJsxNearMisses,
	// The `@{ }` container's statements are the setup; its `render` slot is
	// the trailing output expression.
	splitSetupAndOutput: (_ctx, fn) => {
		const codeBlock = fn.body as AstNode
		return {
			setup: asArray(codeBlock.body),
			output: codeBlock.render as AstNode | undefined,
		}
	},
	// The CSS body parses as a `StyleSheet` child; an expression child
	// (`<style>{sheet}</style>`) parses instead, with no sheet at all — a
	// refusal (LTC078, LT-444), never an empty sheet.
	stylesheetOf: (_ctx, node) => {
		const sheet = getStyleElementStylesheet(node)
		if (sheet) return String(sheet.source ?? '')
		const content = asArray(node.children).find(
			c => !(c.type === 'JSXText' && String(c.value ?? '').trim() === ''),
		)
		return content ? { reason: 'content', at: content } : ''
	},
	lowerElement,
}

/**
 * Where `@tsrx/core` located its failure (acorn-style `pos` and
 * `raisedAt`, offsets in `source`) — the parse diagnostic's range (ADR 0044
 * s1); undefined, the whole file, when the error carries none.
 */
const parseErrorSite = (e: unknown): Site => {
	const { pos, raisedAt } = (e ?? {}) as { pos?: unknown; raisedAt?: unknown }
	return typeof pos === 'number'
		? { start: pos, end: typeof raisedAt === 'number' ? raisedAt : pos }
		: undefined
}

/* === Exported Functions === */

/**
 * Parse and extract the single exported component from a `.tsrx` source:
 * the `@tsrx/core` parse (whose failure carries the grammar hint), then the
 * shared driver over the `.tsrx` adapter.
 */
export const compileSource = (
	source: string,
	filename: string,
	emitPaths: EmitPaths = DEFAULT_EMIT_PATHS,
): CompileResult => {
	let ast: AstNode
	try {
		ast = parseModule(source, filename)
	} catch (e) {
		return {
			component: null,
			routingSignals: [],
			diagnostics: [
				diagnostic.invalidSource(
					source,
					parseErrorSite(e),
					`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}${newerGrammarHint(source, e)}`,
				),
			],
		}
	}
	return runFrontEnd(
		createExtractContext(source, 'tsrx'),
		ast,
		filename,
		emitPaths,
		TSRX_ADAPTER,
	)
}
