/**
 * The final `ComponentIR` assembly and the module-level facts it consumes —
 * declarations beside the component function (`readModuleDecls`: exported
 * type declarations, `declare global`, `export const config`, `export const
 * i18n`) and the component's leading doc comment — shared by both front
 * ends (LT-202, ADR 0032 sub-design 6: the anti-drift half of the dual
 * front-end contract). Front-end-neutral like the other front-end stage
 * modules: no parser values, only the loose `TsrxNode` type.
 */

import type { TsrxNode } from '@tsrx/core'
import { asArray, identifierName, isNode, text } from './ast-utils'
import { readConfig } from './config'
import { diagnostic } from './diagnostics'
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
	isOptionalBinding,
	typeAnnotationForBinding,
	typeOfAnnotation,
} from './infer-type'
import type {
	ComponentIR,
	ComponentParam,
	ConfigIR,
	ExtractContext,
	ForIR,
} from './ir'
import type { ComponentParams } from './params'
import type { SetupExtraction } from './setup-extraction'
import type { ResolvedTemplate } from './template-output'

/** Module-level declarations beside the component function. */
export type ModuleDecls = {
	typeDecls: string[]
	globalDecl: string | null
	propsTypeName: string | null
	config: ConfigIR | null
	i18nMessages: Record<string, string> | null
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
			ctx.diagnostics.push(diagnostic.formContextMismatch('FactoryContext'))
		else if (
			!formAssociated &&
			contextParam.annotationName === 'FormFactoryContext'
		)
			ctx.diagnostics.push(diagnostic.formContextMismatch('FormFactoryContext'))
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
