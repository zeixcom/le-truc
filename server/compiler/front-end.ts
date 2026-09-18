/**
 * Front-end-shared compiler stages (LT-202, ADR 0032 sub-design 6: the
 * anti-drift half of the dual front-end contract). Both authored surfaces —
 * `.tsrx` (`compiler.ts`) and `.tsx` (`server/compiler/frontend/tsx/compiler-tsx.ts`) —
 * call into the functions below instead of carrying copies, so a change to
 * setup extraction, context seeding, template-output resolution, or the
 * post-lowering validation tail lands on both surfaces at once.
 *
 * The module is front-end-neutral: it never parses (each surface brings its
 * own `parseModule`/`parseTsxModule`) and imports no parser VALUES — only
 * the loose `TsrxNode` structural type (erased at compile time), exactly
 * like `ast-utils.ts`. Node walks are estree-generic, so they run unchanged
 * over either surface's AST.
 */

import type { TsrxNode } from '@tsrx/core'
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
} from './ast-utils'
import { readConfig } from './config'
import { dedentCss } from './css'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import {
	collectMatchingElements,
	inOptionalBranch,
	namesCustomElementTag,
	reportDuplicatedChannels,
	reportStaticIds,
	shareExclusiveIf,
} from './first-refs'
import {
	declaresI18nOf,
	langArgDefaultOf,
	langBindingOf,
	readI18nDecl,
} from './i18n'
import {
	type LeTrucImport,
	type PlainImportIR,
	placeLeTrucImports,
	placePlainImports,
} from './imports'
import {
	inferType,
	isOptionalBinding,
	type TypeContext,
	typeAnnotationForBinding,
	typeOfAnnotation,
} from './infer-type'
import type {
	ComponentIR,
	ComponentParam,
	ConfigIR,
	ExposeKind,
	ExtractContext,
	ForIR,
	SetupStmt,
	SignalConstructor,
	SignalIR,
	SourceRange,
	TemplateNode,
} from './ir'
import { malformedSelectorReason } from './selector-syntax'
import { lineFields, resolutionOf } from './tier'
import { walkTemplate } from './walk'

/* === Types === */

/** One `const name = first(selector, required?)` element reference (LT-055). */
export type ElementRefEntry = {
	selectorText: string
	reasonText: string | null
	maybe: boolean
	node: TsrxNode
}

/** One Parser-backed expose() initializer (`prop: asString(…)`). */
export type ParserExposeEntry = {
	parser: string
	fallbackText: string | null
	fallbackNode: TsrxNode | null
}

/**
 * Everything the setup-statement loop extracts. `signalByName` is the
 * lowered-template lookup map (not an IR field — the IR carries `signals`
 * and `exposeProps` etc.); the rest map 1:1 onto `ComponentIR` fields.
 */
export type SetupExtraction = {
	setup: SetupStmt[]
	clientSetup: SetupStmt[]
	plainSetup: SetupStmt[]
	signals: SignalIR[]
	signalByName: Map<string, SignalIR>
	setupInits: Map<string, TsrxNode>
	elementRefs: Map<string, ElementRefEntry>
	exposeText: string | null
	exposeRange: SourceRange | null
	exposeArgNode: TsrxNode | null
	exposeProps: Map<string, string>
	exposeKinds: Map<string, ExposeKind>
	exposedPropNames: Set<string>
	parserExposeProps: Map<string, ParserExposeEntry>
	exposeAmbients: Set<string>
	contextRefs: Set<string>
}

/** The component function's destructured args parameter, extracted. */
export type ComponentParams = {
	paramsNode: TsrxNode | null
	paramNames: Set<string>
	/**
	 * The authored second (factory-context) parameter, when present — the
	 * `.tsx` precision convention (LT-209; `.tsrx` keeps the ambient
	 * vocabulary). Already validated by `extractParams`: a destructured
	 * object whose bound names are all factory-context vocabulary. The
	 * generated factory destructures the SAME names from its own context,
	 * so body lowering is unchanged. `annotationName` is the written type's
	 * name when it names `FactoryContext`/`FormFactoryContext` — the input
	 * to TSRX050's surface check (which needs `config`, known later).
	 */
	contextParam: {
		names: ReadonlySet<string>
		annotationName: 'FactoryContext' | 'FormFactoryContext' | null
	} | null
}

/** Template-output resolution: the root, the style block, and the CSS. */
export type ResolvedTemplate = {
	root: TemplateNode & { kind: 'element' }
	styleChild: (TemplateNode & { kind: 'element' }) | null
	css: string
	refReasons: Map<string, string>
	unmatchedOptionalRefs: Array<{ name: string; selector: string }>
	deferredComposeRefs: Array<{
		name: string
		selector: string
		maybe: boolean
		offset: number | undefined
	}>
	optionalRefs: Set<string>
}

/** Module-level declarations beside the component function. */
export type ModuleDecls = {
	typeDecls: string[]
	globalDecl: string | null
	propsTypeName: string | null
	config: ConfigIR | null
	i18nMessages: Record<string, string> | null
}

