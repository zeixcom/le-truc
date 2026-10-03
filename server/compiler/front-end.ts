/**
 * The shared front-end driver (LT-233; ADR 0032 sub-design 6's anti-drift
 * contract). Both surfaces run ONE script from a parsed module to a
 * `ComponentIR`: the module scans, locating the single component function,
 * the `async` rejection, the params contract, setup extraction, the output
 * shape, context seeding, template lowering, output resolution, the
 * post-lowering validation tail and IR assembly. A surface contributes only
 * what its grammar genuinely decides, through a `SurfaceAdapter`: the
 * component body's node type, how that body splits into setup and output,
 * how a `<style>` element carries its CSS, its children/element lowering,
 * and any grammar-specific pre-scans. Diagnostic wording comes from the
 * surface's vocabulary (`surface.ts`), never from this file.
 *
 * Each `compileSource*` is parse + adapter + `runFrontEnd`; parsing stays
 * surface-side because the two parsers fail differently (`@tsrx/core`
 * throws with a position the `.tsrx` driver turns into a grammar hint).
 */

import { assembleComponentIR, readModuleDecls } from './assemble-ir'
import type { AstNode } from './ast-node'
import { asArray, identifierName, isNode } from './ast-utils'
import { diagnostic, type LocalDiagnostic } from './diagnostics'
import type { EmitPaths } from './emit-paths'
import type { ExtractContext } from './extract-context'
import { messageBindingsOf } from './i18n'
import {
	parseComposeImports,
	parseLeTrucImports,
	parsePlainImports,
} from './imports'
import type { ComponentIR, ForIR, SignalIR, TemplateNode } from './ir'
import {
	reportDeferredCollectorCalls,
	reportLeTrucImportMismatch,
	reportMalformedSelectors,
} from './module-scans'
import { extractParams } from './params'
import { extractSetup, seedExtractionContext } from './setup-extraction'
import { type Surface, wordingOf } from './surface'
import { resolveTemplateOutput } from './template-output'
import type { LocalRoutingSignal } from './tier'
import { validateLoweredComponent } from './validate-lowered'

/* === Types === */

export type CompileResult = {
	component: ComponentIR | null
	diagnostics: LocalDiagnostic[]
	/**
	 * Setup-extraction routing signals (ADR 0029, LT-165). Merged with the
	 * analysis pass's own in `pipeline.ts`, where the tier is classified.
	 */
	routingSignals: LocalRoutingSignal[]
}

/** What one surface's grammar decides; everything else is shared. */
export type SurfaceAdapter = {
	surface: Surface
	/** The component function's body node type (`JSXCodeBlock` / `BlockStatement`). */
	componentBodyType: string
	/** Grammar-specific module scans, run before the shared ones. */
	preScans?: (ctx: ExtractContext, ast: AstNode) => void
	/**
	 * Split the component function into setup statements and the output
	 * node. Returns null after pushing a diagnostic when the body has no
	 * recognizable output position; an output of the wrong SHAPE is the
	 * driver's check, not this one's.
	 */
	splitSetupAndOutput: (
		ctx: ExtractContext,
		fn: AstNode,
		filename: string,
	) => { setup: AstNode[]; output: AstNode | undefined } | null
	/** The raw CSS of a `<style>` placeholder's source node. */
	stylesheetOf: (node: AstNode) => string
	lowerChildren: (
		ctx: ExtractContext,
		parent: AstNode,
		signals: ReadonlyMap<string, SignalIR>,
		fors: Map<AstNode, ForIR>,
	) => TemplateNode[]
	lowerElement: (
		ctx: ExtractContext,
		element: AstNode,
		signals: ReadonlyMap<string, SignalIR>,
		fors: Map<AstNode, ForIR>,
	) => TemplateNode & { kind: 'element' }
}

/* === Exported Functions === */

/**
 * Drive a parsed module through the shared front-end script. Returns
 * `{ component: null }` with diagnostics when the source does not lower
 * cleanly; milestone gates (e.g. LTC001) surface as warnings.
 */
