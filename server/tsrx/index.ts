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

import { analyzeClient } from './analyze'
import { collectComposeElements, compileSource } from './compiler'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import { emitClientModule } from './emit-client'
import { emitServerModule } from './emit-server'
import type { RegistryEntry } from './registry'
import type { SourceSpan } from './spans'

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
	const { component, diagnostics } = compileSource(source, filename)
	if (!component) return { component: null, diagnostics }
	if (composeRegistry) {
		for (const node of collectComposeElements(component)) {
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
			},
			serverCode: server.code,
			clientCode: client.code,
			css: component.css,
			clientSpans: client.spans,
		},
		diagnostics,
	}
}

export type { ClientPlan } from './analyze'
export { analyzeClient } from './analyze'
export type { CompileResult, ComponentIR } from './compiler'
export { compileSource } from './compiler'
export { dedentCss } from './css'
export type { CompileDiagnostic, DiagnosticCode } from './diagnostics'
export type { EmittedClientModule } from './emit-client'
export { emitClientModule } from './emit-client'
export type { EmittedServerModule } from './emit-server'
export { emitServerModule } from './emit-server'
export type { ComponentRegistry, RegistryEntry } from './registry'
export { registryJson } from './registry'
export type { SourceSpan } from './spans'
export {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
} from './spans'
