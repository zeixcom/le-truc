/**
 * TSX spike (LT-183): the `.tsx` front end — ADAPTED from
 * `server/tsrx/compiler.ts`'s `compileSource`. Produces the same
 * `ComponentIR` (TSX_SPIKE.md §3: `ComponentIR` is the seam), so
 * `analysis/*`, both emitters, `tier.ts`, and `sim/` are reused unmodified.
 *
 * What changed against the `.tsrx` original:
 *
 * - Parsing goes through the repo's `typescript` package
 *   (`ts.createSourceFile`, `ScriptKind.TSX`) via `to-estree.ts` — the
 *   `@tsrx/core` pin, `core.ts`, `core-shim.d.ts`, and `newerGrammarHint`
 *   are deleted by omission (§4.1).
 * - Module shape: one exported component function per file whose body is
 *   statements + a single `return <jsx/>`. Statements before the return are
 *   the setup (the `@{ }` block's replacement); the returned JSX (bare root
 *   or fragment) is the template (§4.1).
 * - `reportLazyPatterns` (TSRX018/020) and `reportReactJsxNearMisses`
 *   (TSRX021–024) are deleted by omission — lazy destructuring doesn't exist
 *   in TS, and the React idioms are now the CORRECT spellings.
 * - `reportMalformedSelectors` and `reportLeTrucImportMismatch` are copied
 *   VERBATIM (they are module-private in `compiler.ts`; the spike leaves
 *   `server/tsrx/` untouched).
 * - `parseComposeImports` gains a `.tsx`-extension sibling; plain and
 *   `@zeix/le-truc` import placement are reused as-is.
 */

import * as ts from 'typescript'
import {
	asArray,
	CLIENT_ONLY_PRIMITIVES,
	COLLECTOR_HELPERS,
	CONTEXT_NAMES,
	collectBoundNames,
	FACTORY_CONTEXT_MEMBERS,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	MANAGED_FORM_MEMBERS,
	MANAGED_TEXT_PROPS,
	PARSER_FACTORIES,
	REAL_EXPORT_NAMES,
	RESERVED_PROP_NAMES,
	SIGNAL_CONSTRUCTORS,
	text,
} from '../tsrx/ast-utils'
import { readConfig } from '../tsrx/config'
import { dedentCss } from '../tsrx/css'
import { type CompileDiagnostic, diagnostic } from '../tsrx/diagnostics'
import {
	collectMatchingElements,
	inOptionalBranch,
	namesCustomElementTag,
	reportDuplicatedChannels,
	reportStaticIds,
	shareExclusiveIf,
} from '../tsrx/first-refs'
import {
	declaresI18nOf,
	langArgDefaultOf,
	langBindingOf,
	readI18nDecl,
} from '../tsrx/i18n'
import {
	type LeTrucImport,
	parseLeTrucImports,
	parsePlainImports,
	placeLeTrucImports,
	placePlainImports,
} from '../tsrx/imports'
import { inferType, isOptionalBinding, type TypeContext } from '../tsrx/infer-type'
import type {
	ComponentIR,
	ConfigIR,
	ExposeKind,
	ExtractContext,
	ForIR,
	SetupStmt,
	SignalConstructor,
	SignalIR,
	SourceRange,
	TemplateNode,
} from '../tsrx/ir'
import { lineFields, type RoutingSignal, resolutionOf } from '../tsrx/tier'
import { walkTemplate } from '../tsrx/walk'
import { lowerChildren, lowerElement } from './lower-tsx'
import { malformedSelectorReason } from '../tsrx/selector-syntax'
import { parseTsxModule, type TsrxNode } from './to-estree'

/* === Types === */

export type CompileResult = {
	component: ComponentIR | null
	diagnostics: CompileDiagnostic[]
	routingSignals: RoutingSignal[]
}

/** Shared empty result for the `parserFallbackRefsOf` context hook. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

/* === Copied verbatim from compiler.ts (module-private there) === */

/**
 * Report every malformed `first()`/`all()` selector in the module (TSRX026).
 * VERBATIM copy of `compiler.ts`'s private helper — the walk is
 * estree-generic, so it runs unchanged over the converted `.tsx` AST.
 */