export const runFrontEnd = (
	ctx: ExtractContext,
	ast: AstNode,
	filename: string,
	emitPaths: EmitPaths,
	adapter: SurfaceAdapter,
): CompileResult => {
	const wording = wordingOf(ctx)
	const done = (component: ComponentIR | null = null): CompileResult => ({
		component,
		diagnostics: ctx.diagnostics,
		routingSignals: ctx.routingSignals,
	})

	adapter.preScans?.(ctx, ast)
	reportMalformedSelectors(ctx, ast)
	ctx.composeImports = parseComposeImports(ast, filename)
	const plainImports = parsePlainImports(
		ctx,
		ast,
		filename,
		emitPaths.outDirPrefix,
	)
	const leTrucImports = parseLeTrucImports(ast)
	reportLeTrucImportMismatch(ctx, ast, leTrucImports)
	const importedNames = new Set<string>([
		...plainImports.flatMap(i => i.localNames),
		...leTrucImports.flatMap(i => i.names),
	])

	// Locate the single component function (by its body's node type).
	let fn: AstNode | null = null
	let fnStmt: AstNode | null = null
	let fnStmtStart = 0
	for (const stmt of asArray(ast.body)) {
		const decl =
			stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
				? stmt.declaration
				: stmt
		if (
			decl.type !== 'FunctionDeclaration' ||
			!isNode(decl.body) ||
			decl.body.type !== adapter.componentBodyType
		)
			continue
		if (fn) {
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					ctx.source,
					stmt,
					`${filename}: multiple component functions per file are outside the sanctioned subset.`,
				),
			)
		} else {
			fn = decl
			fnStmt = stmt
			fnStmtStart = typeof stmt.start === 'number' ? stmt.start : 0
		}
	}
	if (!fn) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				undefined,
				`${filename}: ${wording.noComponent}`,
			),
		)
		return done()
	}

	// An `async` component function (LTC008, LT-157d): every statement
	// after the first `await` runs in a later microtask, when the ambient
	// effect collector is gone (ADR 0018) — so `expose()`/`watch()`/`on()`
	// there throw `NoActiveCollectorError`, contained and silent since
	// LT-155. The server half is worse: `emit-server.ts` calls the render
	// function synchronously and would stringify a Promise. Rejected
	// outright rather than diagnosed per call site, since neither half of
	// the isomorphic pair can honour it.
	if (fn.async === true) {
		// The whole statement, `export` included, so both surfaces cover the
		// same text (the parsers disagree on where the declaration starts).
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				fnStmt ?? fn,
				`${filename}: the component function must not be \`async\` — setup runs synchronously on both halves (the server render function stringifies its result, and the client factory's effect collector is only active for the duration of the call). Await inside an event handler or a client-only setup statement instead.`,
			),
		)
		return done()
	}
	reportDeferredCollectorCalls(ctx, fn)

	const params = extractParams(ctx, filename, fn)
	if (!params) return done()

	const split = adapter.splitSetupAndOutput(ctx, fn, filename)
	if (!split) return done()
	const name = identifierName(fn.id) ?? 'Component'
	// Read before setup extraction: its client-only gate admits a static
	// `t.<key>` read of a declared key (LT-349).
	const decls = readModuleDecls(ctx, ast, name)
	const extraction = extractSetup(
		ctx,
		split.setup,
		params.paramsNode,
		params.paramNames,
		importedNames,
		{
			tNames: messageBindingsOf(params.paramsNode).tNames,
			declaredKeys: decls.i18nMessages ?? {},
		},
	)

	// Output: a single root element, or a fragment of [root element,
	// <style>?]. A bare root is legal (LT-123): the fragment exists to carry
	// a SECOND node beside the root (the `<style>` block), so a component
	// with no styles of its own has nothing to wrap.
	const output = split.output
	const bareRoot = output?.type === 'JSXElement' ? output : null
	if (!bareRoot && output?.type !== 'JSXFragment') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				ctx.source,
				output,
				`${filename}: ${wording.outputShape}`,
			),
		)
		return done()
	}
	seedExtractionContext(ctx, { paramNames: params.paramNames, extraction })

	const fors = new Map<AstNode, ForIR>()
	// A bare root element has no fragment to walk children of — lower it as
	// the single-node list the fragment path would have produced.
	const lowered: TemplateNode[] = bareRoot
		? [adapter.lowerElement(ctx, bareRoot, extraction.signalByName, fors)]
		: adapter.lowerChildren(
				ctx,
				output as AstNode,
				extraction.signalByName,
				fors,
			)
	const resolved = resolveTemplateOutput(
		ctx,
		filename,
		extraction,
		lowered,
		adapter.stylesheetOf,
		wording.outputLabel,
	)
	if (!resolved) return done()

	validateLoweredComponent(ctx, {
		root: resolved.root,
		config: decls.config,
		i18nMessages: decls.i18nMessages,
		i18nArgs: decls.i18nArgs,
		componentFn: fn,
		extraction,
		fors,
	})
	return done(
		assembleComponentIR(ctx, {
			componentName: name,
			fnStmtStart,
			paramsNode: params.paramsNode,
			paramNames: params.paramNames,
			contextParam: params.contextParam,
			extraction,
			resolved: { ...resolved, fors },
			decls,
			plainImports,
			leTrucImports,
		}),
	)
}
