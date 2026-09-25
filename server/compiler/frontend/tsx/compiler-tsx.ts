/**
 * The `.tsx` front end's compiler — the surface-specific half (LT-183 spike,
 * productionized by LT-202). Produces the same `ComponentIR` as
 * `server/compiler/frontend/tsrx/compiler.ts` (`ComponentIR` is the seam), so `analysis/*`,
 * both emitters, `tier.ts`, and `sim/` are reused unmodified.
 *
 * What is surface-specific here:
 *
 * - Parsing goes through the repo's `typescript` package
 *   (`ts.createSourceFile`, `ScriptKind.TSX`) via `to-estree.ts` — the
 *   `@tsrx/core` pin, `core.ts`, `core-shim.d.ts`, and `newerGrammarHint`
 *   have no role on this surface.
 * - Module shape: one exported component function per file whose body is
 *   statements + a single `return <jsx/>`. Statements before the return are
 *   the setup (the `@{ }` block's replacement); the returned JSX (bare root
 *   or fragment) is the template (ADR 0032 sub-design 1).
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
import { diagnostic } from '../../diagnostics'
import { DEFAULT_EMIT_PATHS, type EmitPaths } from '../../emit-paths'
import {
	type CompileResult,
	createExtractContext,
	runFrontEnd,
	type SurfaceAdapter,
} from '../../front-end'
import { lowerChildren, lowerElement } from './lower-tsx'
import { type AstNode, parseTsxModule } from './to-estree'

/* === Types === */

export type { CompileResult } from '../../front-end'

/* === Spike-local helpers === */

/**
 * Raw CSS text of a `<style>` element. SURFACE SHAPE vs `.tsrx`: JSX text
 * cannot carry raw CSS braces (`{`/`}` are expression delimiters), so the
 * `.tsx` spelling is a template-literal child — `<style>{css`…css…`}</style>`
 * — and the bytes are read from INSIDE the backticks (verbatim, original
 * indentation). The `css` TAG is the default spelling (ADR 0032 surface
 * vocabulary): editors highlight a `css`-tagged template literal as CSS out
 * of the box, and the ambient `css` identity function is compile-consumed —
 * evaluated by nothing, so a `${}` substitution inside is still rejected. A
 * bare template literal (the spike spelling) stays accepted.
 */
const styleElementStylesheet = (
	source: string,
	node: AstNode,
): string | null => {
	const child = Array.isArray(node.children)
		? ((node.children as AstNode[])[0] as AstNode | undefined)
		: undefined
	const expr =
		child && child.type === 'JSXExpressionContainer'
			? (child.expression as AstNode | undefined)
			: undefined
	let template = expr
	if (expr?.type === 'TaggedTemplateExpression') {
		const tag = expr.tag as AstNode | undefined
		if (!isNode(tag) || identifierName(tag) !== 'css') return null
		template = expr.quasi as AstNode | undefined
	}
	if (!template || template.type !== 'TemplateLiteral') return null
	if ((template.expressions as unknown[] | undefined)?.length) return null
	// Slice between the backticks (the literal's own brackets).
	const start = (template.start ?? 0) + 1
	const end = (template.end ?? 0) - 1
	return source.slice(start, end)
}

/** The `.tsx` grammar's half of the shared driver (`front-end.ts`). */
const tsxAdapter = (source: string): SurfaceAdapter => ({
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
					fn.start,
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
	stylesheetOf: node => styleElementStylesheet(source, node) ?? '',
	lowerChildren,
	lowerElement,
})

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
): CompileResult =>
	runFrontEnd(
		createExtractContext(source, 'tsx'),
		parseTsxModule(source, filename),
		filename,
		emitPaths,
		tsxAdapter(source),
	)
