/**
 * Inlined TSRX compiler — public API (ADR 0023).
 *
 * compileComponent runs the full pipeline for one source: parse + extract
 * (compiler.ts), analyze for the client (analyze.ts), emit the server
 * render module, the generated client module, and the verbatim tag-scoped
 * CSS. Warnings skip the file (milestone gates); errors fail it.
 *
 * Until TSRX reaches 1.0 this compiler lives in-repo (`server/tsrx/`,
 * ROADMAP "Packaging"); with Le Truc v3.0 it ships as `@tsrx/le-truc`.
 */

import { analyzeClient } from './analysis/plan'
import { collectComposeElements, compileSource } from './compiler'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import { emitClientModule } from './emit-client'
import { emitServerModule } from './emit-server'
import type { RegistryEntry } from './registry'
import type { SourceSpan } from './spans'
import { classifyTier } from './tier'

/* === Types === */

export type CompiledComponent = {
	entry: RegistryEntry
	/** Generated server render module source. */
	serverCode: string
	/** Generated client `defineComponent` module source. */
	clientCode: string
	/** Dedented verbatim CSS artifact. */
	css: string
	/**
	 * Client-module span table (LT-011): `check:tsrx` maps tsc diagnostics
	 * over `clientCode` back onto this component's `.tsrx` source through it.
	 */
	clientSpans: SourceSpan[]
	/**
	 * Server-module span table (LT-019, extends LT-011): composition is the
	 * first construct that makes server modules import each other's real
	 * types (LT-015/LT-018), so `check:tsrx` now type-checks generated server
	 * modules too — a missing/mistyped server arg or `children` composition
	 * argument is a real tsc diagnostic, remapped through this table.
	 */
	serverSpans: SourceSpan[]
}

export type CompileFileResult = {
	component: CompiledComponent | null
	diagnostics: CompileDiagnostic[]
}

/* === Exported Functions === */

export const compileComponent = (
	source: string,
	filename: string,
	registry: ReadonlySet<string>,
	childImports?: ReadonlyMap<string, string>,
	/**
	 * Composed (PascalCase) elements' targets, keyed by resolved `.tsrx`
	 * source path (ADR 0023 sub-design 10) — built corpus-wide from every
	 * component's own registry entry (`server/effects/tsrx.ts`). Undefined
	 * during registry-discovery passes (composition isn't validated yet, the
	 * same tolerance an empty `registry` gets for raw-tag `pass()` dispatch).
	 */
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): CompileFileResult => {
	const {
		component,
		diagnostics,
		routingSignals: setupSignals,
	} = compileSource(source, filename)
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
	/**
	 * The per-component half of the tier decision (ADR 0029, LT-165). Both
	 * halves of the analysis contribute: setup extraction sees the
	 * `TSRX013`/`TSRX043` shapes, the client analysis sees `TSRX004`/
	 * `TSRX034`.
	 *
	 * Compose contamination (sub-design 3) is deliberately NOT applied here
	 * — it is a fixpoint over the whole corpus's compose graph, so it runs
	 * in the registry-aware second pass (`server/effects/tsrx.ts`) where
	 * every component's first-pass tier is known. This value is therefore
	 * the component's tier BEFORE contamination, and can only move
	 * downward (towards the Simulated tier) from here.
	 */
	const routingSignals = [...setupSignals, ...plan.routingSignals]
	const tier = classifyTier(routingSignals)
	/**
	 * Composed children this component READS — a `first()` addressing the
	 * compose site (resolved to a synthetic `ref` attr by
	 * `analysis/compose-refs.ts`) or a `truc:pass={{ }}` into it.
	 *
	 * Deliberately NOT every composed child (ADR 0029 sub-design 3):
	 * containment does not contaminate, because the compose graph renders
	 * children before parents, so a merely-embedded child's markup is
	 * already a string by the time the parent needs it. A containment rule
	 * was measured and rejected — with page chrome in the graph it drags
	 * nearly the whole corpus into the realm.
	 */
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
				composeReadTags,
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

export type { ClientPlan } from './analysis/plan'
export { analyzeClient } from './analysis/plan'
export type { CompileResult } from './compiler'
export { compileSource } from './compiler'
export { dedentCss } from './css'
export type { CompileDiagnostic, DiagnosticCode } from './diagnostics'
export type { EmittedClientModule } from './emit-client'
export { emitClientModule } from './emit-client'
export type { EmittedServerModule } from './emit-server'
export { emitServerModule } from './emit-server'
export type { ComponentIR } from './ir'
export type { ComponentRegistry, RegistryEntry } from './registry'
export { registryJson } from './registry'
export type { SourceSpan } from './spans'
export {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
} from './spans'
