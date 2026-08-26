/**
 * TSRX compiler front end. Everything downstream consumes the component IR
 * produced here. `@tsrx/core` VALUES enter through the `core.ts` pin adapter
 * (pinned 0.1.60, ADR 0023 sub-design 2; LT-040) — a pin upgrade touches
 * only that file and core-shim.d.ts — and the IR type vocabulary shared by
 * the rest of the compiler lives in `ir.ts` (LT-039).
 *
 * Owns parsing (`compileSource`: locate the exported component function
 * whose body is an `@{ }` statement container, slice setup statements,
 * params, and type declarations verbatim). Template lowering lives in
 * `lower-template.ts`, attribute classification in `classify-attributes.ts`,
 * signal type inference in `infer-type.ts`, `export const config` extraction
 * and compose-import resolution in `config.ts`, and shared AST
 * predicates/vocabulary constants in `ast-utils.ts` — this file wires them
 * together.
 */

import type { TsrxNode } from '@tsrx/core'
import {
	asArray,
	CLIENT_ONLY_PRIMITIVES,
	CONTEXT_NAMES,
	collectBoundNames,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	MANAGED_TEXT_PROPS,
	PARSER_FACTORIES,
	SIGNAL_CONSTRUCTORS,
	text,
} from './ast-utils'
import { readConfig } from './config'
import { getStyleElementStylesheet, isStyleElement, parseModule } from './core'
import { dedentCss } from './css'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import {
	parseComposeImports,
	parsePlainImports,
	placePlainImports,
} from './imports'
import { inferType, type TypeContext } from './infer-type'
import type {
	ComponentIR,
	ConfigIR,
	ExtractContext,
	ForIR,
	SetupStmt,
	SignalConstructor,
	SignalIR,
	SourceRange,
	TemplateNode,
} from './ir'
import { lowerChildren } from './lower-template'
import { walkTemplate } from './walk'

/* === Types === */

export type CompileResult = {
	component: ComponentIR | null
	diagnostics: CompileDiagnostic[]
}

/* === Internal Functions === */

