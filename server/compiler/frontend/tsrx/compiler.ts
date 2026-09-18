/**
 * TSRX compiler front end for `.tsrx` sources — the surface-specific half.
 * Everything downstream consumes the component IR produced here.
 * `@tsrx/core` VALUES enter through the `core.ts` pin adapter (pinned
 * 0.1.63, ADR 0023 sub-design 2; LT-040) — a pin upgrade touches only that
 * file and core-shim.d.ts — and the IR type vocabulary shared by the rest
 * of the compiler lives in `ir.ts` (LT-039).
 *
 * Owns the `.tsrx`-specific stages only (`compileSource`: locate the
 * exported component function whose body is an `@{ }` statement container,
 * slice its setup statements and trailing output verbatim, plus the
 * grammar's own scans). The setup-extraction loop, context seeding,
 * template-output resolution, and the post-lowering validation tail are
 * SHARED with the `.tsx` front end through `front-end.ts` (LT-202, ADR 0032
 * sub-design 6's anti-drift contract); template lowering shares
 * `lower-shared.ts` under `lower-template.ts`'s directive dispatch.
 * Attribute classification lives in `classify-attributes.ts`, signal type
 * inference in `infer-type.ts`, `export const config` extraction and
 * compose-import resolution in `config.ts`/`imports.ts`, and shared AST
 * predicates/vocabulary constants in `ast-utils.ts`.
 */

import type { TsrxNode } from '@tsrx/core'
import { asArray, identifierName, isNode, text } from '../../ast-utils'
import { getStyleElementStylesheet, parseModule } from '../../core'
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
import type { ComponentIR, ExtractContext, ForIR, TemplateNode } from '../../ir'
import type { RoutingSignal } from '../../tier'
import { lowerChildren, lowerElement } from './lower-template'

/* === Types === */

export type CompileResult = {
	component: ComponentIR | null
	diagnostics: CompileDiagnostic[]
	/**
	 * Setup-extraction routing signals (ADR 0029, LT-165). Merged with the
	 * analysis pass's own in `index.ts`, where the tier is classified.
	 */
	routingSignals: RoutingSignal[]
}

/** Shared empty result for the `parserFallbackRefsOf` context hook. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

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
 * (TSRX008) — `await` belongs in an event handler or a client-only setup
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
			return ` — ${what} is not parseable by the pinned @tsrx/core 0.1.63 (pin upgrades are reviewed changes — see ADR 0023 sub-design 2)`
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
const reportReactJsxNearMisses = (ctx: ExtractContext, ast: TsrxNode): void => {
	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child)
			return
		}
		if (!isNode(node)) return
		if (
			node.type === 'LogicalExpression' &&
			node.operator === '&&' &&
			isJsxNode(node.right)
		)
			ctx.diagnostics.push(
				diagnostic.reactLogicalJsx(
					ctx.source,
					node.start,
					text(ctx.source, node.left as TsrxNode),
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
					node.start,
					text(ctx.source, node.test as TsrxNode),
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
						node.start,
						identifierName(asArray(callback.params)[0]) ?? 'item',
						text(ctx.source, node.callee.object as TsrxNode),
						text(ctx.source, node),
					),
				)
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			visit(value)
		}
	}
	visit(ast)
}

/* === Exported Functions === */

/**
 * Parse and extract the single exported component from a `.tsrx` source.
 * Returns `{ component: null }` with diagnostics when the source does not
 * lower cleanly; milestone gates (e.g. TSRX001) surface as warnings.
 */
export const compileSource = (
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
		parserFallbackRefsOf: () => EMPTY_NAMES,
		composeImports: new Map<string, string>(),
		setupInits: new Map<string, TsrxNode>(),
	}
	let ast: TsrxNode
	try {
		ast = parseModule(source, filename)
	} catch (e) {
		return {
			component: null,
			routingSignals: [],
			diagnostics: [
				diagnostic.invalidSource(
					source,
					undefined,
					`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}${newerGrammarHint(source, e)}`,
				),
			],
		}
	}
	reportReactJsxNearMisses(ctx, ast)
	reportMalformedSelectors(ctx, ast)
	ctx.composeImports = parseComposeImports(ast, filename)
	const plainImports = parsePlainImports(ctx, ast, filename)
	const leTrucImports = parseLeTrucImports(ast)
	reportLeTrucImportMismatch(ctx, ast, leTrucImports)
	const importedNames = new Set<string>([
		...plainImports.flatMap(i => i.localNames),
		...leTrucImports.flatMap(i => i.names),
	])

	// Locate the exported component function (body = JSXCodeBlock).
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
			decl.body.type === 'JSXCodeBlock'
		) {
			if (fn) {
				ctx.diagnostics.push(
					diagnostic.invalidSource(
						ctx.source,
						stmt.start,
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
				ctx.source,
				undefined,
				`${filename}: no exported component function with an @{ } container found.`,
			),
		)
		return {
			component: null,
			diagnostics: ctx.diagnostics,
			routingSignals: ctx.routingSignals,
		}
	}

	// An `async` component function (TSRX008, LT-157d): every statement
	// after the first `await` runs in a later microtask, when the ambient
	// effect collector is gone (ADR 0018) — so `expose()`/`watch()`/`on()`
	// there throw `NoActiveCollectorError`, contained and silent since
	// LT-155. The server half is worse: `emit-server.ts` calls the render
	// function synchronously and would stringify a Promise. Rejected
	// outright rather than diagnosed per call site, since neither half of
	// the isomorphic pair can honour it.
	if (fn.async === true) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				fn.start,
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

	// Setup statements: the `@{ }` container's statements minus the trailing
	// output expression, classified by the shared extraction loop.
	const codeBlock = fn.body as TsrxNode
	const name = identifierName(fn.id) ?? 'Component'
	const extraction = extractSetup(
		ctx,
		asArray(codeBlock.body),
		params.paramsNode,
		params.paramNames,
		importedNames,
	)

	// Output: a single root element, or a fragment of
	// [root element, <style>?].
	const render = codeBlock.render as TsrxNode | undefined
	// A bare single root element is a legal output (LT-123): the
	// fragment exists to carry a SECOND node beside the root (the
	// `<style>` block), so a component with no styles of its own has
	// nothing to wrap and should not have to write `<>…</>` anyway.
	const bareRoot = render?.type === 'JSXElement' ? render : null
	if (!bareRoot && (!render || render.type !== 'JSXFragment')) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				render?.start,
				`${filename}: the @{ } container's output must be a single root element, or a fragment (element + <style>).`,
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
	{
		// A bare root element has no fragment to walk children of
		// — lower it as the single-node list the fragment path
		// would have produced.
		const lowered: TemplateNode[] = bareRoot
			? [lowerElement(ctx, bareRoot, extraction.signalByName, fors)]
			: lowerChildren(ctx, render as TsrxNode, extraction.signalByName, fors)
		const resolved = resolveTemplateOutput(
			ctx,
			filename,
			extraction,
			lowered,
			node => {
				const stylesheet = getStyleElementStylesheet(node)
				return String(stylesheet?.source ?? '')
			},
			'the @{ } output',
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
			contextParam: params.contextParam,
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
}
