/**
 * The final `ComponentIR` assembly and the module-level facts it consumes —
 * declarations beside the component function (`readModuleDecls`: exported
 * type declarations, `declare global`, `export const config`, `export const
 * i18n`) and the component's leading doc comment — shared by both front
 * ends (LT-202, ADR 0032 sub-design 6: the anti-drift half of the dual
 * front-end contract). Front-end-neutral like the other front-end stage
 * modules: no parser values, only the loose `AstNode` type.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	collectBoundNames,
	identifierName,
	isNode,
	text,
} from './ast-utils'
import { readConfig } from './config'
import { diagnostic } from './diagnostics'
import { foldableHostProps, initializerHostReads } from './evaluability'
import type { ExtractContext } from './extract-context'
import {
	declaresI18nOf,
	langArgDefaultOf,
	langBindingOf,
	messageBindingsOf,
	readI18nDecl,
} from './i18n'
import type { MessageArg } from './icu/parse'
import {
	type LeTrucImport,
	type PlainImportIR,
	placeLeTrucImports,
	placePlainImports,
} from './imports'
import {
	isOptionalBinding,
	typeAnnotationForBinding,
	typeOfAnnotation,
} from './infer-type'
import { resolveInitialWinners } from './initial-winner'
import type { ComponentIR, ComponentParam, ConfigIR, ForIR } from './ir'
import type { ComponentParams } from './params'
import { onServer, type SetupExtraction } from './setup-extraction'
import type { ResolvedTemplate } from './template-output'
import { rangeFields, resolutionOf } from './tier'

/** Module-level declarations beside the component function. */
export type ModuleDecls = {
	typeDecls: string[]
	globalDecl: string | null
	propsTypeName: string | null
	config: ConfigIR | null
	i18nMessages: Record<string, string> | null
	/** Per key, the arguments its source pattern takes (`I18nDecl.args`). */
	i18nArgs: Record<string, readonly MessageArg[]> | null
	/** Module-level value names (`ComponentIR.moduleBindings`). */
	moduleBindings: string[]
}

/**
 * Module-level declarations beside the component function: type
 * declarations (exported or module-local) and `declare global`, verbatim;
 * `export const config`; `export const i18n` (ADR 0030 sub-design 4, LT-173).
 */
export const readModuleDecls = (
	ctx: ExtractContext,
	ast: AstNode,
	componentName: string,
): ModuleDecls => {
	const typeDecls: string[] = []
	let globalDecl: string | null = null
	let propsTypeName: string | null = null
	let config: ConfigIR | null = null
	let i18nMessages: Record<string, string> | null = null
	let i18nArgs: Record<string, readonly MessageArg[]> | null = null
	const moduleBindings = new Set<string>()
	for (const stmt of asArray(ast.body)) {
		const valueDecl =
			stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
				? stmt.declaration
				: stmt
		if (valueDecl.type === 'VariableDeclaration')
			for (const d of asArray(valueDecl.declarations))
				collectBoundNames(d.id, moduleBindings)
		else if (
			valueDecl.type === 'FunctionDeclaration' ||
			valueDecl.type === 'ClassDeclaration'
		) {
			const declName = identifierName(valueDecl.id)
			if (declName && declName !== componentName) moduleBindings.add(declName)
		}
		const declaredConfig = readConfig(ctx, stmt)
		if (declaredConfig) {
			config = declaredConfig
			continue
		}
		const declaredI18n = readI18nDecl(ctx, stmt)
		if (declaredI18n) {
			i18nMessages = declaredI18n.messages
			i18nArgs = declaredI18n.args
			continue
		}
		// Exported or not: a module-local `type`/`interface` is as much a
		// part of the setup's typing as an exported one, and a generated
		// module that drops it names a type it never declares (LT-439).
		if (
			valueDecl.type === 'TSTypeAliasDeclaration' ||
			valueDecl.type === 'TSInterfaceDeclaration'
		) {
			typeDecls.push(text(ctx.source, stmt))
			const declName = identifierName(valueDecl.id)
			if (stmt !== valueDecl && declName === `${componentName}Props`)
				propsTypeName = declName
		}
		if (stmt.type === 'TSModuleDeclaration' && String(stmt.kind) === 'global')
			globalDecl = text(ctx.source, stmt)
	}
	return {
		typeDecls,
		globalDecl,
		propsTypeName,
		config,
		i18nMessages,
		i18nArgs,
		moduleBindings: [...moduleBindings],
	}
}