const reportMalformedSelectors = (ctx: ExtractContext, ast: TsrxNode): void => {
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
 * Validate authored `'@zeix/le-truc'` imports against real usage (TSRX036/
 * TSRX037). VERBATIM copy of `compiler.ts`'s private helper, minus the
 * `.tsrx`-only `JSXCodeBlock` scope case (`.tsx` setups are plain
 * BlockStatements, which the copy already handles).
 */
const reportLeTrucImportMismatch = (
	ctx: ExtractContext,
	ast: TsrxNode,
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
			case 'Program': {
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
	visit(ast, new Set<string>())

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

/**
 * Report every collector-requiring helper called from inside a nested
 * function in the component body (TSRX013 family, LT-157d). VERBATIM copy.
 */
const reportDeferredCollectorCalls = (ctx: ExtractContext, fn: TsrxNode): void => {
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
 * Which of `#setAccessor`'s three landings an `expose()` initializer takes
 * (LT-158). VERBATIM copy.
 */
const MUTABLE_SIGNAL_CONSTRUCTORS: ReadonlySet<string> = new Set<string>([
	'createCell',
	'createState',
	'createList',
	'createStore',
])
const classifyExposeInit = (
	value: unknown,
	signalByName: ReadonlyMap<string, SignalIR>,
): ExposeKind => {
	if (!isNode(value)) return 'slot'
	if (value.type === 'CallExpression') {
		const callee = identifierName(value.callee)
		if (callee === 'defineMethod') return 'method'
		return 'slot'
	}
	if (
		value.type === 'MemberExpression' &&
		identifierName(value.property) === 'get'
	)
		return 'computed'
	if (
		value.type === 'ArrowFunctionExpression' ||
		value.type === 'FunctionExpression'
	)
		return 'computed'
	if (value.type === 'ObjectExpression') {
		const keys = asArray(value.properties)
			.filter(prop => prop.type === 'Property')
			.map(prop => identifierName(prop.key))
		if (keys.includes('get')) return keys.includes('set') ? 'slot' : 'computed'
		return 'slot'
	}
	if (value.type === 'Identifier') {
		const signal = signalByName.get(identifierName(value) ?? '')
		if (signal)
			return MUTABLE_SIGNAL_CONSTRUCTORS.has(String(signal.constructor))
				? 'slot'
				: 'computed'
	}
	return 'slot'
}

/** Native form-control tags whose own `name` would double-submit (LT-059). */
const NAMED_FORM_CONTROL_TAGS: ReadonlySet<string> = new Set([
	'input',
	'select',
	'textarea',
	'button',
])

/**
 * Report a `name` (static or bound) on a descendant form control inside a
 * form-associated component's template (LT-059). VERBATIM copy — walks the
 * lowered template IR, front-end-agnostic.
 */
const reportNamedFormControls = (
	ctx: ExtractContext,
	root: TemplateNode,
): void => {
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'element') {
			if (NAMED_FORM_CONTROL_TAGS.has(node.tag)) {
				const nameAttr = node.attrs.find(
					a =>
						(a.kind === 'static' ||
							a.kind === 'server' ||
							a.kind === 'reactive') &&
						a.name === 'name',
				)
				if (nameAttr)
					ctx.diagnostics.push(
						diagnostic.formControlHasName(ctx.source, node.node.start, node.tag),
					)
			}
			for (const child of node.children) visit(child)
			return
		}
		if (node.kind === 'if') {
			for (const child of node.then) visit(child)
			for (const child of node.alternate) visit(child)
			return
		}
		if (node.kind === 'switch') {
			for (const arm of node.cases)
				for (const child of arm.children) visit(child)
			return
		}
		if (node.kind === 'try') {
			for (const child of node.children) visit(child)
			for (const child of node.catchChildren) visit(child)
			if (node.pendingChildren)
				for (const child of node.pendingChildren) visit(child)
			return
		}
	}
	visit(root)
}

/**
 * The doc comment immediately preceding a declaration, sliced verbatim.
 * VERBATIM copy.
 */
const leadingDocComment = (source: string, before: number): string | null => {
	const head = source.slice(0, before)
	const close = head.lastIndexOf('*/')
	if (close === -1) return null
	const open = head.lastIndexOf('/**', close)
	if (open === -1) return null
	if (head.slice(close + 2).trim() !== '') return null
	return source.slice(open, close + 2)
}

/* === Spike-local helpers === */

/**
 * Named imports of sibling `.tsx` modules (ADR 0023 sub-design 10 shape,
 * re-targeted): ADAPTED from `imports.ts`'s `parseComposeImports` — the only
 * change is the extension filter (`.tsx`), so composed targets resolve to
 * the ported fixtures.
 */
export const parseComposeImportsTsx = (
	ast: TsrxNode,
	filename: string,
): Map<string, string> => {
	const dirname = (p: string): string => {
		const idx = p.lastIndexOf('/')
		return idx === -1 ? '.' : idx === 0 ? '/' : p.slice(0, idx)
	}
	const join = (dir: string, rel: string): string =>
		dir === '.' ? rel : `${dir}/${rel}`
	const normalize = (p: string): string => {
		const absolute = p.startsWith('/')
		const out: string[] = []
		for (const part of p.split('/')) {
			if (part === '' || part === '.') continue
			if (part === '..') {
				if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
				else if (!absolute) out.push('..')
				continue
			}
			out.push(part)
		}
		return (absolute ? '/' : '') + out.join('/')
	}
	const imports = new Map<string, string>()
	const dir = dirname(filename)
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		const specifierNode = stmt.source
		const specifier =
			isNode(specifierNode) &&
			specifierNode.type === 'Literal' &&
			typeof specifierNode.value === 'string'
				? specifierNode.value
				: null
		if (!specifier || !specifier.endsWith('.tsx')) continue
		const resolved = normalize(join(dir, specifier))
		for (const spec of asArray(stmt.specifiers)) {
			if (spec.type !== 'ImportSpecifier') continue
			const local = identifierName(spec.local)
			if (local) imports.set(local, resolved)
		}
	}
	return imports
}

/**
 * Raw CSS text of a `<style>` element. SURFACE CHANGE from `.tsrx`: JSX
 * text cannot carry raw CSS braces (`{`/`}` are expression delimiters), so
 * the `.tsx` spelling is a template-literal child —
 * `<style>{`…css…`}</style>` — and the bytes are read from INSIDE the
 * backticks (verbatim, original indentation). A no-substitution template
 * only; `${` inside CSS would be a template substitution and is not
 * sanctioned.
 */
const styleElementStylesheet = (
	source: string,
	node: TsrxNode,
): string | null => {
	const tsNode = node.tsNode as ts.JsxElement | undefined
	if (!tsNode) return null
	// The estree children the converter produced: exactly one expression
	// container holding the template literal.
	const child = Array.isArray(node.children)
		? ((node.children as TsrxNode[])[0] as TsrxNode | undefined)
		: undefined
	const expr =
		child && child.type === 'JSXExpressionContainer'
			? (child.expression as TsrxNode | undefined)
			: undefined
	if (!expr || expr.type !== 'TemplateLiteral') return null
	if ((expr.expressions as unknown[] | undefined)?.length) return null
	// Slice between the backticks (the literal's own brackets).
	const start = (expr.start ?? 0) + 1
	const end = (expr.end ?? 0) - 1
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
		parserFallbackRefsOf: () => EMPTY_NAMES,
		composeImports: new Map<string, string>(),
		setupInits: new Map<string, TsrxNode>(),
	}

	const ast = parseTsxModule(source, filename)

	reportMalformedSelectors(ctx, ast)
	ctx.composeImports = parseComposeImportsTsx(ast, filename)
	const plainImports = parsePlainImports(ctx, ast, filename).filter(
		// `parsePlainImports` excludes `.tsrx` compose specifiers; the `.tsx`
		// front end's compose imports need the same exclusion (a composed
		// element's tag identifier is never a free expression name, so an
		// unfiltered import would warn TSRX014).
		imp => !imp.localNames.some(n => ctx.composeImports.has(n)),
	)
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
		return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
	}
	if (fn.async === true) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must not be \`async\` — setup runs synchronously on both halves (the server render function stringifies its result, and the client factory's effect collector is only active for the duration of the call). Await inside an event handler or a client-only setup statement instead.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
	}
	reportDeferredCollectorCalls(ctx, fn)

	const name = identifierName(fn.id) ?? 'Component'
	const params = asArray(fn.params)
	const paramsNode = params[0] ?? null
	if (params.length !== 1 || paramsNode?.type !== 'ObjectPattern') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must take a single destructured args object.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
	}
	const paramNames = new Set<string>()
	collectBoundNames(paramsNode, paramNames)
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property' || !isNode(prop.value)) continue
		if (prop.value.type !== 'AssignmentPattern') continue
		const bindingName = identifierName(prop.value.left)
		if (bindingName && !isOptionalBinding(paramsNode, bindingName))
			ctx.diagnostics.push(
				diagnostic.defaultOnRequiredProp(ctx.source, prop.start, bindingName),
			)
	}

	// Setup = statements before the single return; template = the returned JSX.
	const bodyStmts = asArray((fn.body as TsrxNode).body)
	const returnStmt = bodyStmts.find(
		s => s.type === 'ReturnStatement',
	) as TsrxNode | undefined
	if (!returnStmt || bodyStmts[bodyStmts.length - 1] !== returnStmt || !isNode(returnStmt.argument)) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must end in a single \`return <jsx/>\` (setup statements before it).`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
	}
	const render = returnStmt.argument as TsrxNode
	const setupStmts = bodyStmts.slice(0, -1)

	const setup: SetupStmt[] = []
	const clientSetup: SetupStmt[] = []
	const plainSetup: SetupStmt[] = []
	const signals: SignalIR[] = []
	const signalByName = new Map<string, SignalIR>()
	const setupInits = new Map<string, TsrxNode>()
	const elementRefs = new Map<
		string,
		{
			selectorText: string
			reasonText: string | null
			maybe: boolean
			node: TsrxNode
		}
	>()
	let exposeText: string | null = null
	let exposeRange: SourceRange | null = null
	let exposeArgNode: TsrxNode | null = null
	const exposeProps = new Map<string, string>()
	const exposeKinds = new Map<string, ExposeKind>()
	const exposedPropNames = new Set<string>()
	const parserExposeProps = new Map<
		string,
		{
			parser: string
			fallbackText: string | null
			fallbackNode: TsrxNode | null
		}
	>()
	const exposeAmbients = new Set<string>()
	const contextRefs = new Set<string>()
	const typeCtx: TypeContext = { paramsNode, setupInits }
	for (const stmt of setupStmts) {
		if (stmt.type === 'VariableDeclaration') {
			const declarations = asArray(stmt.declarations)
			const decl = declarations[0] ?? null
			const declName = identifierName(decl?.id)
			if (
				stmt.kind !== 'const' ||
				declarations.length !== 1 ||
				!declName ||
				!isNode(decl?.init)
			) {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						source,
						stmt.start,
						'Setup statements other than single-const declarations',
					),
				)
				continue
			}
			const init = (decl as TsrxNode).init as TsrxNode
			if (identifierName(init.callee) === 'first') {
				const args = asArray(init.arguments)
				const [selectorArg, reasonArg] = args
				const selectorText =
					selectorArg?.type === 'Literal' && typeof selectorArg.value === 'string'
						? selectorArg.value
						: null
				const reasonText =
					reasonArg?.type === 'Literal' && typeof reasonArg.value === 'string'
						? reasonArg.value
						: null
				const validArity = args.length === 1 || args.length === 2
				if (
					!validArity ||
					selectorText === null ||
					(args.length === 2 && reasonText === null)
				)
					ctx.diagnostics.push(
						diagnostic.invalidFirstCall(source, stmt.start, declName),
					)
				else {
					elementRefs.set(declName, {
						selectorText,
						reasonText,
						maybe: args.length === 1,
						node: init,
					})
				}
				continue
			}
			setupInits.set(declName, init)
			const setupStmt: SetupStmt = {
				text: text(ctx.source, stmt),
				range: {
					start: typeof stmt.start === 'number' ? stmt.start : 0,
					end: typeof stmt.end === 'number' ? stmt.end : 0,
				},
				node: init,
				name: declName,
			}
			setup.push(setupStmt)
			if (!/Function(Expression)?$/.test(String(init.type))) {
				const refReads = [...freeIdentifiers(init)]
					.filter(n => elementRefs.has(n))
					.sort()
				if (refReads.length > 0) {
					ctx.routingSignals.push({
						origin: 'TSRX043',
						detail: `\`${declName}\` reads element ref(s) ${refReads.join(', ')} in setup`,
						...lineFields(source, stmt.start),
						resolution: { by: 'realm' },
					})
				}
			}
			const calleeName = identifierName(init.callee)
			if (calleeName === 'requestContext') {
				const args = asArray(init.arguments)
				if (args.length !== 2) {
					ctx.diagnostics.push(
						diagnostic.invalidRequestContextCall(source, stmt.start, declName),
					)
				} else {
					const fallbackNode = args[1] as TsrxNode
					const knownSoFar = new Set([...paramNames, ...setupInits.keys()])
					const badFallbackNames = [...freeIdentifiers(fallbackNode)].filter(
						n => !JS_GLOBALS.has(n) && !knownSoFar.has(n),
					)
					if (badFallbackNames.length > 0) {
						ctx.diagnostics.push(
							diagnostic.contextFallbackNotServerKnown(
								source,
								stmt.start,
								declName,
								badFallbackNames,
							),
						)
					} else {
						const signal: SignalIR = {
							name: declName,
							text: text(ctx.source, init),
							textStart: typeof init.start === 'number' ? init.start : 0,
							constructor: 'requestContext',
							init: fallbackNode,
							inferredType: inferType(fallbackNode, typeCtx),
							fallbackText: text(ctx.source, fallbackNode),
						}
						signals.push(signal)
						signalByName.set(declName, signal)
						contextRefs.add('requestContext')
					}
				}
			} else if (calleeName && SIGNAL_CONSTRUCTORS.has(calleeName)) {
				const args = asArray(init.arguments)
				const computeArg = args[0] ?? null
				const isDerivedCallback =
					(calleeName === 'deriveCell' ||
						calleeName === 'deriveStore' ||
						calleeName === 'createMemo') &&
					isNode(computeArg) &&
					/Function(Expression)?$/.test(computeArg.type)
				const badContextNames = isDerivedCallback
					? [...freeIdentifiers(computeArg as TsrxNode)].filter(n =>
							CONTEXT_NAMES.has(n),
						)
					: []
				if (badContextNames.length > 0) {
					plainSetup.push(setupStmt)
					ctx.routingSignals.push({
						origin: 'TSRX013',
						detail: `\`${declName}\`'s ${calleeName}() compute reads ${badContextNames.join('/')}`,
						...lineFields(source, stmt.start),
						resolution: resolutionOf(init, ctx.serverKnown),
					})
				} else {
					const signal: SignalIR = {
						name: declName,
						text: text(ctx.source, init),
						textStart: typeof init.start === 'number' ? init.start : 0,
						constructor: calleeName as SignalConstructor,
						init: computeArg,
						inferredType: inferType(computeArg, typeCtx),
						fallbackText: null,
					}
					signals.push(signal)
					signalByName.set(declName, signal)
				}
			} else if (init.type === 'ConditionalExpression') {
				const consequentName = identifierName(
					(init.consequent as TsrxNode | undefined)?.callee,
				)
				const alternateName = identifierName(
					(init.alternate as TsrxNode | undefined)?.callee,
				)
				if (
					consequentName &&
					SIGNAL_CONSTRUCTORS.has(consequentName) &&
					alternateName &&
					SIGNAL_CONSTRUCTORS.has(alternateName)
				) {
					ctx.diagnostics.push(
						diagnostic.conditionalSignalConstructor(source, stmt.start, declName),
					)
				} else {
					plainSetup.push(setupStmt)
				}
			} else {
				plainSetup.push(setupStmt)
				const badPrimitives = [...freeIdentifiers(init)]
					.filter(n => CLIENT_ONLY_PRIMITIVES.has(n))
					.sort()
				if (badPrimitives.length > 0) {
					ctx.routingSignals.push({
						origin: 'TSRX013',
						detail: `\`${declName}\` calls client-only primitive(s) ${badPrimitives.join(', ')}`,
						...lineFields(source, stmt.start),
						resolution: resolutionOf(init, ctx.serverKnown),
					})
				}
			}
			continue
		}
		const clientKnownName = (freeName: string): boolean => {
			if (JS_GLOBALS.has(freeName)) return true
			if (CONTEXT_NAMES.has(freeName)) {
				contextRefs.add(freeName)
				return true
			}
			if (signalByName.has(freeName)) return true
			if (exposeAmbients.has(freeName)) return true
			if (elementRefs.has(freeName)) return true
			if (setupInits.has(freeName)) return true
			if (importedNames.has(freeName)) return true
			if (CLIENT_ONLY_PRIMITIVES.has(freeName)) {
				contextRefs.add(freeName)
				return true
			}
			return false
		}
		const expression =
			stmt.type === 'ExpressionStatement'
				? (stmt.expression as TsrxNode | undefined)
				: undefined
		if (
			stmt.type === 'ExpressionStatement' &&
			identifierName(expression?.callee) === 'expose'
		) {
			exposeText = text(ctx.source, expression as TsrxNode)
			exposeRange = {
				start:
					typeof (expression as TsrxNode).start === 'number'
						? ((expression as TsrxNode).start as number)
						: 0,
				end:
					typeof (expression as TsrxNode).end === 'number'
						? ((expression as TsrxNode).end as number)
						: 0,
			}
			const arg = asArray(expression?.arguments)[0] ?? null
			exposeArgNode = arg
			setup.push({
				text: exposeText,
				range: exposeRange,
				node: arg ?? (expression as TsrxNode),
				name: null,
			})
			for (const name of freeIdentifiers(
				arg ??
					({ type: 'ObjectExpression', properties: [] } as unknown as TsrxNode),
			)) {
				if (CONTEXT_NAMES.has(name)) contextRefs.add(name)
			}
			for (const prop of asArray(arg?.properties)) {
				if (prop.type !== 'Property') continue
				const propName = identifierName(prop.key)
				const value = prop.value
				if (propName) exposedPropNames.add(propName)
				if (propName)
					exposeKinds.set(propName, classifyExposeInit(value, signalByName))
				if (
					propName &&
					isNode(value) &&
					value.type === 'MemberExpression' &&
					identifierName(value.property) === 'get'
				) {
					const sigName = identifierName(value.object)
					if (sigName) exposeProps.set(propName, sigName)
				}
				if (propName && isNode(value) && value.type === 'CallExpression') {
					const callee = identifierName(value.callee)
					if (callee && PARSER_FACTORIES.has(callee)) {
						const fallback = asArray(value.arguments)[0] ?? null
						parserExposeProps.set(propName, {
							parser: callee,
							fallbackText: fallback ? text(ctx.source, fallback) : null,
							fallbackNode: fallback,
						})
						exposeAmbients.add(callee)
					} else if (callee === 'defineMethod') {
						exposeAmbients.add(callee)
					}
				}
			}
			continue
		}
		if (stmt.type === 'ExpressionStatement' && expression) {
			const bad = [...freeIdentifiers(expression)].filter(n => !clientKnownName(n))
			if (bad.length === 0) {
				clientSetup.push({
					text: text(ctx.source, stmt),
					range: {
						start: typeof stmt.start === 'number' ? stmt.start : 0,
						end: typeof stmt.end === 'number' ? stmt.end : 0,
					},
					node: expression,
					name: null,
				})
				continue
			}
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				source,
				stmt.start,
				'Setup statements other than const declarations, expose(), and client-only side effects (over host/internals/signals)',
			),
		)
	}

	// Output: a single root element, or a fragment of [root element, <style>?].
	const bareRoot = render.type === 'JSXElement' ? render : null
	if (!bareRoot && render.type !== 'JSXFragment') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the return value must be a single root element, or a fragment (element + <style>).`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
	}
	const fors = new Map<TsrxNode, ForIR>()
	ctx.serverKnown = new Set<string>([...paramNames])
	ctx.argNames = new Set<string>(paramNames)
	for (const s of signals) ctx.serverKnown.add(s.name)
	for (const n of setupInits.keys()) ctx.serverKnown.add(n)
	ctx.setupInits = setupInits
	for (const prop of exposedPropNames) ctx.exposedProps.add(prop)
	for (const prop of exposeProps.keys()) ctx.exposedProps.add(prop)
	for (const prop of parserExposeProps.keys()) {
		ctx.exposedProps.add(prop)
		ctx.parserProps.add(prop)
	}
	ctx.parserFactoryOf = (prop: string): string =>
		parserExposeProps.get(prop)?.parser ?? ''
	ctx.parserFallbackRefsOf = (prop: string): ReadonlySet<string> => {
		const fallback = parserExposeProps.get(prop)?.fallbackNode
		if (!fallback) return EMPTY_NAMES
		return new Set(
			[...freeIdentifiers(fallback)].filter(n => elementRefs.has(n)),
		)
	}
	for (const prop of MANAGED_TEXT_PROPS) ctx.exposedProps.add(prop)

	let root: (TemplateNode & { kind: 'element' }) | null = null
	let styleChild: (TemplateNode & { kind: 'element' }) | null = null
	let css = ''
	let componentRefReasons = new Map<string, string>()
	const unmatchedOptionalRefs: Array<{ name: string; selector: string }> = []
	const deferredComposeRefs: Array<{
		name: string
		selector: string
		maybe: boolean
		offset: number | undefined
	}> = []
	let componentOptionalRefs = new Set<string>()
	{
		const lowered: TemplateNode[] = bareRoot
			? [lowerElement(ctx, bareRoot, signalByName, fors)]
			: lowerChildren(ctx, render, signalByName, fors)
		const templateRoot = lowered.find(
			(n): n is TemplateNode & { kind: 'element' } =>
				n.kind === 'element' && n.tag !== 'style',
		)
		styleChild =
			lowered.find(
				(n): n is TemplateNode & { kind: 'element' } =>
					n.kind === 'element' && n.tag === 'style',
			) ?? null
		root = templateRoot ?? null
		if (!root) {
			ctx.diagnostics.push(
				diagnostic.invalidSource(`${filename}: no root element found in the template return.`),
			)
			return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
		}
		if (!root.tag.includes('-')) {
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					`${filename}: the root element must be the component's custom element tag (got \`${root.tag}\`).`,
				),
			)
			return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }
		}

		// Resolve `first(selector, required)` element references now that
		// `root` exists — VERBATIM block from compiler.ts.
		const refReasons = new Map<string, string>()
		for (const [
			refName,
			{ selectorText, reasonText, maybe, node },
		] of elementRefs) {
			const { elements } = collectMatchingElements(root, selectorText)
			if (elements.length === 0 && namesCustomElementTag(selectorText)) {
				deferredComposeRefs.push({
					name: refName,
					selector: selectorText,
					maybe,
					offset: node.start,
				})
				refReasons.set(refName, reasonText as string)
				continue
			}
			if (elements.length === 0) {
				if (maybe) {
					unmatchedOptionalRefs.push({ name: refName, selector: selectorText })
					continue
				}
				ctx.diagnostics.push(
					diagnostic.firstSelectorNotFound(source, node.start, refName, selectorText),
				)
				continue
			}
			if (!maybe && elements.every(el => inOptionalBranch(root, el)))
				ctx.diagnostics.push(
					diagnostic.deadRequiredReason(source, node.start, refName, selectorText),
				)
			if (elements.length > 1 && !shareExclusiveIf(root, elements)) {
				ctx.diagnostics.push(
					diagnostic.firstSelectorAmbiguous(
						source,
						node.start,
						refName,
						selectorText,
						elements.length,
					),
				)
				continue
			}
			const claimed = elements
				.flatMap(el => el.attrs)
				.find(a => a.kind === 'ref')
			if (claimed) {
				ctx.diagnostics.push(
					diagnostic.firstSelectorDuplicate(
						source,
						node.start,
						refName,
						selectorText,
						claimed.name,
					),
				)
				continue
			}
			for (const element of elements)
				element.attrs.push({ kind: 'ref', name: refName })
			refReasons.set(refName, reasonText as string)
		}
		componentRefReasons = refReasons
		componentOptionalRefs = new Set(
			[...elementRefs].filter(([, entry]) => entry.maybe).map(([n]) => n),
		)

		reportStaticIds(root, source, ctx.diagnostics)

		if (styleChild) {
			const stylesheet = styleElementStylesheet(source, styleChild.node)
			css = dedentCss(String(stylesheet ?? ''))
		}
	}

	// Exported type declarations + declare global, verbatim (reused scans).
	const typeDecls: string[] = []
	let globalDecl: string | null = null
	let propsTypeName: string | null = null
	let config: ConfigIR | null = null
	let i18nMessages: Record<string, string> | null = null
	for (const stmt of asArray(ast.body)) {
		const declaredConfig = readConfig(ctx, stmt)
		if (declaredConfig) {
			config = declaredConfig
			continue
		}
		const declaredI18n = readI18nDecl(ctx, stmt)
		if (declaredI18n) {
			i18nMessages = declaredI18n
			continue
		}
		if (
			stmt.type === 'ExportNamedDeclaration' &&
			isNode(stmt.declaration) &&
			(stmt.declaration.type === 'TSTypeAliasDeclaration' ||
				stmt.declaration.type === 'TSInterfaceDeclaration')
		) {
			typeDecls.push(text(ctx.source, stmt))
			const declName = identifierName(stmt.declaration.id)
			if (declName === `${name}Props`) propsTypeName = declName
		}
		if (stmt.type === 'TSModuleDeclaration' && String(stmt.kind) === 'global')
			globalDecl = text(ctx.source, stmt)
	}

	reportDuplicatedChannels({
		root,
		source,
		diagnostics: ctx.diagnostics,
		argNames: ctx.argNames,
		parserProps: ctx.parserProps,
		parserFactoryOf: ctx.parserFactoryOf,
		parserFallbackRefsOf: ctx.parserFallbackRefsOf,
		formResetProp: config?.form
			? config.form === 'value'
				? 'value'
				: 'checked'
			: null,
	})

	if (i18nMessages)
		walkTemplate(root, node => {
			if (node.kind !== 'text' || !/[A-Za-z]{2}/.test(node.value)) return
			ctx.diagnostics.push(
				diagnostic.untranslatedLiteral(source, node.node?.start, node.value),
			)
		})

	let caseType: 'cardinal' | 'ordinal' | 'union' = 'union'
	{
		let sawType = false
		let proven: 'cardinal' | 'ordinal' | null = null
		let conflicted = false
		walkTemplate(root, node => {
			if (node.kind !== 'element') return
			for (const attr of node.attrs) {
				if (attr.kind !== 'plural-case-type') continue
				sawType = true
				const thisType: 'cardinal' | 'ordinal' | null =
					attr.exprText === '"ordinal"'
						? 'ordinal'
						: attr.exprText === '"cardinal"' || attr.exprText === 'undefined'
							? 'cardinal'
							: null
				if (thisType === null) conflicted = true
				else if (proven === null) proven = thisType
				else if (proven !== thisType) conflicted = true
			}
		})
		if (sawType && !conflicted && proven !== null) caseType = proven
	}

	if (config)
		for (const attr of config.observedAttributes) {
			if (!parserExposeProps.has(attr))
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						source,
						undefined,
						`config.observedAttributes names \`${attr}\`, which is not a Parser-exposed prop — the extension would be inert. Declare it as expose({ ${attr}: asString(…) }).`,
					),
				)
		}

	if (exposeArgNode) {
		for (const prop of asArray(exposeArgNode.properties)) {
			if (prop.type !== 'Property') continue
			const propName = identifierName(prop.key)
			if (propName && RESERVED_PROP_NAMES.has(propName))
				ctx.diagnostics.push(
					diagnostic.reservedExposeName(source, prop.start, propName),
				)
		}
	}

	if (config?.form && exposeArgNode) {
		const defaultPropName =
			config.form === 'value' ? 'defaultValue' : 'defaultChecked'
		const extensionName =
			config.form === 'value' ? 'formAssociated' : 'formAssociatedCheckbox'
		for (const prop of asArray(exposeArgNode.properties)) {
			if (prop.type !== 'Property') continue
			const propName = identifierName(prop.key)
			if (
				propName &&
				(MANAGED_FORM_MEMBERS.has(propName) || propName === defaultPropName)
			)
				ctx.diagnostics.push(
					diagnostic.managedFormMemberShadowed(
						source,
						prop.start,
						propName,
						extensionName,
					),
				)
		}
	}

	if (config?.form) reportNamedFormControls(ctx, root)

	const serverKnown = new Set<string>([...paramNames])
	for (const s of signals) serverKnown.add(s.name)
	for (const n of setupInits.keys()) serverKnown.add(n)

	const plainPlacement = placePlainImports(
		ctx,
		{ root, setup, plainSetup, clientSetup, signals, serverKnown },
		plainImports,
	)
	const leTrucPlacement = placeLeTrucImports(
		ctx,
		{ root, setup, plainSetup, clientSetup, signals, serverKnown },
		leTrucImports,
	)
	const imports = {
		server: [...plainPlacement.server, ...leTrucPlacement.server],
		client: [...plainPlacement.client, ...leTrucPlacement.client],
		serverLocalNames: new Set([
			...plainPlacement.serverLocalNames,
			...leTrucPlacement.serverNames,
		]),
		clientLeTrucNames: leTrucPlacement.clientNames,
		plainLocalNames: new Set(plainImports.flatMap(i => i.localNames)),
	}

	const gated = ctx.diagnostics.some(d => d.code === 'TSRX001')

	return {
		component: gated
			? null
			: {
					name,
					source,
					tag: root.tag,
					paramsText: text(ctx.source, paramsNode),
					paramNames: [...paramNames],
					i18nMessages,
					declaresI18n: declaresI18nOf(paramsNode),
					langBinding: langBindingOf(paramsNode),
					langArgDefault: langArgDefaultOf(paramsNode),
					caseType,
					setup,
					clientSetup,
					plainSetup,
					signals,
					exposeText,
					exposeRange,
					exposeArgNode,
					exposeProps,
					exposeKinds,
					parserExposeProps,
					exposeAmbients: [...exposeAmbients].sort(),
					contextRefs: [...contextRefs].sort(),
					config,
					root,
					refReasons: componentRefReasons,
					unmatchedOptionalRefs,
					deferredComposeRefs,
					optionalRefs: componentOptionalRefs,
					fors,
					css,
					typeDecls,
					globalDecl,
					propsTypeName,
					componentDoc: leadingDocComment(source, fnStmtStart),
					serverKnown,
					imports,
				},
		diagnostics: ctx.diagnostics,
		routingSignals: ctx.routingSignals,
	}
}