/* === Internal Functions === */

/** Shared empty result for the `parserFallbackRefsOf` context hook. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

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
 * Report every malformed `first()`/`all()` selector in the module (TSRX026,
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
	ast: TsrxNode,
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
 * function in the component body (TSRX045, LT-157d, ADR 0028 sub-design 5).
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
	fn: TsrxNode,
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
 * - TSRX036: a `REAL_EXPORT_NAMES` identifier is read somewhere in the
 *   module but not imported from `'@zeix/le-truc'` — the first read
 *   position is reported.
 * - TSRX037: a FactoryContext member (`FACTORY_CONTEXT_MEMBERS` ∪
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

/** Signal constructors whose result is MUTABLE, hence Slot-backed. */
const MUTABLE_SIGNAL_CONSTRUCTORS: ReadonlySet<string> = new Set<string>([
	'createCell',
	'createState',
	'createList',
	'createStore',
])

/**
 * Which of `#setAccessor`'s three landings an `expose()` initializer takes
 * (LT-158) — see `ExposeKind`. One-sided on purpose: everything unrecognized
 * classifies as `slot`, the answer that raises no diagnostic, so a shape this
 * compiler has not met falls through to the Tier 2 runtime check instead of
 * failing a build on a guess (ADR 0028 sub-design 1).
 */
const classifyExposeInit = (
	value: unknown,
	signalByName: ReadonlyMap<string, SignalIR>,
): ExposeKind => {
	if (!isNode(value)) return 'slot'
	// `defineMethod(…)` → a plain member; `asString(…)` and friends → the
	// Parser's RESULT reaches `#setAccessor`, so a Parser is Slot-backed.
	if (value.type === 'CallExpression') {
		const callee = identifierName(value.callee)
		if (callee === 'defineMethod') return 'method'
		return 'slot'
	}
	// `sig.get` — a bare function, so `deriveCell` wraps it read-only
	// however mutable `sig` is. The single most common expose shape in the
	// corpus, and the one ADR 0011's motivating example is built on.
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
	// `{ get, set }` is a SlotDescriptor; a `get`-only object literal is
	// one too (`isSlotDescriptor` requires only `get`), but it can never be
	// written through, so it is reported as read-only.
	if (value.type === 'ObjectExpression') {
		const keys = asArray(value.properties)
			.filter(prop => prop.type === 'Property')
			.map(prop => identifierName(prop.key))
		if (keys.includes('get')) return keys.includes('set') ? 'slot' : 'computed'
		return 'slot'
	}
	// A bare signal identifier: mutable constructors give a Slot, derived
	// ones do not.
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
 * Report a `name` (static or bound) on a descendant `input`/`select`/
 * `textarea`/`button` inside a form-associated component's template
 * (LT-059, CHECKLIST §7): the inner control stays out of NATIVE form
 * submission only because it's unnamed — the host submits via
 * `setFormValue` instead. A named inner control submits the field TWICE:
 * once via `setFormValue`, once natively. The markup looks entirely
 * reasonable and the failure is server-side (a duplicate form field) and
 * invisible in the browser, so this is a compiler error, not a doc note.
 *
 * Walks the already-lowered template IR (post-lowering) directly —
 * `kind: 'element'` nodes only; composed children are the child's own
 * template, a boundary, same as `first-refs.ts`'s `collectMatchingElements`.
 * Only `static`/`server`/`reactive` attribute kinds represent a real HTML
 * `name` value; `ref`/`event`/`pass`/etc. carry a `.name` field with a
 * different meaning (a JS binding or event name) and must not match.
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
						diagnostic.formControlHasName(
							ctx.source,
							node.node.start,
							node.tag,
						),
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
		// 'compose', 'text', 'expr', 'client-stmt' — nothing to check/recurse.
	}
	visit(root)
}

/* === Exported Functions === */

/**
 * Validate the component function's parameter list: exactly one destructured
 * args object (TSRX008) — plus, per the LT-209 convention, an optional
 * second, author-annotated factory-context parameter. Pushes the diagnostic
 * and returns null otherwise. A destructured default paired with a
 * non-optional type is TSRX032 (CHECKLIST §10): the type annotation is what
 * callers see, and it says the prop is required, so the default is
 * unreachable for any external caller.
 */
