/**
 * TSRX compiler build effect (ADR 0023 milestone 1, LT-001).
 *
 * Watches every `.tsrx` source under `examples/`, compiles each through the inlined
 * compiler, and writes the generated artifacts (server render module,
 * generated client module, verbatim tag-scoped CSS) plus the component
 * registry into the gitignored `server/generated/tsrx/` directory. Nothing
 * consumes the artifacts yet — the docs/examples migration is the follow-on
 * once ADR 0023 is accepted — so this effect's job today is keeping the
 * compiler exercised against the corpus on every docs build.
 *
 * Severity policy: milestone gates (warnings, e.g. TSRX001 reactive `@for`)
 * skip the file with a logged notice; errors fail the build run.
 */

import { mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { componentTsrx, type FileInfo } from '../file-signals'
import { getFilePath, writeFileSafe } from '../io'
import { compileComponent } from '../tsrx'
import { registryJson, type RegistryEntry } from '../tsrx/registry'
import { createBuildEffect } from './build-effect'

/* === Internal Functions === */

const GENERATED_DIR = join(import.meta.dir, '..', 'generated', 'tsrx')

/**
 * Compile the whole corpus (exported for the standalone `scripts/build-tsrx.ts`
 * runner — `build:cem` needs the generated clients on disk before `cem
 * analyze` reads them).
 */
export const compileTsrxCorpus = async (files: FileInfo[]): Promise<void> => {
	await mkdir(GENERATED_DIR, { recursive: true })

	// Registry-aware dispatch needs every compilable tag up front: first
	// pass collects tags (warnings already skip their files), second pass
	// compiles against the full registry.
	const registry = new Set<string>()
	const compilable = new Map<string, string>()
	for (const file of files) {
		const rel = relative(join(import.meta.dir, '..', '..'), file.path)
		const { component, diagnostics } = compileComponent(
			file.content,
			rel,
			new Set<string>(),
		)
		for (const d of diagnostics) {
			const label = `[${d.code}] ${d.line ? `line ${d.line}: ` : ''}${d.message}`
			if (d.severity === 'error') console.error(`❌ ${rel} — ${label}`)
			else console.warn(`⚠️ ${rel} — ${label}`)
		}
		if (component) {
			registry.add(component.entry.tag)
			compilable.set(rel, file.content)
		}
	}

	const entries: RegistryEntry[] = []
	for (const [rel, content] of compilable) {
		const { component, diagnostics } = compileComponent(content, rel, registry)
		for (const d of diagnostics) {
			const label = `[${d.code}] ${d.line ? `line ${d.line}: ` : ''}${d.message}`
			if (d.severity === 'error') console.error(`❌ ${rel} — ${label}`)
			else console.warn(`⚠️ ${rel} — ${label}`)
		}
		if (!component) continue
		const { entry } = component
		await writeFileSafe(
			getFilePath(GENERATED_DIR, entry.serverModule),
			component.serverCode,
		)
		await writeFileSafe(
			getFilePath(GENERATED_DIR, entry.clientModule),
			component.clientCode,
		)
		await writeFileSafe(getFilePath(GENERATED_DIR, entry.css), component.css)
		entries.push(entry)
		console.log(`✅ Compiled ${entry.tag} from ${rel}`)
	}

	await writeFileSafe(
		getFilePath(GENERATED_DIR, 'registry.json'),
		registryJson(entries),
	)
	console.log(`📝 TSRX compilation completed (${entries.length} component(s))`)
}

/* === Exported Effect === */

export const tsrxEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'TSRX compiler',
		[componentTsrx.sources],
		async ([files]) => {
			console.log('🔄 Compiling TSRX components...')
			await compileTsrxCorpus(files)
		},
		onRebuild,
	)
