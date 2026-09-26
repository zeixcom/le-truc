/**
 * The shared post-front-end pipeline (LT-202, ADR 0032 sub-design 6): the
 * stage assembly both front ends run after their `compileSource` — compose
 * validation, `analyzeClient`, tier classification, both emitters, the
 * registry entry. `server/compiler/frontend/tsrx/index.ts` (`compileComponent`) and
 * `server/compiler/frontend/tsx/index.ts` (`compileComponentTsx`) are thin shells over
 * this function, differing ONLY in which front end parses the source, so a
 * pipeline change cannot drift between surfaces.
 */

import { analyzeClient } from './analysis/plan'
import { renderedShapesOf } from './analysis/selectors'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import { emitClientModule } from './emit-client'
import { DEFAULT_EMIT_PATHS, type EmitPaths } from './emit-paths'
import { emitServerModule } from './emit-server'
import { checkFoldInputs } from './fold-inputs'
import type { ComponentIR } from './ir'
import type { RegistryEntry } from './registry'
import type { SourceSpan } from './spans'
import type { RoutingSignal } from './tier'
import { classifyTier } from './tier'
import { collectComposeElements } from './walk'

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
	 * Whether a form-association extension leads `config` — the host type
	 * (`FormAssociatedElement` vs `HTMLElement`) of the tag-map entry
	 * `tsrx-imports.d.ts` writes for a served `.tsrx` source (LT-325).
	 */
	formAssociated: boolean
	/**
	 * Client-module span table (LT-011, `check:corpus`): maps tsc diagnostics
	 * over `clientCode` back onto the authored source.
	 */
	clientSpans: SourceSpan[]
	/**
	 * Server-module span table (LT-019): composition makes server modules
	 * import each other's real types, so generated server modules are
	 * type-checked too, through this table.
	 */
	serverSpans: SourceSpan[]
}

export type CompileFileResult = {
	component: CompiledComponent | null
	diagnostics: CompileDiagnostic[]
}

/* === Exported Functions === */

/**
 * Run the shared pipeline over a front end's extraction result. `registry`,
 * `childImports`, and `composeRegistry` mean exactly what they mean on
 * `compileComponent` (see the `.tsrx` index for the compose-registry
 * tolerance notes); `sourcePath` is the authored file's project-root-relative
 * path. `emitPaths` carries the configured output root's consequences for the
 * emitted specifiers (LT-255, `emit-paths.ts`); its default is this repo's
 * layout, so an unconfigured call emits what it always emitted.
 */
export const compileFromIR = (
	component: ComponentIR | null,
	diagnostics: CompileDiagnostic[],
	setupSignals: RoutingSignal[],
	filename: string,
	registry: ReadonlySet<string>,
	childImports?: ReadonlyMap<string, string>,
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
	emitPaths: EmitPaths = DEFAULT_EMIT_PATHS,
): CompileFileResult => {
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
	// LT-258: the partial-readiness invariant (ADR 0034 s4) — nothing but
	// own args and the declared ambient set may reach the fold.
	checkFoldInputs(component, diagnostics)
	if (diagnostics.some(d => d.severity === 'error'))
		return { component: null, diagnostics }
	/**
	 * The per-component half of the tier decision (ADR 0029, LT-165). Both
	 * halves of the analysis contribute: setup extraction sees the
	 * `LTC013`/`LTC043` shapes, the client analysis sees `LTC004`/
	 * `LTC034`.
	 *
	 * Compose contamination (sub-design 3) is deliberately NOT applied here
	 * — it is a fixpoint over the whole corpus's compose graph, so it runs
	 * in the registry-aware second pass (`server/effects/compile.ts`) where
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
		runtimeImport: emitPaths.runtimeImport,
		sourcePath: filename,
		composeRegistry,
		// ADR 0029 sub-design 4: the tier decides whether the module
		// re-declares the `@{ }` value harness. Pre-contamination by
		// construction — see the option's own doc for why that is sound.
		tier,
		clientMessageKeys: plan.clientMessageKeys,
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
				renderedShapes: renderedShapesOf(component),
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
			formAssociated: !!component.config?.form,
			clientSpans: client.spans,
			serverSpans: server.spans,
		},
		diagnostics,
	}
}