export const extractParams = (
	ctx: ExtractContext,
	filename: string,
	fn: TsrxNode,
): ComponentParams | null => {
	const params = asArray(fn.params)
	const paramsNode = (params[0] as TsrxNode | undefined) ?? null
	if (params.length > 2 || paramsNode?.type !== 'ObjectPattern') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must take a single destructured args object (plus, optionally, a typed factory-context parameter: \`, { host, expose }: FactoryContext<Props>\`).`,
			),
		)
		return null
	}
	const paramNames = new Set<string>()
	if (paramsNode) collectBoundNames(paramsNode, paramNames)
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property' || !isNode(prop.value)) continue
		if (prop.value.type !== 'AssignmentPattern') continue
		const bindingName = identifierName(prop.value.left)
		if (bindingName && !isOptionalBinding(paramsNode, bindingName))
			ctx.diagnostics.push(
				diagnostic.defaultOnRequiredProp(ctx.source, prop.start, bindingName),
			)
	}

	// The factory-context parameter (LT-209): the author's opt IN to precise
	// context typing. Names shadow the profile ambients at function scope;
	// the compiler only validates the vocabulary — the generated factory
	// destructures the same names, so body lowering is unchanged. Type-only
	// imports of the annotation never reach generated output
	// (`parseLeTrucImports` skips type-only statements; TSRX037 keeps the
	// vocabulary out of value imports).
	let contextParam: ComponentParams['contextParam'] = null
	const contextNode = (params[1] as TsrxNode | undefined) ?? undefined
	if (contextNode !== undefined) {
		if (contextNode.type !== 'ObjectPattern') {
			ctx.diagnostics.push(
				diagnostic.invalidSource(
					`${filename}: the factory-context parameter must be a destructured object: \`, { host, expose }: FactoryContext<Props>\`.`,
				),
			)
			return null
		}
		const names = new Set<string>()
		collectBoundNames(contextNode, names)
		const bad = [...names].filter(
			n => !FACTORY_CONTEXT_MEMBERS.has(n) && !CONTEXT_NAMES.has(n),
		)
		if (bad.length > 0) {
			ctx.diagnostics.push(
				diagnostic.badFactoryContextParam(ctx.source, contextNode.start, bad),
			)
			return null
		}
		contextParam = {
			names,
			annotationName: contextAnnotationName(fn, contextNode),
		}
	}
	return { paramsNode, paramNames, contextParam }
}

/**
 * The written type's name for the factory-context parameter's annotation —
 * `FactoryContext`/`FormFactoryContext` when the annotation names either
 * (bare or generic), null for anything else (an inline type literal, an
 * alias the compiler cannot see through — nothing to check against, the
 * same don't-flag-what-you-can't-see posture as `isOptionalBinding`).
 *
 * Two AST shapes carry it: the `.tsx` converter strips type annotations
 * but attaches the original TypeScript function node (`tsNode`), whose
 * parameter's type reads back as text — duck-typed, so this shared module
 * never imports `typescript` (browser purity, ADR 0025 sub-design 6). The
 * `.tsrx` parser keeps an estree-shaped `typeAnnotation` on the node.
 */
const contextAnnotationName = (
	fn: TsrxNode,
	contextNode: TsrxNode,
): 'FactoryContext' | 'FormFactoryContext' | null => {
	const written = (
		fn as {
			tsNode?: {
				parameters?: ReadonlyArray<{
					type?: { getText?: () => string }
				}>
			}
		}
	).tsNode?.parameters?.[1]?.type?.getText?.()
	if (typeof written === 'string') {
		const name = /^([A-Za-z_$][\w$]*)/.exec(written)?.[1]
		if (name === 'FactoryContext' || name === 'FormFactoryContext') return name
		return null
	}
	if (isNode(contextNode.typeAnnotation)) {
		const wrapped = contextNode.typeAnnotation as TsrxNode
		const literal =
			wrapped.type === 'TSTypeAnnotation' && isNode(wrapped.typeAnnotation)
				? (wrapped.typeAnnotation as TsrxNode)
				: wrapped
		if (literal.type === 'TSTypeReference') {
			const name = identifierName(literal.typeName)
			if (name === 'FactoryContext' || name === 'FormFactoryContext')
				return name
		}
	}
	return null
}

/**
 * The setup-statement extraction loop, shared verbatim by both front ends
 * (LT-202). Classifies each statement: single-const declarations (signals
 * vs. helpers), `first()` element references, `expose()`, and client-only
 * side effects — everything else is diagnosed. ADR 0029's setup routing
 * signals (TSRX013/TSRX043 shapes) are pushed here, at the same sites that
 * raised the pre-LT-165 diagnostics.
 *
 * `importedNames` are the authored import bindings (plain or real
 * `@zeix/le-truc` exports, LT-088) — a bare client-only setup statement
 * (e.g. `throttle()` inside a `watch(() => el, () => { ... })` connect-time
 * effect) can freely reference either kind: `imports.ts`'s placement
 * inference already walks `clientSetup` free names
 * (`computeClientNeededNames`) to decide where each import lands, so a name
 * recognized here is guaranteed to resolve once emitted, exactly like
 * `setupInits`/`elementRefs` before it.
 */