/**
 * The doc comment immediately preceding a declaration, sliced verbatim.
 * The whitespace-only guard between comment close and declaration keeps a
 * module-level doc from being mistaken for the component's own when other
 * statements (type declarations, `declare global`) sit in between. Carried
 * above the generated `export default defineComponent(` so CEM extraction
 * (ADR 0024, LT-006) reads the authored description and tags.
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
	paramsNode: AstNode | null,
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
						? (annotation.typeAnnotation as AstNode)
						: annotation,
				)
			: 'unknown'
		props.push({
			name,
			typeText: annotationText,
			optional: isOptionalBinding(paramsNode, name),
			hasDefault: value.type === 'AssignmentPattern',
			isString: annotation ? typeOfAnnotation(annotation) === 'string' : false,
			isNumber: annotation ? typeOfAnnotation(annotation) === 'number' : false,
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
		plainImports,
		leTrucImports,
	}: {
		componentName: string
		fnStmtStart: number
		paramsNode: AstNode | null
		paramNames: ReadonlySet<string>
		contextParam: ComponentParams['contextParam']
		extraction: SetupExtraction
		resolved: ResolvedTemplate & { fors: Map<AstNode, ForIR> }
		decls: ModuleDecls
		plainImports: PlainImportIR[]
		leTrucImports: LeTrucImport[]
	},
): ComponentIR | null => {
	// The annotation-surface check (LTC050, LT-209) — `config` is what the
	// extract-time vocabulary check could not see. Runs before the gate so
	// the diagnostic lands even on gated files (the LTC014 posture). The
	// report covers the written type (LT-358b, LT-371).
	if (contextParam?.annotationName) {
		const formAssociated = !!decls.config?.form
		if (formAssociated && contextParam.annotationName === 'FactoryContext')
			ctx.diagnostics.push(
				diagnostic.formContextMismatch(
					ctx.source,
					contextParam.annotation,
					'FactoryContext',
				),
			)
		else if (
			!formAssociated &&
			contextParam.annotationName === 'FormFactoryContext'
		)
			ctx.diagnostics.push(
				diagnostic.formContextMismatch(
					ctx.source,
					contextParam.annotation,
					'FormFactoryContext',
				),
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
	// Every reactive-list item's setup (ADR 0046 s5): the usage walks below
	// place the imports it reads, like component setup's.
	const itemSetup = [...resolved.fors.values()].flatMap(loop =>
		loop.kind === 'reconcile' ? loop.setup : [],
	)

	// Placements run BEFORE the milestone-gate check: an unused-import
	// warning (LTC014) belongs in the report even when the file is gated
	// (diagnostic-order parity with the pre-extraction pipeline).
	const listItemTypeTexts = extraction.signals.flatMap(signal =>
		signal.family === 'declared' && signal.listItem?.typeText
			? [signal.listItem.typeText]
			: [],
	)
	const plainPlacement = placePlainImports(
		ctx,
		{
			root: resolved.root,
			setup: extraction.setup,
			plainSetup: extraction.plainSetup,
			clientSetup: extraction.clientSetup,
			signals: extraction.signals,
			itemSetup,
			serverKnown,
		},
		plainImports,
		{
			// The setup statements are verbatim in both modules, and a
			// per-field list harvest annotates each rebuilt item with the item
			// type (ADR 0046 s7): a type import they name is a use.
			server: [
				...decls.typeDecls,
				paramsNode ? text(ctx.source, paramsNode) : '',
				...extraction.setup.map(stmt => stmt.text),
			],
			client: [
				...decls.typeDecls,
				...(decls.globalDecl ? [decls.globalDecl] : []),
				...extraction.setup.map(stmt => stmt.text),
				...listItemTypeTexts,
			],
		},
	)
	const leTrucPlacement = placeLeTrucImports(
		ctx,
		{
			root: resolved.root,
			setup: extraction.setup,
			plainSetup: extraction.plainSetup,
			clientSetup: extraction.clientSetup,
			signals: extraction.signals,
			itemSetup,
			serverKnown,
		},
		leTrucImports,
		{
			// The verbatim texts both modules re-emit: the type declarations
			// and the setup statements, whose type positions a usage walk
			// never sees (the params slice is value vocabulary).
			server: [
				...decls.typeDecls,
				...extraction.setup.map(stmt => stmt.text),
				...itemSetup.filter(onServer).map(stmt => stmt.text),
			],
			client: [
				...decls.typeDecls,
				...(decls.globalDecl ? [decls.globalDecl] : []),
				...extraction.setup.map(stmt => stmt.text),
				...itemSetup.map(stmt => stmt.text),
				...listItemTypeTexts,
			],
		},
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
	const gated = ctx.diagnostics.some(d => d.code === 'LTC001')
	if (gated) return null

	const component: ComponentIR = {
		name: componentName,
		source: ctx.source,
		surface: ctx.surface,
		tag: resolved.root.tag,
		paramsText: paramsNode ? text(ctx.source, paramsNode) : '',
		paramNames: [...paramNames],
		moduleBindings: decls.moduleBindings,
		messageTBindings: [...messageBindingsOf(paramsNode).tNames],
		handlerArgs: ctx.handlerArgs,
		messageRecordBindings: [...messageBindingsOf(paramsNode).recordNames],
		paramProps: paramPropsOf(ctx, paramsNode),
		i18nMessages: decls.i18nMessages,
		i18nArgs: decls.i18nArgs,
		declaresI18n: declaresI18nOf(paramsNode),
		langBinding: langBindingOf(paramsNode),
		langArgDefault: langArgDefaultOf(paramsNode),
		setup: extraction.setup,
		clientSetup: extraction.clientSetup,
		plainSetup: extraction.plainSetup,
		itemSetup,
		signals: extraction.signals,
		expose: extraction.expose,
		exposeProps: extraction.exposeProps,
		contextRefs: [...extraction.contextRefs].sort(),
		config: decls.config,
		root: resolved.root,
		firstRefs: resolved.firstRefs,
		fors: resolved.fors,
		css: resolved.css,
		sheetText: resolved.sheetText,
		sheet: resolved.sheet,
		typeDecls: decls.typeDecls,
		globalDecl: decls.globalDecl,
		propsTypeName: decls.propsTypeName,
		componentDoc: leadingDocComment(ctx.source, fnStmtStart),
		serverKnown,
		imports,
	}
	routeHostSeededSignals(ctx, component)
	// The one IR fact that needs the whole component: each conditional's
	// initial winner reads the root's attributes and every signal.
	resolveInitialWinners(component)
	return component
}

/**
 * A signal declaration reading `host` (LT-451) — `createList(host.seed, …)`
 * over a Parser-backed prop — is server-known only when every read folds
 * through `hostSeedExpr` (the emitter splices them, `emit-server.ts`). One
 * that reads a prop with no server truth routes per ADR 0029 s5, as an
 * unseeded sensor does: it leaves `serverKnown`, so each site reading it is
 * omitted, and the realm — which runs `expose()` — answers it. Decided here
 * because the fold needs the root's attributes and the placed imports.
 * A derived callback reading `host` never reaches `signals` (LTC013 at
 * extraction), and a sensor's server value is its `{ value }` seed.
 */
const routeHostSeededSignals = (
	ctx: ExtractContext,
	component: ComponentIR,
): void => {
	const foldable = foldableHostProps(component)
	const unresolved = component.signals.flatMap(signal => {
		if (signal.family !== 'declared') return []
		const stmt = component.setup.find(s => s.name === signal.name)
		if (!stmt || initializerHostReads(stmt.node, foldable) !== null) return []
		return [{ signal, stmt }]
	})
	for (const { signal, stmt } of unresolved) {
		signal.unresolvable = true
		ctx.serverKnown.delete(signal.name)
		ctx.routingSignals.push({
			origin: 'LTC013',
			detail: `\`${signal.name}\`'s ${signal.constructor}() initializer reads host with no server value`,
			...rangeFields(ctx.source, stmt.node),
			resolution: resolutionOf(stmt.node, ctx.serverKnown),
		})
	}
}
