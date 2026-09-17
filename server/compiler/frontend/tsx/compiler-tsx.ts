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
 * - The `.tsrx`-only scans (`reportLazyPatterns` TSRX018/020,
 *   `reportReactJsxNearMisses` TSRX021–024, `newerGrammarHint`) are absent —
 *   lazy destructuring doesn't exist in TS, and the React idioms are this
 *   surface's CORRECT spellings.
 *
 * Everything else — the malformed-selector and import-mismatch scans, the
 * params contract, the setup-extraction loop, context seeding,
 * template-output resolution, the post-lowering validation tail, and the
 * final IR assembly — is SHARED with the `.tsrx` front end through
 * `server/compiler/front-end.ts` (LT-202, ADR 0032 sub-design 6's anti-drift
 * contract).
 */

import { asArray, identifierName, isNode } from '../../ast-utils'
import { type CompileDiagnostic, diagnostic } from '../../diagnostics'
import {
	assembleComponentIR,
	extractParams,
	extractSetup,
	readModuleDecls,
	reportDeferredCollectorCalls,
	reportLeTrucImportMismatch,
	reportMalformedSelectors,
	resolveTemplateOutput,
	seedExtractionContext,
	validateLoweredComponent,
} from '../../front-end'
import {
	parseComposeImports,
	parseLeTrucImports,
	parsePlainImports,
} from '../../imports'
import type {
	ComponentIR,
	ExtractContext,
	ForIR,
	TemplateNode,
} from '../../ir'
import type { RoutingSignal } from '../../tier'
import { lowerChildren, lowerElement } from './lower-tsx'
import { parseTsxModule, type TsrxNode } from './to-estree'

/* === Types === */

export type CompileResult = {
	component: ComponentIR | null
	diagnostics: CompileDiagnostic[]
	routingSignals: RoutingSignal[]
}

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
	node: TsrxNode,
): string | null => {
	const child = Array.isArray(node.children)
		? ((node.children as TsrxNode[])[0] as TsrxNode | undefined)
		: undefined
	const expr =
		child && child.type === 'JSXExpressionContainer'
			? (child.expression as TsrxNode | undefined)
			: undefined
	let template = expr
	if (expr?.type === 'TaggedTemplateExpression') {
		const tag = expr.tag as TsrxNode | undefined
		if (!isNode(tag) || identifierName(tag) !== 'css') return null
		template = expr.quasi as TsrxNode | undefined
	}
	if (!template || template.type !== 'TemplateLiteral') return null
	if ((template.expressions as unknown[] | undefined)?.length) return null
	// Slice between the backticks (the literal's own brackets).
	const start = (template.start ?? 0) + 1
	const end = (template.end ?? 0) - 1
	return source.slice(start, end)
}

/* === Exported Functions === */

/**
 * Parse and extract the single exported component from a `.tsx` source.
 * Mirrors `compiler.ts`'s `compileSource` over the TS parser + estree
 * converter; see the module header for the adaptation ledger.
 */
export const compileSourceTsx = (
	source: string,
	filename: string,
): CompileResult => {
	const ctx: ExtractContext = {
		source,
		diagnostics: [],
		routingSignals: [],
		exposedProps: new Set<string>(),
		serverKnown: new Set<string>(),
		argNames: new Set<string>(),
		parserProps: new Set<string>(),
		parserFactoryOf: () => '',
		parserFallbackRefsOf: () => new Set<string>(),
		composeImports: new Map<string, string>(),
		setupInits: new Map<string, TsrxNode>(),
	}

	const ast = parseTsxModule(source, filename)

	reportMalformedSelectors(ctx, ast)
	ctx.composeImports = parseComposeImports(ast, filename)
	const plainImports = parsePlainImports(ctx, ast, filename)
	const leTrucImports = parseLeTrucImports(ast)
	reportLeTrucImportMismatch(ctx, ast, leTrucImports)
	const importedNames = new Set<string>([
		...plainImports.flatMap(i => i.localNames),
		...leTrucImports.flatMap(i => i.names),
	])

	// Locate the exported component function: exported, takes the single
	// destructured args object, its body ends in `return <jsx/>`.
	let fn: TsrxNode | null = null
	let fnStmtStart = 0
	for (const stmt of asArray(ast.body)) {
		const decl =
			stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
				? stmt.declaration
				: stmt
		if (
			decl.type === 'FunctionDeclaration' &&
			isNode(decl.body) &&
			decl.body.type === 'BlockStatement'
		) {
			if (fn) {
				ctx.diagnostics.push(
					diagnostic.invalidSource(
						`${filename}: multiple component functions per file are outside the sanctioned subset.`,
					),
				)
			} else {
				fn = decl
				fnStmtStart = typeof stmt.start === 'number' ? stmt.start : 0
			}
		}
	}
	if (!fn) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: no exported component function found (one per file, setup statements then a single \`return <jsx/>\`).`,
			),
		)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}
	}
	if (fn.async === true) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must not be \`async\` — setup runs synchronously on both halves (the server render function stringifies its result, and the client factory's effect collector is only active for the duration of the call). Await inside an event handler or a client-only setup statement instead.`,
			),
		)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}
	}
	reportDeferredCollectorCalls(ctx, fn)

	const params = extractParams(ctx, filename, fn)
	if (!params)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}

	// Setup = statements before the single return; template = the returned JSX.
	const name = identifierName(fn.id) ?? 'Component'
	const bodyStmts = asArray((fn.body as TsrxNode).body)
	const returnStmt = bodyStmts.find(s => s.type === 'ReturnStatement') as
		| TsrxNode
		| undefined
	if (
		!returnStmt ||
		bodyStmts[bodyStmts.length - 1] !== returnStmt ||
		!isNode(returnStmt.argument)
	) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must end in a single \`return <jsx/>\` (setup statements before it).`,
			),
		)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}
	}
	const render = returnStmt.argument as TsrxNode
	const setupStmts = bodyStmts.slice(0, -1)

	const extraction = extractSetup(
		ctx,
		setupStmts,
		params.paramsNode,
		params.paramNames,
		importedNames,
	)

	// Output: a single root element, or a fragment of [root element, <style>?].
	const bareRoot = render.type === 'JSXElement' ? render : null
	if (!bareRoot && render.type !== 'JSXFragment') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the return value must be a single root element, or a fragment (element + <style>).`,
			),
		)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}
	}
	seedExtractionContext(ctx, { paramNames: params.paramNames, extraction })

	const fors = new Map<TsrxNode, ForIR>()
	const lowered: TemplateNode[] = bareRoot
		? [lowerElement(ctx, bareRoot, extraction.signalByName, fors)]
		: lowerChildren(ctx, render, extraction.signalByName, fors)
	const resolved = resolveTemplateOutput(
		ctx,
		filename,
		extraction,
		lowered,
		node => styleElementStylesheet(source, node) ?? '',
		'the template return',
	)
	if (!resolved)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}

	const decls = readModuleDecls(ctx, ast, name)
	const caseType = validateLoweredComponent(ctx, {
		root: resolved.root,
		config: decls.config,
		i18nMessages: decls.i18nMessages,
		extraction,
	})
	const component = assembleComponentIR(ctx, {
		componentName: name,
		fnStmtStart,
		paramsNode: params.paramsNode,
		paramNames: params.paramNames,
		extraction,
		resolved: { ...resolved, fors },
		decls,
		caseType,
		plainImports,
		leTrucImports,
	})
	return {
		component,
		diagnostics: ctx.diagnostics,
		routingSignals: ctx.routingSignals,
	}
}