export const extractSetup = (
	ctx: ExtractContext,
	setupStmts: TsrxNode[],
	paramsNode: TsrxNode | null,
	paramNames: ReadonlySet<string>,
	importedNames: ReadonlySet<string>,
): SetupExtraction => {
	const source = ctx.source
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
	/**
	 * `const name = first(selector, required)` declarations (LT-055),
	 * pending post-lowering resolution — the template doesn't exist yet at
	 * this point in the setup-statement loop (lowering runs later), and
	 * structurally matching the selector against template elements needs
	 * the template. Resolved once `root` exists, in `resolveTemplateOutput`.
	 * `maybe` marks the one-literal OPTIONAL form (LT-123), which
	 * is verified only where the template can speak to it.
	 */
	const elementRefs = new Map<string, ElementRefEntry>()
	let exposeText: string | null = null
	let exposeRange: SourceRange | null = null
	let exposeArgNode: TsrxNode | null = null
	const exposeProps = new Map<string, string>()
	const exposeKinds = new Map<string, ExposeKind>()
	/** Every name `expose()` declares — see the loop below. */
	const exposedPropNames = new Set<string>()
	const parserExposeProps = new Map<string, ParserExposeEntry>()
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
			// `first(selector, required)` element reference (LT-055, replacing
			// `ref={}`): doesn't exist server-side and has no server
			// substitution the way `requestContext` does, so it must never
			// reach `setup`/`setupInits`/`serverKnown` at all — a name known
			// there but never actually declared server-side would suppress the
			// `exposeArgNode` `any`-stub below for a name that genuinely needs
			// it (same as `ref={}` names, which never entered these either).
			// Handled entirely separately, before the generic push/set below.
			if (identifierName(init.callee) === 'first') {
				const args = asArray(init.arguments)
				const [selectorArg, reasonArg] = args
				const selectorText =
					selectorArg?.type === 'Literal' &&
					typeof selectorArg.value === 'string'
						? selectorArg.value
						: null
				const reasonText =
					reasonArg?.type === 'Literal' && typeof reasonArg.value === 'string'
						? reasonArg.value
						: null
				// One literal (a selector alone) is the OPTIONAL form
				// (LT-123): the reference may be absent at activation
				// and effects over it register under a presence guard.
				// Two literals (selector + required-reason) is the
				// required form. Anything else is TSRX025.
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
			// LT-125: this statement is now bound for the SERVER render function
			// too (`emit-server.ts` re-declares `component.setup` verbatim), so
			// an initializer that reads a `first()`-bound ref evaluates where no
			// DOM exists. Reported here, at the push, rather than in the
			// branches below, because it holds for every initializer shape
			// alike — signal constructor, requestContext, or plain.
			//
			// A FUNCTION initializer is exempt: a setup helper is defined but
			// never called server-side, so its ref reads never evaluate (that is
			// form-spinbutton's `commit`/`typed`/`stepBy`, and rejecting it would
			// reject the corpus). Everything else is evaluated, including a
			// compute thunk handed to a derived constructor.
			if (!/Function(Expression)?$/.test(String(init.type))) {
				const refReads = [...freeIdentifiers(init)]
					.filter(n => elementRefs.has(n))
					.sort()
				if (refReads.length > 0) {
					// ADR 0029 sub-design 5 (LT-165 step 5): a ROUTING SIGNAL,
					// not a diagnostic. The realm has a real DOM, so the ref
					// read the value harness could not evaluate is exactly what
					// phase 2 answers — and the component routes Simulated so
					// the tier-aware emit drops the statement from the server
					// module instead of refusing the file.
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
					// ADR 0029 sub-design 5 (LT-165 step 5): a ROUTING SIGNAL,
					// not a diagnostic — `host`/`internals` resolve in the
					// realm, which is the whole difference between the harness
					// and phase 2. The declaration still has to exist somewhere
					// the component can run it: registered as a plain setup
					// const, so the generated CLIENT module emits it when its
					// name is needed (`computeClientNeededNames`), while the
					// Simulated-tier server module drops it (`retainReferenced`
					// — no server-known name can reach the markup).
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
				// the value harness cannot run it (ADR 0023 sub-design 12).
				// ADR 0029 sub-design 5 (LT-165 step 5): a ROUTING SIGNAL, not
				// a diagnostic — the const already sits in `plainSetup`, so the
				// generated CLIENT module emits it when needed and the
				// Simulated-tier server module drops it.
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
		// React's component-return idiom (LT-054): the template is the surface
		// module's output expression, not a `return` in setup. Diagnosed with
		// a dedicated fix-it rather than falling through to the generic
		// "unsupported statement" message below.
		if (
			stmt.type === 'ReturnStatement' &&
			isNode((stmt as TsrxNode).argument) &&
			['JSXElement', 'JSXFragment'].includes(
				String(((stmt as TsrxNode).argument as TsrxNode).type),
			)
		) {
			ctx.diagnostics.push(diagnostic.reactReturnJsx(source, stmt.start))
			continue
		}
		// The client-only free-name gate (LT-008, widened by LT-069/087/088):
		// a name resolves client-side when it is a JS global, a context
		// member, a signal, an expose ambient, a `first()`-bound element
		// local, an earlier setup const, a composed-element ref, an authored
		// import binding, or a client-only FactoryContext primitive (watch/
		// on/pass/…). Used by bare client-only expression statements.
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
				// EVERY declared prop name, whatever its initializer
				// shape. The two maps below only record the initializer
				// KINDS they each lower (signal getters, Parser
				// factories) — a prop harvested straight from the DOM
				// (`label: labelSpan.textContent ?? ''`) is neither, so
				// before LT-122 it was exposed at runtime but invisible
				// to the compiler, which `ExtractContext.exposedProps`
				// already claimed to list ("prop names `expose()`
				// declares").
				if (propName) exposedPropNames.add(propName)
				// LT-158: which of `#setAccessor`'s three landings this
				// initializer takes, so another file's `pass={{ }}` can be
				// decided against it. Default `slot` — the shape that makes
				// no diagnostic — so an initializer this classifier does not
				// recognize falls back to the Tier 2 runtime check rather
				// than failing a build on a guess.
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
			// Client-only setup side effect (LT-008): connect-time statements
			// (`internals?.states.add('clearable')`) whose free names are all
			// client-known — context members, signals, expose ambients, JS
			// globals, earlier plain setup consts, `first()`-bound element
			// locals, `ref={}`-bound composed-element locals (LT-087), and the
			// `watch`/`on`/`pass` ambients (LT-069) — those touch connect-time
			// APIs (ElementInternals, DOM, ResizeObserver/pointer capture) that
			// don't exist render-time, same posture as the pre-existing cases.
			// A plain-const reference is picked up client-side automatically:
			// `imports.ts`'s `computeClientNeededNames` already walks
			// `clientSetup` nodes' free names into its plain-setup fixpoint.
			const bad = [...freeIdentifiers(expression)].filter(
				n => !clientKnownName(n),
			)
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
	return {
		setup,
		clientSetup,
		plainSetup,
		signals,
		signalByName,
		setupInits,
		elementRefs,
		exposeText,
		exposeRange,
		exposeArgNode,
		exposeProps,
		exposeKinds,
		exposedPropNames,
		parserExposeProps,
		exposeAmbients,
		contextRefs,
	}
}

/**
 * Seed the extraction context from the setup extraction: the server-known
 * name set (args + signals + setup consts), the caller-supplied arg names
 * LT-122 consults alone, the exposed-prop set the lift rule consults for
 * TSRX019, and the Parser hooks. Runs after setup extraction and before
 * template lowering.
 *
 * `config` has not been parsed yet when the managed form props are included
 * unconditionally — a string-literal `'validationMessage'` child is the
 * retired spelling whether or not formAssociated() is on.
 */
export const seedExtractionContext = (
	ctx: ExtractContext,
	{
		paramNames,
		extraction,
	}: {
		paramNames: ReadonlySet<string>
		extraction: SetupExtraction
	},
): void => {
	// @if conditions validate against server-known names — args and setup
	// declarations, all parsed by this point. `isPending` is included: the
	// server harness always provides it (the generated module binds it from
	// the harness whenever its emitted text references it), so a reactive
	// thunk reading `isPending(knownSignal)` folds server-side. This does
	// NOT reopen `@if` over signals — `validateCondition` diagnoses signal
	// reads before the unknown-name check.
	ctx.serverKnown = new Set<string>([...paramNames, 'isPending'])
	// LT-122 consults the caller-supplied names alone (see
	// `ExtractContext.argNames`), so they are kept apart from the
	// signals/setup consts folded into `serverKnown` below.
	ctx.argNames = new Set<string>(paramNames)
	for (const s of extraction.signals) ctx.serverKnown.add(s.name)
	for (const n of extraction.setupInits.keys()) ctx.serverKnown.add(n)
	ctx.setupInits = extraction.setupInits
	for (const prop of extraction.exposedPropNames) ctx.exposedProps.add(prop)
	for (const prop of extraction.exposeProps.keys()) ctx.exposedProps.add(prop)
	for (const prop of extraction.parserExposeProps.keys()) {
		ctx.exposedProps.add(prop)
		ctx.parserProps.add(prop)
	}
	ctx.parserFactoryOf = (prop: string): string =>
		extraction.parserExposeProps.get(prop)?.parser ?? ''
	ctx.parserFallbackRefsOf = (prop: string): ReadonlySet<string> => {
		const fallback = extraction.parserExposeProps.get(prop)?.fallbackNode
		if (!fallback) return EMPTY_NAMES
		return new Set(
			[...freeIdentifiers(fallback)].filter(n => extraction.elementRefs.has(n)),
		)
	}
	for (const prop of MANAGED_TEXT_PROPS) ctx.exposedProps.add(prop)
}

/**
 * Resolve the lowered template output: the root element (which must be the
 * component's custom element tag), the optional `<style>` block, and the
 * `first()`/`all()` element-reference resolution (LT-055) against that
 * template — structurally matching each author selector and attaching a
 * synthetic `{kind: 'ref', name}` to every matched element, the exact IR
 * shape `ref={}` used to populate directly. Every downstream consumer
 * (addQuery's naming in `analysis/effects.ts` and `analysis/harvest.ts`,
 * refNames collection in `analysis/plan.ts`) is unchanged: only how that IR
 * gets populated moved. Also runs TSRX042 (LT-131, static ids duplicate per
 * instance) and extracts the CSS verbatim via `stylesheetOf`.
 *
 * `outputShapeLabel` names the surface's output shape in the no-root
 * message: `the @{ } output` (.tsrx) / `the template return` (.tsx).
 * Returns null (with the diagnostic pushed) when no root element exists.
 */
export const resolveTemplateOutput = (
	ctx: ExtractContext,
	filename: string,
	extraction: SetupExtraction,
	lowered: TemplateNode[],
	stylesheetOf: (node: TsrxNode) => string,
	outputShapeLabel: string,
): ResolvedTemplate | null => {
	const source = ctx.source
	const templateRoot = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && n.tag !== 'style',
	)
	const styleChild =
		lowered.find(
			(n): n is TemplateNode & { kind: 'element' } =>
				n.kind === 'element' && n.tag === 'style',
		) ?? null
	const root = templateRoot ?? null
	if (!root) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: no root element found in ${outputShapeLabel}.`,
			),
		)
		return null
	}
	if (!root.tag.includes('-')) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the root element must be the component's custom element tag (got \`${root.tag}\`).`,
			),
		)
		return null
	}

	// Resolve `first(selector, required)` element references (LT-055) now
	// that `root` exists.
	const refReasons = new Map<string, string>()
	const unmatchedOptionalRefs: Array<{ name: string; selector: string }> = []
	const deferredComposeRefs: Array<{
		name: string
		selector: string
		maybe: boolean
		offset: number | undefined
	}> = []
	for (const [
		refName,
		{ selectorText, reasonText, maybe, node },
	] of extraction.elementRefs) {
		const { elements } = collectMatchingElements(root, selectorText)
		if (elements.length === 0 && namesCustomElementTag(selectorText)) {
			// A selector naming a custom-element tag that matched no raw
			// element may still address a COMPOSED child, whose tag this
			// single-file pass cannot know (LT-127). Defer the whole
			// decision — match, no match, ambiguity — to the pass that
			// has the compose registry; deciding here would mean
			// rejecting a selector that is about to resolve.
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
			// An OPTIONAL ref is allowed to match nothing here
			// (LT-123): "may be absent" includes "the page, not
			// this template, authors it". The structural proof
			// TSRX026 rests on — the compiler wrote this HTML,
			// so counting matches in the IR is counting matches
			// in the DOM — simply has nothing to say about
			// markup the component didn't render, so the client
			// queries the authored selector as-is.
			if (maybe) {
				unmatchedOptionalRefs.push({
					name: refName,
					selector: selectorText,
				})
				continue
			}
			ctx.diagnostics.push(
				diagnostic.firstSelectorNotFound(
					source,
					node.start,
					refName,
					selectorText,
				),
			)
			continue
		}
		// A REQUIRED ref (two literals) whose only match sits in
		// a branch that may not render is required in name only
		// — the analysis addresses it with a non-throwing query
		// under a presence guard either way (LT-008/LT-025), so
		// the authored reason can never be thrown. Say so
		// rather than dropping the string silently: for a
		// template-OWNING component the compiler controls the
		// markup, so a required-reason only ever earns its keep
		// on a selector that may match markup this component
		// did not itself render.
		if (!maybe && elements.every(el => inOptionalBranch(root, el)))
			ctx.diagnostics.push(
				diagnostic.deadRequiredReason(
					source,
					node.start,
					refName,
					selectorText,
				),
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
		// Two `first()` names resolving to the same element is a
		// mistake the IR cannot represent (LT-132): `attrs` is a
		// list, but every consumer reads the ref with `.find()`,
		// so the second name would silently never become a query.
		const claimed = elements.flatMap(el => el.attrs).find(a => a.kind === 'ref')
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

	// TSRX042 (LT-131): a constant `id` in a template duplicates as
	// soon as a page places the component twice. Runs here, beside
	// TSRX039, for the same reason — the walk needs `root`.
	reportStaticIds(root, source, ctx.diagnostics)

	// CSS: verbatim, dedented (see css.ts).
	const css = styleChild ? dedentCss(stylesheetOf(styleChild.node)) : ''

	return {
		root,
		styleChild,
		css,
		refReasons,
		unmatchedOptionalRefs,
		deferredComposeRefs,
		optionalRefs: new Set(
			[...extraction.elementRefs]
				.filter(([, entry]) => entry.maybe)
				.map(([name]) => name),
		),
	}
}

/**
 * Module-level declarations beside the component function: exported type
 * declarations and `declare global`, verbatim; `export const config`;
 * `export const i18n` (ADR 0030 sub-design 4, LT-173).
 */
export const readModuleDecls = (
	ctx: ExtractContext,
	ast: TsrxNode,
	componentName: string,
): ModuleDecls => {
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
			if (declName === `${componentName}Props`) propsTypeName = declName
		}
		if (stmt.type === 'TSModuleDeclaration' && String(stmt.kind) === 'global')
			globalDecl = text(ctx.source, stmt)
	}
	return { typeDecls, globalDecl, propsTypeName, config, i18nMessages }
}

