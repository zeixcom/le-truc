/**
 * The `.tsx` front end's compiler — the surface-specific half (LT-183 spike,
 * productionized by LT-202). Produces the same `ComponentIR` as
 * `server/compiler/frontend/tsrx/compiler.ts` (`ComponentIR` is the seam), so `analysis/*`,
 * both emitters, `tier.ts`, and `sim/` are reused unmodified.
 *
 * What is surface-specific here:
 *
 * - Parsing goes through the repo's `typescript` package
 *   (`ts.createSourceFile`, `ScriptKind.TSX`), converted to estree by
 *   `@typescript-eslint/typescript-estree` behind `to-estree.ts` — the
 *   `@tsrx/core` pin, `core.ts`, `core-shim.d.ts`, and `newerGrammarHint`
 *   have no role on this surface. A TypeScript parse error is LTC008, as a
 *   `@tsrx/core` parse error is on `.tsrx`.
 * - Module shape: one exported component function per file whose body is
 *   statements + a single `return <jsx/>`. Statements before the return are
 *   the setup (the `@{ }` block's replacement); the returned JSX (the bare root
 *   element, the host) is the template (ADR 0032 sub-design 1).
 * - The `.tsrx`-only scans (`reportReactJsxNearMisses` TSRX018/021–024,
 *   `newerGrammarHint`) are absent — the lazy sigil doesn't exist in TS, and
 *   the React idioms are this surface's CORRECT spellings.
 *
 * Everything else — the module scans, the params contract, setup
 * extraction, output resolution, the post-lowering validation tail and IR
 * assembly — is the one shared script in `front-end.ts` (LT-233), which
 * this file drives through a `SurfaceAdapter`; diagnostic wording comes
 * from `surface.ts` (ADR 0032 sub-design 6's anti-drift contract).
 */

import { asArray, identifierName, isNode } from '../../ast-utils'
import { diagnostic, type Site } from '../../diagnostics'
import { DEFAULT_EMIT_PATHS, type EmitPaths } from '../../emit-paths'
import {
	createExtractContext,
	type ExtractContext,
} from '../../extract-context'
import {
	type CompileResult,
	runFrontEnd,
	type SurfaceAdapter,
} from '../../front-end'
import { markerOf } from '../../imports'
import type { StylesheetRead } from '../../template-output'
import { lowerElement } from './lower-tsx'
import { type AstNode, parseTsxModule } from './to-estree'

/* === Types === */

export type { CompileResult } from '../../front-end'

/* === Spike-local helpers === */

/** Whitespace-only JSX text, or an empty `{}` container (a comment-only one too). */
const isBlankChild = (child: AstNode): boolean =>
	(child.type === 'JSXText' && String(child.value ?? '').trim() === '') ||
	// `to-estree` maps an empty container's `JSXEmptyExpression` to null.
	(child.type === 'JSXExpressionContainer' && !isNode(child.expression))

/**
 * Raw CSS text of a `<style>` element. SURFACE SHAPE vs `.tsrx`: JSX text
 * cannot carry raw CSS braces (`{`/`}` are expression delimiters), so the
 * `.tsx` spelling is a template-literal child — `<style>{css`…css…`}</style>`
 * — and the bytes are read from INSIDE the backticks (verbatim, original
 * indentation). The `css` TAG is the default spelling (ADR 0032 surface
 * vocabulary): editors highlight a `css`-tagged template literal as CSS out
 * of the box. The tag is the `css` compile-time marker, recognized by
 * binding (ADR 0034 s1, LT-442): imported from
 * `@zeix/le-truc-compiler/macros` under any local name, never a bare `css`.
 * A bare template literal (the spike spelling) stays accepted, and so does
 * an empty block; blank text around the child is ignored. Anything else —
 * another tag, a `css` that is not the marker, a `${}` substitution (the
 * sheet is evaluated by nothing), any other expression or text — is a
 * refusal (LTC078, LT-444), never an empty sheet.
 */
const styleElementStylesheet = (
	ctx: ExtractContext,
	node: AstNode,
): StylesheetRead => {
	const children = asArray(node.children).filter(c => !isBlankChild(c))
	const [child, extra] = children
	if (!child) return ''
	if (extra) return { reason: 'content', at: extra }
	const expr =
		child.type === 'JSXExpressionContainer'
			? (child.expression as AstNode | undefined)
			: undefined
	let template = expr
	if (expr?.type === 'TaggedTemplateExpression') {
		const tag = expr.tag as AstNode
		if (markerOf(ctx, tag) !== 'css')
			return identifierName(tag) === 'css'
				? { reason: 'shadowed', at: tag }
				: {
						reason: 'tag',
						at: tag,
						tag: ctx.source.slice(tag.start ?? 0, tag.end ?? 0),
					}
		template = expr.quasi as AstNode | undefined
	}
	if (!template || template.type !== 'TemplateLiteral')
		return { reason: 'content', at: child }
	const substitution = asArray(template.expressions)[0]
	if (substitution) return { reason: 'substitution', at: substitution }
	// Slice between the backticks (the literal's own brackets).
	const start = (template.start ?? 0) + 1
	const end = (template.end ?? 0) - 1
	return ctx.source.slice(start, end)
}

/** The `.tsx` grammar's half of the shared driver (`front-end.ts`). */
const tsxAdapter: SurfaceAdapter = {
	surface: 'tsx',
	componentBodyType: 'BlockStatement',
	// Setup = statements before the single return; template = the returned JSX.
	splitSetupAndOutput: (ctx, fn, filename) => {
		const bodyStmts = asArray((fn.body as AstNode).body)
		const returnStmt = bodyStmts.find(s => s.type === 'ReturnStatement')
		if (
			!returnStmt ||
			bodyStmts[bodyStmts.length - 1] !== returnStmt ||
			!isNode(returnStmt.argument)
		) {
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					ctx.source,
					fn,
					`${filename}: the component function must end in a single \`return <jsx/>\` (setup statements before it).`,
				),
			)
			return null
		}
		return {
			setup: bodyStmts.slice(0, -1),
			output: returnStmt.argument as AstNode,
		}
	},
	stylesheetOf: styleElementStylesheet,
	lowerElement,
}

/**
 * Where the TS parser located its failure (`TSError.location`, offsets in
 * `source`) — the parse diagnostic's range (ADR 0044 s1); undefined, the
 * whole file, when the error carries none.
 */
const parseErrorSite = (e: unknown): Site => {
	const location = (
		e as {
			location?: { start?: { offset?: unknown }; end?: { offset?: unknown } }
		}
	)?.location
	const start = location?.start?.offset
	const end = location?.end?.offset
	return typeof start === 'number'
		? { start, end: typeof end === 'number' ? end : start }
		: undefined
}

/* === Exported Functions === */

/**
 * Parse and extract the single exported component from a `.tsx` source:
 * the TS parser + estree converter, then the shared driver over the `.tsx`
 * adapter.
 */
export const compileSourceTsx = (
	source: string,
	filename: string,
	emitPaths: EmitPaths = DEFAULT_EMIT_PATHS,
): CompileResult => {
	let ast: AstNode
	try {
		ast = parseTsxModule(source, filename)
	} catch (e) {
		return {
			component: null,
			routingSignals: [],
			diagnostics: [
				diagnostic.invalidSource(
					source,
					parseErrorSite(e),
					`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}`,
				),
			],
		}
	}
	return runFrontEnd(
		createExtractContext(source, 'tsx'),
		ast,
		filename,
		emitPaths,
		tsxAdapter,
	)
}
