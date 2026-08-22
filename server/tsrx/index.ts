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
import { compileSource } from './compiler'
import type { CompileDiagnostic } from './diagnostics'
import { emitClientModule } from './emit-client'
import { emitServerModule } from './emit-server'
import type { RegistryEntry } from './registry'

/* === Types === */

export type CompiledComponent = {
	entry: RegistryEntry
	/** Generated server render module source. */
	serverCode: string
	/** Generated client `defineComponent` module source. */
	clientCode: string
	/** Dedented verbatim CSS artifact. */
	css: string
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
): CompileFileResult => {
	const { component, diagnostics } = compileSource(source, filename)
	if (!component) return { component: null, diagnostics }
	const plan = analyzeClient(component, registry, diagnostics)
	if (diagnostics.some(d => d.severity === 'error'))
		return { component: null, diagnostics }
	const server = emitServerModule(component, {
		runtimeImport: '../../tsrx/runtime',
		sourcePath: filename,
	})
	const client = emitClientModule(component, plan, { sourcePath: filename })
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
		},
		diagnostics,
	}
}

export { compileSource } from './compiler'
export { analyzeClient } from './analyze'
export { emitServerModule } from './emit-server'
export { emitClientModule } from './emit-client'
export { dedentCss } from './css'
export { registryJson } from './registry'
export type { RegistryEntry, ComponentRegistry } from './registry'
export type { ClientPlan } from './analyze'
export type { ComponentIR, CompileResult } from './compiler'
export type { CompileDiagnostic, DiagnosticCode } from './diagnostics'
export type { EmittedServerModule } from './emit-server'
export type { EmittedClientModule } from './emit-client'