/**
 * The post-lowering validation tail, shared by both front ends. Runs after
 * `resolveTemplateOutput` and `readModuleDecls` because every check below
 * needs `root`, `config`, or `exposeArgNode`:
 *
 * - TSRX039 (LT-122): one value, two channels. Skips the ROOT element (the
 *   root is the host, so a Parser prop rendered as its attribute is the
 *   correct channel) and the sanctioned override (LT-141); a
 *   `formAssociated()`/`formAssociatedCheckbox()` host's reserved prop
 *   (`value`/`checked`) is a third exclusion — the root's own content
 *   attribute is the reset baseline, not a duplicate copy.
 * - TSRX047 (LT-173, ADR 0030 sub-design 4): literal prose inside a
 *   component that declared `export const i18n`. Author-fixable, so a
 *   genuine compile warning that converges to zero — unlike a missing
 *   translation, which rides the build report's translation census instead.
 *   Two or more adjacent letters is the prose test: a single-letter fragment
 *   (basic-pluralize's `s` suffix spans) is per-instance page data, not
 *   catalog material.
 * - The static `truc:case-type` configuration (LT-190) for the translation
 *   census's reachability filter (effects/i18n.ts).
 * - `config.observedAttributes` must name Parser-exposed props only — a
 *   name that is not Parser-exposed would make the extension silently
 *   inert.
 * - TSRX028 (LT-157a): an expose() key that is a reserved word or Object
 *   builtin. Ungated: the runtime throws `InvalidPropertyNameError` before
 *   its `prop in this` guard, and since LT-155 contains that throw, this
 *   rule is what the author actually sees.
 * - The TSRX010 family (LT-058): a form-associated component's expose()
 *   naming a member the extension installs on the prototype — silently
 *   shadows it at the JS level. `value`/`checked` (config.form) are the
 *   deliberate exceptions the component MUST expose; the variant's own
 *   reset-baseline prop (`defaultValue`/`defaultChecked`, LT-057) is
 *   reserved too.
 * - LT-059: a form-associated component's inner native control must have
 *   no `name`.
 *
 * Returns the caseType configuration the IR carries.
 */
