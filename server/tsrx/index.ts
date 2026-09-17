/**
 * Inlined TSRX compiler — public API (ADR 0023).
 *
 * compileComponent runs the full pipeline for one `.tsrx` source: parse +
 * extract (compiler.ts), then the SHARED pipeline (`pipeline.ts`, LT-202 —
 * analyze for the client, emit the server render module, the generated
 * client module, and the verbatim tag-scoped CSS). Warnings skip the file
 * (milestone gates); errors fail it.
 *
 * The `.tsx` surface's `compileComponentTsx`
 * (`server/tsrx-tsx/index.ts`) is the same shell over the same pipeline
 * with the front end swapped — the anti-drift contract of ADR 0032
 * sub-design 6.
 *
 * Until TSRX reaches 1.0 this compiler lives in-repo (`server/tsrx/`,
 * ROADMAP "Packaging"); with Le Truc v3.0 it ships as `@tsrx/le-truc`.
 */

import { compileSource } from './compiler'
import { type CompileFileResult, compileFromIR } from './pipeline'
import type { RegistryEntry } from './registry'

/* === Exported Functions === */

export const compileComponent = (
	source: string,
	filename: string,
	registry: ReadonlySet<string>,
	childImports?: ReadonlyMap<string, string>,
	/**
	 * Composed (PascalCase) elements' targets, keyed by resolved source
	 * path (ADR 0023 sub-design 10) — built corpus-wide from every
	 * component's own registry entry (`server/effects/tsrx.ts`). Undefined
	 * during registry-discovery passes (composition isn't validated yet, the
	 * same tolerance an empty `registry` gets for raw-tag `pass()` dispatch).
	 */
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): CompileFileResult => {
	const { component, diagnostics, routingSignals } = compileSource(
		source,
		filename,
	)
	return compileFromIR(
		component,
		diagnostics,
		routingSignals,
		filename,
		registry,
		childImports,
		composeRegistry,
	)
}

export type { ClientPlan } from './analysis/plan'
export { analyzeClient } from './analysis/plan'
export type { CompileResult } from './compiler'
export { collectComposeElements, compileSource } from './compiler'
export { dedentCss } from './css'
export type { CompileDiagnostic, DiagnosticCode } from './diagnostics'
export type { EmittedClientModule } from './emit-client'
export { emitClientModule } from './emit-client'
export type { EmittedServerModule } from './emit-server'
export { emitServerModule } from './emit-server'
export type { ComponentIR } from './ir'
export type {
	CompiledComponent,
	CompileFileResult,
} from './pipeline'
export type { ComponentRegistry, RegistryEntry } from './registry'
export { registryJson } from './registry'
export type { SourceSpan } from './spans'
export {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
} from './spans'