/**
 * The doc comment immediately preceding a declaration, sliced verbatim.
 * The whitespace-only guard between comment close and declaration keeps a
 * module-level doc from being mistaken for the component's own when other
 * statements (type declarations, `declare global`) sit in between. Carried
 * above the generated `export default defineComponent(` so CEM extraction
 * (ADR 0023, LT-006) reads the authored description and tags.
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

/**
 * When a parse fails, check the error position for signatures of the NEWER
 * TSRX grammar (statement-form `switch` in templates, the `{html …}`,
 * `{text …}`, `{ref …}` keywords, setup `await`, `component` declarations) —
 * constructs the pinned @tsrx/core 0.1.60 cannot parse at all. The hint
 * turns a bare "Unexpected token" into an actionable diagnosis (pin
 * upgrades are reviewed changes, ADR 0023 sub-design 2).
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
		[/\bswitch\b/, 'statement-form switch'],
		[/\{\s*html\b/, 'the {html expr} keyword'],
		[/\{\s*text\b/, 'the {text expr} keyword'],
		[/\{\s*ref\b/, 'the {ref value} keyword'],
		[/\bawait\b/, 'await'],
		[/^\s*component\b/, 'the component keyword'],
	]
	for (const [pattern, what] of signatures)
		if (pattern.test(around))
			return ` — ${what} is newer TSRX grammar than @tsrx/core 0.1.60 (the latest published release; the tsrx.dev docs track upstream unreleased grammar — see ADR 0023 sub-design 2)`
	return ''
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
		exposedProps: new Set<string>(),
		serverKnown: new Set<string>(),
		composeImports: new Map<string, string>(),
		setupInits: new Map<string, TsrxNode>(),
	}
	let ast: TsrxNode
	try {
		ast = parseModule(source, filename)
	} catch (e) {
		return {
			component: null,
			diagnostics: [
				diagnostic.invalidSource(
					`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}${newerGrammarHint(source, e)}`,
				),
			],
		}
	}
	ctx.composeImports = parseComposeImports(ast, filename)
	const plainImports = parsePlainImports(ctx, ast, filename)

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
				`${filename}: no exported component function with an @{ } container found.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}

	const name = identifierName(fn.id) ?? 'Component'
	const params = asArray(fn.params)
	const paramsNode = params[0] ?? null
	if (params.length !== 1 || paramsNode?.type !== 'ObjectPattern') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must take a single destructured args object.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}
	const paramNames = new Set<string>()
	collectBoundNames(paramsNode, paramNames)

	// Setup statements: const declarations (signals vs. helpers) + expose() +
	// client-only side effects.
	const codeBlock = fn.body as TsrxNode
	const setup: SetupStmt[] = []
	const clientSetup: SetupStmt[] = []
	// Plain (non-signal) setup consts (LT-034 follow-up fix): `component.setup`
	// is emitted verbatim into the SERVER module only (`emit-server.ts`) —
	// this subset also needs emitting into the CLIENT factory, since a plain
	// const is documented (ast-utils.ts, diagnostics.ts) as available in
	// both, but nothing previously emitted it client-side. Signals are
	// excluded (already client-emitted via harvest); `expose()` is excluded
	// (already client-emitted separately).
	const plainSetup: SetupStmt[] = []
	const signals: SignalIR[] = []
	const signalByName = new Map<string, SignalIR>()
	const setupInits = new Map<string, TsrxNode>()
	let exposeText: string | null = null
	let exposeRange: SourceRange | null = null
	let exposeArgNode: TsrxNode | null = null
	const exposeProps = new Map<string, string>()
	const parserExposeProps = new Map<
		string,
		{ parser: string; fallbackText: string | null }
	>()
	const exposeAmbients = new Set<string>()
	const contextRefs = new Set<string>()
	const typeCtx: TypeContext = { paramsNode, setupInits }
	for (const stmt of asArray(codeBlock.body)) {
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
			const calleeName = identifierName(init.callee)
			if (calleeName === 'requestContext') {
				// Consumer side of the context protocol (LT-035, ADR 0024
				// sub-design 15): `const motion = requestContext(MEDIA_MOTION,
				// 'unknown')`. Recognized separately from SIGNAL_CONSTRUCTORS —
				// `requestContext` has no server behavior at all (it dispatches a
				// DOM event against `host`), so the server substitutes the
				// fallback argument as the signal's render-time value instead of
				// running the call (emit-server.ts). The fallback must therefore
				// be resolvable with what's server-known so far (params + prior
				// setup names) — the same names `ctx.serverKnown` is built from.
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
				// deriveCell/deriveStore/createMemo invoke their compute function
				// synchronously at server-render time too (runtime.ts) — a
				// host/internals read inside it would crash, since every signal
				// declaration is re-emitted verbatim into both modules (ADR 0023
				// sub-design 12; surfaced by LT-025's createMemo support).
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
					ctx.diagnostics.push(
						diagnostic.clientOnlySignalCompute(
							source,
							stmt.start,
							declName,
							calleeName,
							badContextNames,
						),
					)
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
				// A ternary between two constructor calls isn't recognized as a
				// signal at all (no single `.callee`) — diagnose it explicitly
				// rather than silently treating it as an ordinary setup const
				// (ADR 0023 sub-design 12).
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
						diagnostic.conditionalSignalConstructor(
							source,
							stmt.start,
							declName,
						),
					)
				} else {
					plainSetup.push(setupStmt)
				}
			} else {
				plainSetup.push(setupStmt)
				// A plain setup const calling a client-only primitive directly —
				// `component.setup` is emitted verbatim into the SERVER render
				// function too, where these don't exist (ADR 0023 sub-design 12).
				const badPrimitives = [...freeIdentifiers(init)]
					.filter(n => CLIENT_ONLY_PRIMITIVES.has(n))
					.sort()
				if (badPrimitives.length > 0) {
					ctx.diagnostics.push(
						diagnostic.clientOnlySetupConst(
							source,
							stmt.start,
							declName,
							badPrimitives,
						),
					)
				}
			}
			continue
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
			// prop → signal from expose({ prop: signal.get })
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
				if (
					propName &&
					isNode(value) &&
					value.type === 'MemberExpression' &&
					identifierName(value.property) === 'get'
				) {
					const sigName = identifierName(value.object)
					if (sigName) exposeProps.set(propName, sigName)
				}
				// Parser-backed attribute-driven props and method producers:
				// the initializer is an ambient factory call, verbatim in the
				// generated client (imports) and shimmed on the server.
				if (propName && isNode(value) && value.type === 'CallExpression') {
					const callee = identifierName(value.callee)
					if (callee && PARSER_FACTORIES.has(callee)) {
						const fallback = asArray(value.arguments)[0] ?? null
						parserExposeProps.set(propName, {
							parser: callee,
							fallbackText: fallback ? text(ctx.source, fallback) : null,
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
			// Client-only setup side effect (LT-008): connect-time statements
			// (`internals?.states.add('clearable')`) whose free names are all
			// client-known — context members, signals, expose ambients, JS
			// globals. The server never runs them: they touch connect-time
			// APIs (ElementInternals, DOM) that don't exist render-time.
			const free = freeIdentifiers(expression)
			const bad: string[] = []
			for (const name of free) {
				if (JS_GLOBALS.has(name)) continue
				if (CONTEXT_NAMES.has(name)) {
					contextRefs.add(name)
					continue
				}
				if (signalByName.has(name)) continue
				if (exposeAmbients.has(name)) continue
				bad.push(name)
			}
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

	// Output: fragment of [root element, <style>?].
	const render = codeBlock.render as TsrxNode | undefined
	if (!render || render.type !== 'JSXFragment') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the @{ } container's output must be a fragment (element + <style>).`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}
	const fors = new Map<TsrxNode, ForIR>()
	// @if conditions validate against server-known names — args and setup
	// declarations, all parsed by this point.
	ctx.serverKnown = new Set<string>([...paramNames])
	for (const s of signals) ctx.serverKnown.add(s.name)
	for (const n of setupInits.keys()) ctx.serverKnown.add(n)
	ctx.setupInits = setupInits
	// Seed the prop set the lift rule consults for TSRX019. `expose()` has
	// been fully parsed by now; `config` has not, so the managed form props
	// are included unconditionally — a string-literal `'validationMessage'`
	// child is the retired spelling whether or not formAssociated() is on.
	for (const prop of exposeProps.keys()) ctx.exposedProps.add(prop)
	for (const prop of parserExposeProps.keys()) ctx.exposedProps.add(prop)
	for (const prop of MANAGED_TEXT_PROPS) ctx.exposedProps.add(prop)

	const lowered = lowerChildren(ctx, render, signalByName, fors)
	const root = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && !isStyleElement(n.node),
	)
	const styleChild = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && isStyleElement(n.node),
	)
	if (!root) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: no root element found in the @{ } output.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}
	if (!root.tag.includes('-')) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the root element must be the component's custom element tag (got \`${root.tag}\`).`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}

	// CSS: verbatim, dedented (see css.ts).
	let css = ''
	if (styleChild) {
		const stylesheet = getStyleElementStylesheet(styleChild.node)
		css = dedentCss(String(stylesheet?.source ?? ''))
	} else {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: expected a <style> block beside the root element.`,
			),
		)
	}

	// Exported type declarations + declare global, verbatim.
	const typeDecls: string[] = []
	let globalDecl: string | null = null
	let propsTypeName: string | null = null
	let config: ConfigIR | null = null
	for (const stmt of asArray(ast.body)) {
		const declaredConfig = readConfig(ctx, stmt)
		if (declaredConfig) {
			config = declaredConfig
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
	// observedAttributes only fires for Parser-backed initializers — a name
	// that is not Parser-exposed would make the extension silently inert.
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

	const serverKnown = new Set<string>([...paramNames])
	for (const s of signals) serverKnown.add(s.name)
	for (const n of setupInits.keys()) serverKnown.add(n)

	const imports = placePlainImports(
		ctx,
		{ root, setup, plainSetup, clientSetup, signals, serverKnown },
		plainImports,
	)

	// A milestone gate (reactive @for) skips the whole file: rendering the
	// remaining markup without the gated construct would be silently wrong.
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
					setup,
					clientSetup,
					plainSetup,
					signals,
					exposeText,
					exposeRange,
					exposeArgNode,
					exposeProps,
					parserExposeProps,
					exposeAmbients: [...exposeAmbients].sort(),
					contextRefs: [...contextRefs].sort(),
					config,
					root,
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
	}
}

/**
 * Every composed (PascalCase) element in a component's template, for
 * cross-file resolution against the corpus-wide registry (ADR 0023
 * sub-design 10). Traversal via `walkTemplate` (LT-042): composition is a
 * boundary (composed children are the child component's own template) and
 * `@pending` arms are not entered — composed elements never carry children
 * yet, so there is nothing to recurse into below one.
 */
export const collectComposeElements = (
	component: ComponentIR,
): Array<TemplateNode & { kind: 'compose' }> => {
	const out: Array<TemplateNode & { kind: 'compose' }> = []
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'compose') out.push(node)
	}
	walkTemplate(component.root, visit, {
		intoCompose: false,
		intoPending: false,
	})
	for (const loop of component.fors.values())
		walkTemplate(loop.output, visit, {
			intoCompose: false,
			intoPending: false,
		})
	return out
}