export const validateLoweredComponent = (
	ctx: ExtractContext,
	{
		root,
		config,
		i18nMessages,
		extraction,
	}: {
		root: TemplateNode & { kind: 'element' }
		config: ConfigIR | null
		i18nMessages: Record<string, string> | null
		extraction: SetupExtraction
	},
): 'cardinal' | 'ordinal' | 'union' => {
	const source = ctx.source
	const exposeArgNode = extraction.exposeArgNode

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

	// LT-190: a literal `'ordinal'`/`'cardinal'` — or an explicit
	// `undefined`, which is cardinal by Intl's own default — proves the
	// pruning type; a dynamic expression (basic-pluralize's
	// `ordinal ? 'ordinal' : undefined`) or no declaration at all stays
	// `'union'`, the runtime's own fallback, so the census only skips
	// categories NEITHER configuration reaches in a locale.
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
			if (!extraction.parserExposeProps.has(attr))
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

	return caseType
}

/**
 * Per-parameter pattern facts for the page-occurrence renderer (LT-194):
 * `emit-server.ts`'s `argsFromAttrs` emission decides, from these, whether
 * an authored occurrence's attribute can source each server arg — a raw
 * string only passes for a `string`-annotated non-Parser arg, and an absent
 * attribute only omits the key when the pattern marks the arg optional or
 * defaulted. Everything else leaves the occurrence unrenderable rather than
 * silently re-typed.
 */
