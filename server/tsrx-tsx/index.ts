/**
 * TSX spike (LT-183): public API — `server/tsrx/index.ts`'s pipeline
 * assembly with the front end swapped (`compileSourceTsx` for
 * `compileSource`). Everything after `compileSource` — compose validation,
 * `analyzeClient`, tier classification, both emitters, the registry entry —
 * is IMPORTED UNMODIFIED from `server/tsrx/`; this file mirrors
 * `compileComponent`'s body because that body lives inside the original
 * module (its stages are otherwise exported).
 */

import { analyzeClient } from '../tsrx/analysis/plan'
import { collectComposeElements } from '../tsrx/compiler'
import { type CompileDiagnostic, diagnostic } from '../tsrx/diagnostics'
import { emitClientModule } from '../tsrx/emit-client'
import { emitServerModule } from '../tsrx/emit-server'
import type { RegistryEntry } from '../tsrx/registry'
import type { SourceSpan } from '../tsrx/spans'
import { classifyTier } from '../tsrx/tier'
import { compileSourceTsx } from './compiler-tsx'

export type CompiledComponent = {
	entry: RegistryEntry
	serverCode: string
	clientCode: string
	css: string
	clientSpans: SourceSpan[]
	serverSpans: SourceSpan[]
}

export type CompileFileResult = {
	component: CompiledComponent | null
	diagnostics: CompileDiagnostic[]
}

export const compileComponentTsx = (
	source: string,
	filename: string,
	registry: ReadonlySet<string>,
	childImports?: ReadonlyMap<string, string>,
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): CompileFileResult => {
	const {
		component,
		diagnostics,
		routingSignals: setupSignals,
	} = compileSourceTsx(source, filename)
	if (!component) return { component: null, diagnostics }
	const composeNodes = collectComposeElements(component)
	if (composeRegistry) {
		for (const node of composeNodes) {
			if (!composeRegistry.has(node.source))
				diagnostics.push(
					diagnostic.composedComponentNotCompiled(
						component.source,
						node.node.start,
						node.component,
						node.source,
					),
				)
		}
	}
	const plan = analyzeClient(component, registry, diagnostics, composeRegistry)
	if (diagnostics.some(d => d.severity === 'error'))
		return { component: null, diagnostics }
	const routingSignals = [...setupSignals, ...plan.routingSignals]
	const tier = classifyTier(routingSignals)
	const composeReadTags = composeRegistry
		? [
				...new Set(
					composeNodes
						.filter(node =>
							node.attrs.some(
								attr => attr.kind === 'ref' || attr.kind === 'pass',
							),
						)
						.map(node => composeRegistry.get(node.source)?.tag)
						.filter((tag): tag is string => tag !== undefined),
				),
			]
		: []
	const server = emitServerModule(component, {
		runtimeImport: '../../tsrx/runtime',
		sourcePath: filename,
		composeRegistry,
		tier,
	})
	const client = emitClientModule(component, plan, {
		sourcePath: filename,
		childImports,
	})
	return {
		component: {
			entry: {
				tag: component.tag,
				name: component.name,
				source: filename,
				serverModule: `${component.tag}.server.ts`,
				clientModule: `${component.tag}.client.ts`,
				css: `${component.tag}.css`,
				propsType: component.propsTypeName,
				exposedProps: Object.fromEntries(component.exposeKinds),
				tier,
				routingSignals,
				suppressedSites: plan.suppressedSites,
				composeReadTags,
				declaresI18n: component.declaresI18n,
				langArgDefault: component.langArgDefault,
				i18nMessages: component.i18nMessages,
				caseType: component.caseType,
				composesTags: composeRegistry
					? [
							...new Set(
								composeNodes
									.map(node => composeRegistry.get(node.source)?.tag)
									.filter((tag): tag is string => tag !== undefined),
							),
						]
					: [],
			},
			serverCode: server.code,
			clientCode: client.code,
			css: component.css,
			clientSpans: client.spans,
			serverSpans: server.spans,
		},
		diagnostics,
	}
}
