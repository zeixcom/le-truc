/**
 * The `.tsx` front end's public API (LT-183 spike, productionized by
 * LT-202): the SHARED pipeline (`server/tsrx/pipeline.ts` — compose
 * validation, `analyzeClient`, tier classification, both emitters, the
 * registry entry) over `compileSourceTsx`. Everything after the front end
 * is imported unmodified from `server/tsrx/`; this shell differs from
 * `compileComponent` ONLY in which front end parses the source — the
 * anti-drift contract of ADR 0032 sub-design 6.
 */

import { type CompileFileResult, compileFromIR } from '../tsrx/pipeline'
import type { RegistryEntry } from '../tsrx/registry'
import { compileSourceTsx } from './compiler-tsx'

export type {
	CompiledComponent,
	CompileFileResult,
} from '../tsrx/pipeline'

export const compileComponentTsx = (
	source: string,
	filename: string,
	registry: ReadonlySet<string>,
	childImports?: ReadonlyMap<string, string>,
	/**
	 * Composed (PascalCase) elements' targets, keyed by resolved source
	 * path — the same tolerance semantics as `compileComponent`.
	 */
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): CompileFileResult => {
	const { component, diagnostics, routingSignals } = compileSourceTsx(
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