const paramPropsOf = (
	ctx: ExtractContext,
	paramsNode: TsrxNode | null,
): ComponentParam[] => {
	if (!paramsNode || paramsNode.type !== 'ObjectPattern') return []
	const props: ComponentParam[] = []
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property') continue
		const name = identifierName(prop.key)
		if (!name || !isNode(prop.value)) continue
		const value = prop.value
		const annotation = typeAnnotationForBinding(paramsNode, name)
		const annotationText = annotation
			? text(
					ctx.source,
					annotation.type === 'TSTypeAnnotation' &&
						isNode(annotation.typeAnnotation)
						? (annotation.typeAnnotation as TsrxNode)
						: annotation,
				)
			: 'unknown'
		props.push({
			name,
			typeText: annotationText,
			optional: isOptionalBinding(paramsNode, name),
			hasDefault: value.type === 'AssignmentPattern',
			isString: annotation ? typeOfAnnotation(annotation) === 'string' : false,
		})
	}
	return props
}

/**
 * The final `ComponentIR` assembly, shared by both front ends. `gated`
 * (the reactive-@for milestone gate) skips the whole file: rendering the
 * remaining markup without the gated construct would be silently wrong.
 * Returns null when the file is gated — the diagnostics are already on the
 * context.
 */
export const assembleComponentIR = (
	ctx: ExtractContext,
	{
		componentName,
		fnStmtStart,
		paramsNode,
		paramNames,
		contextParam,
		extraction,
		resolved,
		decls,
		caseType,
		plainImports,
		leTrucImports,
	}: {
		componentName: string
		fnStmtStart: number
		paramsNode: TsrxNode | null
		paramNames: ReadonlySet<string>
		contextParam: ComponentParams['contextParam']
		extraction: SetupExtraction
		resolved: ResolvedTemplate & { fors: Map<TsrxNode, ForIR> }
		decls: ModuleDecls
		caseType: 'cardinal' | 'ordinal' | 'union'
		plainImports: PlainImportIR[]
		leTrucImports: LeTrucImport[]
	},
): ComponentIR | null => {
	// The annotation-surface check (TSRX050, LT-209) — `config` is what the
	// extract-time vocabulary check could not see. Runs before the gate so
	// the diagnostic lands even on gated files (the TSRX014 posture).
	if (contextParam?.annotationName) {
		const formAssociated = !!decls.config?.form
		if (formAssociated && contextParam.annotationName === 'FactoryContext')
			ctx.diagnostics.push(
				diagnostic.formContextMismatch(ctx.source, 'FactoryContext'),
			)
		else if (
			!formAssociated &&
			contextParam.annotationName === 'FormFactoryContext'
		)
			ctx.diagnostics.push(
				diagnostic.formContextMismatch(ctx.source, 'FormFactoryContext'),
			)
	}
	// The same set `seedExtractionContext` built into `ctx.serverKnown`
	// (args + `isPending` + signals + setup consts) — reused, not recomputed:
	// a second construction could drift from the first and make lowering and
	// downstream analysis silently disagree (LT-222). `isPending` itself is
	// server-known (LT-211): the harness always provides it, so a reactive
	// thunk reading `isPending(knownSignal)` folds server-side. This does
	// NOT reopen @if over signals — `validateCondition` diagnoses signal
	// reads first.
	const serverKnown = ctx.serverKnown

	// Placements run BEFORE the milestone-gate check: an unused-import
	// warning (TSRX014) belongs in the report even when the file is gated
	// (diagnostic-order parity with the pre-extraction pipeline).
	const plainPlacement = placePlainImports(
		ctx,
		{
			root: resolved.root,
			setup: extraction.setup,
			plainSetup: extraction.plainSetup,
			clientSetup: extraction.clientSetup,
			signals: extraction.signals,
			serverKnown,
		},
		plainImports,
	)
	const leTrucPlacement = placeLeTrucImports(
		ctx,
		{
			root: resolved.root,
			setup: extraction.setup,
			plainSetup: extraction.plainSetup,
			clientSetup: extraction.clientSetup,
			signals: extraction.signals,
			serverKnown,
		},
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

	// A milestone gate (reactive @for) skips the whole file: rendering the
	// remaining markup without the gated construct would be silently wrong.
	const gated = ctx.diagnostics.some(d => d.code === 'TSRX001')
	if (gated) return null

	return {
		name: componentName,
		source: ctx.source,
		tag: resolved.root.tag,
		paramsText: paramsNode ? text(ctx.source, paramsNode) : '',
		paramNames: [...paramNames],
		paramProps: paramPropsOf(ctx, paramsNode),
		i18nMessages: decls.i18nMessages,
		declaresI18n: declaresI18nOf(paramsNode),
		langBinding: langBindingOf(paramsNode),
		langArgDefault: langArgDefaultOf(paramsNode),
		caseType,
		setup: extraction.setup,
		clientSetup: extraction.clientSetup,
		plainSetup: extraction.plainSetup,
		signals: extraction.signals,
		exposeText: extraction.exposeText,
		exposeRange: extraction.exposeRange,
		exposeArgNode: extraction.exposeArgNode,
		exposeProps: extraction.exposeProps,
		exposeKinds: extraction.exposeKinds,
		parserExposeProps: extraction.parserExposeProps,
		exposeAmbients: [...extraction.exposeAmbients].sort(),
		contextRefs: [...extraction.contextRefs].sort(),
		config: decls.config,
		root: resolved.root,
		refReasons: resolved.refReasons,
		unmatchedOptionalRefs: resolved.unmatchedOptionalRefs,
		deferredComposeRefs: resolved.deferredComposeRefs,
		optionalRefs: resolved.optionalRefs,
		fors: resolved.fors,
		css: resolved.css,
		typeDecls: decls.typeDecls,
		globalDecl: decls.globalDecl,
		propsTypeName: decls.propsTypeName,
		componentDoc: leadingDocComment(ctx.source, fnStmtStart),
		serverKnown,
		imports,
	}
}
